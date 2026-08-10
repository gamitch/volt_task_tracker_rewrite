#!/usr/bin/env python3
"""Run this repo's six verification gates in one pass and print one evidence block.

Every gate's exit code is captured from the process itself, never from a pipe.
`npx vitest run | tail -5` reports tail's exit status, not vitest's, so a suite
that fails prints a green 0 -- that is why the run logs say "exit codes asserted
directly, not through a pipe", and why this script uses subprocess argument
lists with no shell in between.

Refuses to report a result it cannot stand behind:
  - a summary line this script cannot read is reported as unreadable, never
    silently counted as zero
  - a vitest run that collected zero files or zero tests is not evidence,
    however green its exit code (see the note on reachability below)
  - eslint exiting non-zero with no errors in its tally failed for a non-lint
    reason, and says nothing about the code
  - a gate that timed out is untrustworthy, not failed
  - a missing scope leaves gate 6 SKIPPED and the verdict "5 of 6"; this script
    will not print "all six gates pass" when it ran five
  - a dirty tree under --require-clean, because gates on uncommitted work do
    not describe the commit they would name

On the zero-collected branch, measured rather than assumed: vitest 3.2.7 in
this repo exits **1** on an empty match ("No test files found, exiting with
code 1") and prints no summary at all, so a bogus scope is caught by the
unreadable-summary refusal and the exit code. `passWithNoTests` is not set
anywhere in the config. The files==0/tests==0 branch is therefore insurance
against someone setting it -- which flips an empty run to exit 0 -- and not
the mechanism that catches a wrong --scope today. It is kept deliberately;
the earlier claim that an empty run "exits 0" here was wrong.

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


def eslint_verdict(
    returncode: int, errors: int, warnings: int, max_warnings: int | None
) -> tuple[str, str]:
    """Decide gate 4 from the process status *and* the tally. Returns (status, note).

    eslint's contract: 0 when the run was clean or found only warnings, 1 when
    it found lint errors, 2 when eslint itself failed (bad config, missing
    plugin, unresolvable import). The tally alone cannot tell those apart --
    an eslint that dies before printing anything parses as (0, 0), which would
    read as a pass.

    That was the one place this script ignored the exit code it exists to
    preserve, so it is decided here rather than inline: a non-zero status with
    no errors in the tally means eslint failed for a reason that has nothing
    to do with the code, and an agent must not record it as a clean gate.
    """
    # Exit 2 is eslint saying *it* failed, not that the code did. Checked before
    # the tally: whatever numbers accompany a fatal config error describe an
    # aborted run, and reporting FAIL would send someone looking for lint errors
    # that were never really counted.
    if returncode == 2:
        return UNTRUSTED, (
            "eslint exited 2 -- its contract for a configuration or internal "
            "failure, not a lint result. Any tally printed alongside it "
            "describes an aborted run"
        )
    if returncode != 0 and errors == 0:
        return UNTRUSTED, (
            f"eslint exited {returncode} with no errors in its tally -- it "
            "failed for a non-lint reason, so this says nothing about the code"
        )
    if errors:
        return FAIL, ""
    if max_warnings is not None and warnings > max_warnings:
        return FAIL, f"warnings exceed --max-warnings {max_warnings}"
    return PASS, ""


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


def porcelain_paths(porcelain: str) -> list[str]:
    """Paths out of `git status --porcelain`, renames resolved to their target.

    Format is `XY path`, or `XY old -> new` for a rename. Taking the target of
    a rename matters: gate 6 must test where the code lives now, not where it
    used to.
    """
    paths = []
    for line in porcelain.splitlines():
        if len(line) < 4:
            continue
        path = line[3:].strip().strip('"')
        if " -> " in path:
            path = path.split(" -> ")[-1].strip().strip('"')
        paths.append(path)
    return paths


def derive_scope(cwd: pathlib.Path, base: str, porcelain: str) -> str | None:
    """Ask git what changed -- committed *and* uncommitted -- then scope it.

    `base...HEAD` sees only commits, but dirty runs are explicitly supported,
    so a scope derived from commits alone can send gate 6 at a directory the
    current edits are not in. Uncommitted paths are folded in for that reason.

    Raises Unreadable when git itself fails: an invalid --base is a broken
    request, not an absent scope, and the two must not produce the same
    quiet SKIPPED.
    """
    try:
        result = run(["git", "diff", "--name-only", f"{base}...HEAD"], cwd, 120)
    except (subprocess.TimeoutExpired, FileNotFoundError) as exc:
        raise Unreadable(f"could not run git diff against {base}: {exc}") from exc
    if result.returncode != 0:
        raise Unreadable(
            f"git diff against {base} failed (exit {result.returncode}): "
            f"{result.stderr.strip() or 'no stderr'}"
        )
    return common_scope(result.stdout.splitlines() + porcelain_paths(porcelain))


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
        "--require-clean",
        action="store_true",
        help="Refuse to report on a dirty tree. Use it for the pre-PR run and "
        "for a checker's run, where the claim is about a commit.",
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
    #
    # Every one of these is checked for failure, because the first version of
    # this script read only their stdout. `git status` failing left stdout
    # empty, `dirty` computed to False, and --require-clean -- the guard added
    # to enforce item 21 -- passed a tree it had never inspected. Running it in
    # a directory that was not a git repository at all printed "tree clean".
    #
    # That is an absence of evidence read as evidence of absence, the failure
    # family this project keeps hitting. A safety flag that disarms when the
    # environment is broken is worse than no flag, because it reads as checked.
    provenance = {
        "git rev-parse --short HEAD": run(
            ["git", "rev-parse", "--short", "HEAD"], cwd, 60
        ),
        "git rev-parse --abbrev-ref HEAD": run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd, 60
        ),
        "git status --porcelain": run(["git", "status", "--porcelain"], cwd, 60),
    }
    broken = {
        cmd: result.returncode
        for cmd, result in provenance.items()
        if result.returncode != 0
    }
    if broken:
        detail = "\n".join(f"  {cmd} -> exit {code}" for cmd, code in broken.items())
        print(
            "UNTRUSTWORTHY: cannot establish git provenance, so no result here "
            "could be anchored to a commit:\n" + detail + "\n"
            "Gates were not run. Check that --cwd is inside a git repository.",
            file=sys.stderr,
        )
        return 2

    head, branch, porcelain = provenance.values()
    sha = head.stdout.strip() or "unknown"
    branch_name = branch.stdout.strip() or "unknown"
    dirty = bool(porcelain.stdout.strip())

    # Item 21: "clean" and "committed" are different claims, and T142 is the
    # recorded case of work that was real, measured, and entirely uncommitted.
    # Gates on a dirty tree describe the working directory, not the commit
    # anyone will merge or review -- so a run that is about to become a verdict
    # refuses rather than printing a SHA its numbers do not describe. Left
    # advisory by default because mid-work runs are legitimate and frequent.
    #
    # The remedy deliberately does not mention `git stash`: AGENTS.md forbids it
    # in this repository, and a tool meant to enforce the rules must not advise
    # breaking one.
    if dirty and args.require_clean:
        print(
            f"UNTRUSTWORTHY: working tree is dirty at {sha} and --require-clean "
            "was given. These gates would describe uncommitted work while "
            "naming a commit.\n"
            "Commit your own changes, or gate a clean dedicated worktree with "
            "--cwd. Do not `git stash` -- AGENTS.md forbids it here, and "
            "pre-existing changes must be preserved.\n"
            + porcelain.stdout.rstrip(),
            file=sys.stderr,
        )
        return 2

    try:
        scope = args.scope or derive_scope(cwd, args.base, porcelain.stdout)
    except Unreadable as exc:
        print(
            f"UNTRUSTWORTHY: {exc}\n"
            "A --base that git cannot resolve is a broken request, not an "
            "absent scope. Gates were not run.",
            file=sys.stderr,
        )
        return 2
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
                gate.status, gate.note = eslint_verdict(
                    result.returncode, errors, warnings, args.max_warnings
                )
                if gate.status == UNTRUSTED:
                    untrusted = True

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
                else:
                    # Say so. A count with no baseline is a number, not a
                    # regression check, and a block that shows only the number
                    # reads as though the check ran and passed.
                    gate.detail += "  (no baseline given — regression not checked)"

                if files == 0 or tests == 0:
                    # Insurance, not today's mechanism: vitest here exits 1 on
                    # an empty match and prints no summary, so this branch is
                    # reached only if someone sets passWithNoTests, which flips
                    # an empty run to a green exit that proves nothing.
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
