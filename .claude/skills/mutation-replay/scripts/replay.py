#!/usr/bin/env python3
"""Apply one mutation, run a test command, report whether it reddened, always revert.

Refuses to report a result it cannot stand behind:
  - the anchor must actually appear (and be unique in its search range)
  - the mutated text must differ from the original
  - the test run must actually execute tests (a run that skips everything is
    not evidence, however green its exit code)
  - the summary line must be readable; an output this script cannot parse is
    reported as unparsable, never silently counted as zero (vitest, Jest,
    unittest and pytest shapes are read, each on its own anchored line)

Exit codes:
  0  the mutation reddened the tests  (the guard is real)
  1  the mutation left the tests green (a FINDING -- the guard does not exist)
  2  the replay could not be trusted   (anchor missing/ambiguous, no tests ran,
     or a summary line this script cannot read)
"""

from __future__ import annotations

import argparse
import pathlib
import re
import subprocess
import sys

# The whole summary LINE is parsed, not one "N passed" island inside it.
# Vitest and Jest both print exactly one, in these shapes:
#
#   vitest        Tests  2 passed | 68 skipped (70)
#   vitest        Tests  1 failed | 69 skipped (70)      <- no "passed" segment
#   jest     Tests:       1 failed, 55 passed, 56 total
#
# T612, measured not imagined: the previous regex REQUIRED a "N passed"
# segment, so a focused `-t` run in which every matched test failed parsed as
# failed=0 passed=0 -- and this script then reported a genuinely red replay as
# "the mutated run executed no tests", the one verdict that tells an agent to
# throw its evidence away. Anything unreadable now says so out loud (item 2 of
# the module docstring's refusal list) instead of being counted as zero.
SUMMARY_LINE_RE = re.compile(
    r"^[^\S\n]*Tests(?:[^\S\n]*:[^\S\n]*|[^\S\n]{2,})(?P<body>\S[^\n]*)$", re.M
)
SEGMENT_RE = re.compile(r"^(\d+)\s+(passed|failed|skipped|todo|pending|total)$", re.I)
DECLARED_TOTAL_RE = re.compile(r"\((\d+)\)$")
ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")

# GAM-309: the two Python runners get their own anchored patterns rather than a
# loosened version of the one above. Dropping the `Tests` label anchor to reach
# `19 passed in 0.18s` would also match arbitrary prose in a stack trace, and a
# summary read half-right is the whole reason T612 exists.
#
# unittest splits what vitest puts on one line across two, and names only the
# buckets that are NOT plain passes -- so `passed` is never printed:
#
#   Ran 19 tests in 0.177s        <- `Ran 1 test` is singular
#                                    (blank line)
#   OK
#   OK (skipped=1, expected failures=1)
#   FAILED (failures=1, errors=1, skipped=1, expected failures=1, unexpected successes=1)
#
# Deriving `passed` by subtraction IS this shape's cross-check, standing in for
# the declared total vitest gives us: buckets that exceed the run's own total
# leave a negative remainder and are refused. The five keys are the complete
# vocabulary of CPython's `unittest/runner.py`, read from the source rather than
# recalled; any sixth raises instead of being stepped over.
UNITTEST_TOTAL_RE = re.compile(r"^[^\S\n]*Ran (?P<total>\d+) tests? in \d+\.\d+s[^\S\n]*$", re.M)
UNITTEST_VERDICT_RE = re.compile(
    r"^[^\S\n]*(?P<verdict>OK|FAILED)(?:[^\S\n]+\((?P<body>[^)\n]*)\))?[^\S\n]*$", re.M
)
UNITTEST_SEGMENT_RE = re.compile(
    r"^(failures|errors|skipped|expected failures|unexpected successes)=(\d+)$"
)
# An unexpected success is what CPython fails the run over, so it counts as
# failing here too -- the rule throughout is to follow the runner's own verdict.
# `expected failures` are neither failed nor skipped: they executed and left the
# run green, so subtraction lands them in `passed`, which is where they belong.
UNITTEST_FAILED_KEYS = ("failures", "errors", "unexpected successes")

