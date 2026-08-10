#!/usr/bin/env python3
"""Run this repo's six verification gates in one pass and print one evidence block.

Every gate's exit code is captured from the process itself, never from a pipe.
`npx vitest run | tail -5` reports tail's exit status, not vitest's, so a suite
that fails prints a green 0 -- that is why the run logs say "exit codes asserted
directly, not through a pipe", and why this script uses subprocess argument
lists with no shell in between.

Refuses to report a result it cannot stand behind:
  - a vitest run that collected zero files or zero tests is not evidence,
    however green its exit code
  - a summary line this script cannot read is reported as unreadable, never
    silently counted as zero
  - a gate that timed out is untrustworthy, not failed
  - a missing scope leaves gate 6 SKIPPED and the verdict "5 of 6"; this script
    will not print "all six gates pass" when it ran five

Exit codes:
  0  all gates run passed
  1  at least one gate failed (a real red -- the tree is not shippable)
  2  the run could not be trusted (unreadable summary, no tests collected,
     timeout, or missing node_modules)
"""

from __future__ import annotations

import argparse
import os
import pathlib
import re
import subprocess
import sys

# ---------------------------------------------------------------------------
# Summary-line parsing.
#
# The whole LINE is parsed, not one "N passed" island inside it. Vitest prints
# exactly one of each, and the total in parentheses is the number to trust --
# a focused run in which every matched test fails prints no "passed" segment at
# all:
#
#     Test Files  83 passed (83)
#     Test Files  1 failed | 82 passed (83)
#     Tests  2162 passed (2162)
#     Tests  1 failed | 2161 passed (2162)
#     Tests  1 failed | 69 skipped (70)        <- no "passed" segment
#
# mutation-replay's parser learned this the hard way (T612): requiring a
# "passed" segment scored a genuinely red run as zero and told the agent to
# throw away real evidence. Same rule here -- read the total, report what you
# cannot read.
# ---------------------------------------------------------------------------

ANSI = re.compile(r"\x1b\[[0-9;]*m")

TEST_FILES_LINE = re.compile(r"^\s*Test Files\s+(?P<body>.+?)\s*$", re.MULTILINE)
TESTS_LINE = re.compile(r"^\s*Tests\s+(?P<body>.+?)\s*$", re.MULTILINE)
TOTAL_IN_PARENS = re.compile(r"\((\d+)\)\s*$")
FAILED_SEGMENT = re.compile(r"(\d+)\s+failed")

# eslint's own tally, e.g. "✖ 377 problems (0 errors, 377 warnings)".
ESLINT_TALLY = re.compile(r"(\d+)\s+errors?,\s*(\d+)\s+warnings?")


class Unreadable(Exception):
    """Raised when output exists but this script cannot honestly interpret it."""


def strip_ansi(text: str) -> str:
    return ANSI.sub("", text)


def parse_vitest(output: str) -> tuple[int, int, int]:
    """Return (test_files_total, tests_total, tests_failed).

    Raises Unreadable rather than guessing. A run with no summary at all --
    a crash during collection, for instance -- must not be scored as zero
    tests passing.
    """
    clean = strip_ansi(output)

    files_match = TEST_FILES_LINE.search(clean)
    tests_match = TESTS_LINE.search(clean)
    if not files_match or not tests_match:
        raise Unreadable(
            "no vitest summary found: expected a 'Test Files' line and a "
            "'Tests' line, got neither or only one"
        )

    files_body = files_match.group("body")
    tests_body = tests_match.group("body")

    files_total = TOTAL_IN_PARENS.search(files_body)
    tests_total = TOTAL_IN_PARENS.search(tests_body)
    if not files_total or not tests_total:
        raise Unreadable(
            f"vitest summary present but the total is missing: "
            f"Test Files {files_body!r} / Tests {tests_body!r}"
        )

    failed = FAILED_SEGMENT.search(tests_body)
    return (
        int(files_total.group(1)),
        int(tests_total.group(1)),
        int(failed.group(1)) if failed else 0,
    )


def parse_eslint(output: str) -> tuple[int, int]:
    """Return (errors, warnings).

    A clean eslint run prints nothing at all, which is 0/0 -- that is an
    absence of output, not an unreadable one, so it is not a refusal.
    """
    clean = strip_ansi(output).strip()
    if not clean:
        return (0, 0)
    tally = ESLINT_TALLY.search(clean)
    if not tally:
        raise Unreadable(
            "eslint produced output but no '(N errors, M warnings)' tally; "
            "refusing to guess whether those lines were errors"
        )
    return (int(tally.group(1)), int(tally.group(2)))


# ---------------------------------------------------------------------------
# Gate execution
# ---------------------------------------------------------------------------