# pytest declares no total at all, so the cross-check above has nothing to check
# against. Deliberate decision (the question GAM-309 raised): accept the shape,
# and make exhaustiveness the guard instead of arithmetic. The WHOLE line must
# be comma-separated `<int> <word>` parts followed by a duration, and every word
# must be in the closed vocabulary below -- so no segment can be silently
# dropped, which is the specific failure T612 punished. One unknown word refuses
# the line.
#
#   ============= 1 failed, 1 passed, 1 deselected, 1 warning in 0.02s =============
#   3 failed, 2 passed, 1 skipped, 1 xfailed in 0.03s   <- `-q` drops the `=` padding
#   ============================ no tests ran in 0.00s =============================
#   1 passed in 61.01s (0:01:01)                        <- >=60s appends the h:mm:ss
PYTEST_LINE_RE = re.compile(
    r"^[^\S\n]*(?:=+[^\S\n]+)?"
    r"(?P<body>no tests ran|\d+ [a-z]+(?:,[^\S\n]+\d+ [a-z]+)*)"
    r"[^\S\n]+in[^\S\n]+\d+\.\d+s(?:[^\S\n]+\([^)\n]*\))?"
    r"(?:[^\S\n]+=+)?[^\S\n]*$",
    re.M,
)
PYTEST_SEGMENT_RE = re.compile(r"^(\d+) ([a-z]+)$")
# `xfailed` and `xpassed` executed and left the run green, so they count as
# passed; a *strict* xpass needs no special case because pytest itself reports
# it as `failed`. `deselected` never ran. Warnings are not test outcomes at all
# and must be recognised-and-ignored rather than refused -- otherwise an
# ordinary run carrying one deprecation warning becomes unreplayable.
PYTEST_FAILED_KEYS = ("failed", "error", "errors")
PYTEST_PASSED_KEYS = ("passed", "xpassed", "xfailed")
PYTEST_SKIPPED_KEYS = ("skipped", "deselected")
PYTEST_IGNORED_KEYS = ("warning", "warnings")


class SummaryParseError(Exception):
    """The output holds no test summary this script is willing to read."""


def die(msg: str) -> "typing.NoReturn":  # noqa: F821
    """Exit 2. `sys.exit(str)` exits 1, which would be indistinguishable from a finding."""
    print(f"UNTRUSTWORTHY: {msg}", file=sys.stderr)
    raise SystemExit(2)


def run(cmd: str, cwd: pathlib.Path) -> tuple[int, str]:
    p = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
    return p.returncode, p.stdout + p.stderr


def parse_summary_body(body: str) -> tuple[int, int, int]:
    """Return (failed, passed, skipped) from the text after `Tests`/`Tests:`.

    Raises SummaryParseError on anything it does not fully understand -- a
    partially-read summary is what produced T612's confident wrong verdict.
    """
    body = body.strip()
    declared_total = None
    m = DECLARED_TOTAL_RE.search(body)
    if m:
        declared_total = int(m.group(1))
        body = body[: m.start()].strip()

    seen: dict[str, int] = {}
    for segment in re.split(r"[|,]", body):
        segment = segment.strip()
        if not segment:
            continue
        sm = SEGMENT_RE.match(segment)
        if not sm:
            raise SummaryParseError(f"unreadable segment {segment!r} in summary {body!r}")
        key = sm.group(2).lower()
        if key in seen:
            raise SummaryParseError(f"{key!r} counted twice in summary {body!r}")
        seen[key] = int(sm.group(1))

    if not seen:
        raise SummaryParseError(f"no test counts in summary {body!r}")

    failed = seen.get("failed", 0)
    passed = seen.get("passed", 0)
    skipped = seen.get("skipped", 0) + seen.get("todo", 0) + seen.get("pending", 0)

    total = declared_total if declared_total is not None else seen.get("total")
    if total is not None and failed + passed + skipped != total:
        raise SummaryParseError(
            f"segments sum to {failed + passed + skipped} but the line declares {total} "
            f"in summary {body!r} -- a shape this script does not fully understand"
        )
    return failed, passed, skipped


def vitest_counts(text: str) -> tuple[int, int, int]:
    """(failed, passed, skipped) off a vitest/Jest `Tests  ...` line."""
    bodies = SUMMARY_LINE_RE.findall(text)
    if not bodies:
        raise SummaryParseError("no vitest/Jest summary line (`Tests  ...`) in the output")
    reasons: list[str] = []
    # Last first: the real summary is printed after any test output that may
    # happen to contain a `Tests ...` line of its own.
    for body in reversed(bodies):
        try:
            return parse_summary_body(body)
        except SummaryParseError as exc:
            reasons.append(str(exc))
    raise SummaryParseError("; ".join(dict.fromkeys(reasons)))


def unittest_counts(text: str) -> tuple[int, int, int]:
    """(failed, passed, skipped) off unittest's two-line summary.

    The total and the outcome live on different lines, so both must be found
    and then reconciled -- reading either one alone would be the half-read
    summary this parser exists to refuse.
    """
    totals = list(UNITTEST_TOTAL_RE.finditer(text))
    if not totals:
        raise SummaryParseError("no unittest summary line (`Ran N tests in ...`) in the output")
    total_line = totals[-1]  # last wins, for the same reason vitest's does
    total = int(total_line.group("total"))

    verdict_line = UNITTEST_VERDICT_RE.search(text, total_line.end())
    if verdict_line is None:
        raise SummaryParseError(
            f"unittest printed {total_line.group().strip()!r} with no OK/FAILED line after it"
        )

    seen: dict[str, int] = {}
    for segment in (verdict_line.group("body") or "").split(","):
        segment = segment.strip()
        if not segment:
            continue
        sm = UNITTEST_SEGMENT_RE.match(segment)
        if not sm:
            raise SummaryParseError(f"unreadable unittest segment {segment!r}")
        if sm.group(1) in seen:
            raise SummaryParseError(f"{sm.group(1)!r} counted twice by unittest")
        seen[sm.group(1)] = int(sm.group(2))

    failed = sum(seen.get(key, 0) for key in UNITTEST_FAILED_KEYS)
    skipped = seen.get("skipped", 0)
    if (verdict_line.group("verdict") == "FAILED") != (failed > 0):
        raise SummaryParseError(
            f"unittest said {verdict_line.group().strip()!r}, which this script reads as "
            f"{failed} failing -- a shape it does not fully understand"
        )

    passed = total - failed - skipped
    if passed < 0:
        raise SummaryParseError(
            f"unittest's own buckets in {verdict_line.group().strip()!r} exceed the "
            f"{total} test(s) it says it ran"
        )
    return failed, passed, skipped


def pytest_counts(text: str) -> tuple[int, int, int]:
    """(failed, passed, skipped) off pytest's one-line summary."""
    bodies = PYTEST_LINE_RE.findall(text)
    if not bodies:
        raise SummaryParseError("no pytest summary line (`N passed in 0.00s`) in the output")
    body = bodies[-1]  # last wins, for the same reason vitest's does
    if body == "no tests ran":
        return 0, 0, 0

    known = PYTEST_FAILED_KEYS + PYTEST_PASSED_KEYS + PYTEST_SKIPPED_KEYS + PYTEST_IGNORED_KEYS
    seen: dict[str, int] = {}
    for segment in body.split(","):
        sm = PYTEST_SEGMENT_RE.match(segment.strip())
        if not sm:
            raise SummaryParseError(f"unreadable pytest segment {segment.strip()!r}")
        key = sm.group(2)
        if key in seen:
            raise SummaryParseError(f"{key!r} counted twice in pytest summary {body!r}")
        if key not in known:
            raise SummaryParseError(f"unknown pytest outcome {key!r} in summary {body!r}")
        seen[key] = int(sm.group(1))

    def tally(keys: tuple[str, ...]) -> int:
        return sum(seen.get(key, 0) for key in keys)

    return tally(PYTEST_FAILED_KEYS), tally(PYTEST_PASSED_KEYS), tally(PYTEST_SKIPPED_KEYS)


def counts(out: str) -> tuple[int, int, int]:
    """Return (failed, passed, skipped) parsed from a test summary.

    Three runner shapes are recognised, each anchored on a whole line of its
    own and tried in turn. A reader that cannot find its shape says so and the
    next is tried; when none can, every reason is reported together and nothing
    is counted.
    """
    text = ANSI_RE.sub("", out)
    reasons: list[str] = []
    for reader in (vitest_counts, unittest_counts, pytest_counts):
        try:
            return reader(text)
        except SummaryParseError as exc:
            reasons.append(str(exc))
    raise SummaryParseError("; ".join(dict.fromkeys(reasons)))