PASS, FAIL, SKIP, UNTRUSTED = "PASS", "FAIL", "SKIP", "UNTRUSTED"


class Gate:
    def __init__(self, number: int, name: str, argv: list[str] | None):
        self.number = number
        self.name = name
        self.argv = argv
        self.status = SKIP
        self.exit_code: int | None = None
        self.detail = ""
        self.note = ""

    @property
    def label(self) -> str:
        return f"{self.number} {self.name}"


def run(argv: list[str], cwd: pathlib.Path, timeout: int) -> subprocess.CompletedProcess:
    """Run a command and hand back its own exit status.

    No shell, no pipe: `subprocess.run` returns the child's status directly,
    which is the single property this whole script exists to preserve.
    """
    return subprocess.run(
        argv,
        cwd=str(cwd),
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def common_scope(changed_paths: list[str]) -> str | None:
    """Deepest directory containing every changed `src/` file, or None.

    None means "no scope I can defend": the change touches nothing under
    `src/`, or it spans unrelated trees so the only shared prefix is `src/`
    itself -- which is the full suite again, not a scoped run. Gate 6 is then
    reported SKIPPED, because running a path nobody chose produces a number
    nobody can interpret.
    """
    dirs = [
        pathlib.PurePosixPath(line).parent
        for line in changed_paths
        if line.startswith("src/")
    ]
    if not dirs:
        return None

    # Truncate at the first mismatch rather than filtering matches out of the
    # middle: src/pages/home and src/lib/home share only `src`, and a filter
    # that kept both `src` and `home` would invent a path that exists nowhere.
    common = dirs[0].parts
    for d in dirs[1:]:
        prefix: list[str] = []
        for a, b in zip(common, d.parts):
            if a != b:
                break
            prefix.append(a)
        common = tuple(prefix)
        if not common:
            return None

    if common == ("src",):
        return None
    return "/".join(common) + "/"


def derive_scope(cwd: pathlib.Path, base: str) -> str | None:
    """Ask git what changed, then hand it to `common_scope`."""
    try:
        result = run(["git", "diff", "--name-only", f"{base}...HEAD"], cwd, 120)
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return None
    if result.returncode != 0:
        return None
    return common_scope(result.stdout.splitlines())


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run the six verification gates and print one evidence block."
    )
    parser.add_argument(
        "--scope",
        help="Gate 6's scoped test path, e.g. src/pages/home/. Taken from the "
        "task packet when it names one. Omit to derive it from the diff.",
    )
    parser.add_argument(
        "--base",
        default="origin/main",
        help="Merge base used to derive --scope when it is not given "
        "(default: origin/main).",
    )
    parser.add_argument(
        "--baseline-tests",
        type=int,
        help="Full-suite test count this branch started from. A count below it "
        "means tests disappeared and fails the gate.",
    )
    parser.add_argument(
        "--baseline-scoped",
        type=int,
        help="Scoped test count this branch started from.",
    )
    parser.add_argument(
        "--max-warnings",
        type=int,
        help="Fail gate 4 if eslint reports more warnings than this. Omit to "
        "report the count without judging it.",
    )
    parser.add_argument(
        "--fail-fast",
        action="store_true",
        help="Stop at the first failing gate. Off by default: a complete "
        "evidence block is worth more than a saved build.",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=1800,
        help="Per-gate timeout in seconds (default: 1800).",
    )
    parser.add_argument(
        "--cwd",
        default=".",
        help="Directory to run in. Point this at a worktree to gate that "
        "checkout rather than the shared tree.",
    )
    args = parser.parse_args()

    cwd = pathlib.Path(args.cwd).resolve()
    if not cwd.is_dir():
        print(f"UNTRUSTWORTHY: --cwd {cwd} is not a directory", file=sys.stderr)
        return 2

    if not (cwd / "node_modules").is_dir():
        print(
            f"UNTRUSTWORTHY: {cwd}/node_modules is missing. Run `npm ci` first.\n"
            "A fresh worktree has no dependencies, and gates run against one "
            "fail for reasons that have nothing to do with the change.",
            file=sys.stderr,
        )
        return 2

    # Anchor the evidence to a commit. A gate result with no SHA cannot be
    # checked by anyone later, which is the whole point of recording it.
    head = run(["git", "rev-parse", "--short", "HEAD"], cwd, 60)
    branch = run(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd, 60)
    porcelain = run(["git", "status", "--porcelain"], cwd, 60)
    sha = head.stdout.strip() or "unknown"
    branch_name = branch.stdout.strip() or "unknown"
    dirty = bool(porcelain.stdout.strip())

    scope = args.scope or derive_scope(cwd, args.base)
    scope_derived = args.scope is None and scope is not None

    gates = [
        Gate(1, "tsc", ["npx", "tsc", "--noEmit"]),
        Gate(2, "vite build", ["npx", "vite", "build"]),
        Gate(3, "format:check", ["npm", "run", "format:check"]),
        Gate(4, "eslint", ["npx", "eslint", "."]),
        Gate(5, "vitest (full)", ["npx", "vitest", "run"]),
        Gate(6, f"vitest {scope}" if scope else "vitest (scoped)",
             ["npx", "vitest", "run", scope] if scope else None),
    ]

    untrusted = False

    for gate in gates:
        if gate.argv is None:
            gate.note = (
                "no scope given and none derivable from the diff -- pass "
                "--scope <path> to run it"
            )
            continue

        try:
            result = run(gate.argv, cwd, args.timeout)
        except subprocess.TimeoutExpired:
            gate.status = UNTRUSTED
            gate.note = f"timed out after {args.timeout}s"
            untrusted = True
            if args.fail_fast:
                break
            continue
        except FileNotFoundError as exc:
            gate.status = UNTRUSTED
            gate.note = f"command not found: {exc}"
            untrusted = True
            if args.fail_fast:
                break
            continue

        gate.exit_code = result.returncode
        combined = result.stdout + result.stderr

        if gate.number == 4:
            try:
                errors, warnings = parse_eslint(combined)
            except Unreadable as exc:
                gate.status, gate.note, untrusted = UNTRUSTED, str(exc), True
            else:
                gate.detail = f"{errors} errors, {warnings} warnings"
                over = (
                    args.max_warnings is not None and warnings > args.max_warnings
                )
                gate.status = PASS if (errors == 0 and not over) else FAIL
                if over:
                    gate.note = f"warnings exceed --max-warnings {args.max_warnings}"

        elif gate.number in (5, 6):
            try:
                files, tests, failed = parse_vitest(combined)
            except Unreadable as exc:
                gate.status, gate.note, untrusted = UNTRUSTED, str(exc), True
            else:
                gate.detail = f"{files} files / {tests} tests"
                baseline = (
                    args.baseline_tests if gate.number == 5 else args.baseline_scoped
                )
                if baseline is not None:
                    gate.detail += f"  baseline {baseline} ({tests - baseline:+d})"

                if files == 0 or tests == 0:
                    # A run that collected nothing exits 0. That is the failure
                    # mode a green tick hides, so it is a refusal, not a pass.
                    gate.status = UNTRUSTED
                    gate.note = "collected no tests -- a green exit here proves nothing"
                    untrusted = True
                elif result.returncode != 0 or failed:
                    gate.status = FAIL
                    if failed:
                        gate.note = f"{failed} failed"
                elif baseline is not None and tests < baseline:
                    gate.status = FAIL
                    gate.note = f"{baseline - tests} tests disappeared since baseline"
                else:
                    gate.status = PASS

        else:
            gate.status = PASS if result.returncode == 0 else FAIL

        if args.fail_fast and gate.status in (FAIL, UNTRUSTED):
            break

    # -----------------------------------------------------------------------
    # One evidence block, same shape every run, quotable straight into a log.
    # -----------------------------------------------------------------------
    ran = [g for g in gates if g.status != SKIP]
    failed_gates = [g for g in ran if g.status == FAIL]
    untrusted_gates = [g for g in ran if g.status == UNTRUSTED]
    skipped = [g for g in gates if g.status == SKIP]

    print(f"GATE RUN — {sha} on {branch_name} — tree {'DIRTY' if dirty else 'clean'}")
    if dirty:
        print("  (dirty tree: these numbers describe uncommitted work, not a commit)")
    if scope_derived:
        print(f"  (gate 6 scope derived from the diff against {args.base}: {scope})")
    print()

    width = max(len(g.label) for g in gates)
    for gate in gates:
        code = "    –" if gate.exit_code is None else f"exit {gate.exit_code}"
        line = f"  {gate.label:<{width}}  {code}  {gate.status:<9}  {gate.detail}"
        print(line.rstrip())
        if gate.note:
            print(f"  {'':<{width}}         {gate.note}")

    print()
    if untrusted_gates:
        verdict = (
            f"UNTRUSTWORTHY — {len(untrusted_gates)} gate(s) could not be read. "
            "Do not record these numbers as evidence."
        )
        exit_code = 2
    elif failed_gates:
        verdict = f"FAIL — {len(failed_gates)} of {len(ran)} gate(s) red"
        exit_code = 1
    elif skipped:
        verdict = f"PASS — {len(ran)} of 6 gates. NOT all six: {len(skipped)} skipped."
        exit_code = 0
    else:
        verdict = "PASS — all six gates exit 0"
        exit_code = 0

    print(f"VERDICT: {verdict}")
    return 2 if untrusted else exit_code


if __name__ == "__main__":
    sys.exit(main())