def slice_bounds(text: str, start_marker: str | None, end_marker: str | None) -> tuple[int, int]:
    """Character range to confine the replacement to. Defaults to the whole file."""
    if not start_marker:
        return 0, len(text)
    i = text.find(start_marker)
    if i == -1:
        die(f"--start-marker not found: {start_marker[:70]!r}")
    j = text.find(end_marker, i + len(start_marker)) if end_marker else -1
    return i, (j + len(end_marker)) if j != -1 else len(text)


def counts_or_die(out: str, phase: str) -> tuple[int, int, int]:
    """Parse the summary, or refuse the whole replay. Never guess a count."""
    try:
        return counts(out)
    except SummaryParseError as exc:
        print(f"\n--- last 20 lines of the {phase} run ---")
        print("\n".join(out.splitlines()[-20:]))
        die(
            f"could not read the test counts of the {phase} run: {exc}. "
            "Refusing to guess -- a mis-read count here becomes a confident wrong "
            "verdict, which is worse than no verdict. Run the command by hand."
        )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", required=True, help="production file to mutate")
    ap.add_argument("--old", required=True, help="exact text to replace")
    ap.add_argument("--new", default="", help="replacement (default: delete)")
    ap.add_argument("--test", required=True, help="test command to run")
    ap.add_argument("--label", default="", help="what this mutation means")
    ap.add_argument("--start-marker", help="confine the replacement to a block starting here")
    ap.add_argument("--end-marker", help="...and ending here")
    ap.add_argument("--cwd", default=".", help="repo root (default: cwd)")
    args = ap.parse_args()

    cwd = pathlib.Path(args.cwd).resolve()
    target = (cwd / args.file).resolve()
    if not target.is_file():
        die(f"no such file: {target}")

    original = target.read_text()
    lo, hi = slice_bounds(original, args.start_marker, args.end_marker)
    region = original[lo:hi]

    n = region.count(args.old)
    if n == 0:
        die(f"anchor not found in range: {args.old[:70]!r}")
    if n > 1:
        die(
            f"anchor appears {n}x in range -- narrow it, or bound the region with "
            f"--start-marker/--end-marker so the edit cannot hit the wrong copy."
        )
    if args.old == args.new:
        die(f"--old and --new are identical; nothing would change.")

    label = args.label or f"{args.old[:40]!r} -> {args.new[:40]!r}"
    print(f"[baseline] {args.test}")
    base_rc, base_out = run(args.test, cwd)
    bf, bp, bs = counts_or_die(base_out, "baseline")
    print(f"  exit={base_rc}  failed={bf} passed={bp} skipped={bs}")

    if bp + bf == 0:
        print(f"\nUNTRUSTWORTHY: the baseline ran no tests ({bs} skipped). A command that")
        print("matches nothing exits 0 and proves nothing. Fix the test selector before")
        print("replaying.")
        return 2
    if base_rc != 0:
        print("\nUNTRUSTWORTHY: the baseline is already failing. Get to green first --")
        print("otherwise you cannot tell which failure your mutation caused.")
        return 2

    try:
        target.write_text(original[:lo] + region.replace(args.old, args.new, 1) + original[hi:])
        print(f"\n[mutated] {label}")
        rc, out = run(args.test, cwd)
        f, p, s = counts_or_die(out, "mutated")
        print(f"  exit={rc}  failed={f} passed={p} skipped={s}")

        if p + f == 0:
            print("\nUNTRUSTWORTHY: the mutated run executed no tests (likely a build or")
            print("parse error from the edit). That is not the same as a red test.")
            print("\n".join(out.splitlines()[-15:]))
            return 2

        if p + f != bp + bf:
            print(f"\nNOTE: test count moved {bp + bf} -> {p + f}. Expect this only if the")
            print("mutation changes which tests are collected. Otherwise, be suspicious.")

        if rc != 0 and f > 0:
            print(f"\nREDDENED -- the guard is real. {f} test(s) failed.")
            for line in out.splitlines():
                if "AssertionError" in line or line.strip().startswith("→"):
                    print(f"  {line.strip()[:160]}")
            return 0

        print("\nSTILL GREEN -- this is a FINDING, not a pass.")
        print("The behaviour you mutated is not guarded by these tests. Either add the")
        print("missing test, or record plainly that it is unguarded. Do not move on")
        print("having 'confirmed' a criterion that cannot fail.")
        return 1
    finally:
        target.write_text(original)
        assert target.read_text() == original
        print("[reverted] working tree restored")


if __name__ == "__main__":
    sys.exit(main())
