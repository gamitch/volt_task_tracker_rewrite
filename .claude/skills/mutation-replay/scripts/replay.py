#!/usr/bin/env python3
"""Apply one mutation, run a test command, report whether it reddened, always revert.

Refuses to report a result it cannot stand behind:
  - the anchor must actually appear (and be unique in its search range)
  - the mutated text must differ from the original
  - the test run must actually execute tests (a run that skips everything is
    not evidence, however green its exit code)

Exit codes:
  0  the mutation reddened the tests  (the guard is real)
  1  the mutation left the tests green (a FINDING -- the guard does not exist)
  2  the replay could not be trusted   (anchor missing/ambiguous, no tests ran)
"""

from __future__ import annotations

import argparse
import pathlib
import re
import subprocess
import sys

# Vitest/Jest-style summary lines. Both "N passed" and "N failed | M passed".
COUNT_RE = re.compile(r"Tests\s+(?:(\d+)\s+failed\s*\|\s*)?(\d+)\s+passed", re.I)
SKIPPED_RE = re.compile(r"(\d+)\s+skipped", re.I)


def die(msg: str) -> "typing.NoReturn":  # noqa: F821
    """Exit 2. `sys.exit(str)` exits 1, which would be indistinguishable from a finding."""
    print(f"UNTRUSTWORTHY: {msg}", file=sys.stderr)
    raise SystemExit(2)


def run(cmd: str, cwd: pathlib.Path) -> tuple[int, str]:
    p = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
    return p.returncode, p.stdout + p.stderr


def counts(out: str) -> tuple[int, int, int]:
    """Return (failed, passed, skipped) parsed from a test summary."""
    m = COUNT_RE.search(out)
    failed = int(m.group(1)) if m and m.group(1) else 0
    passed = int(m.group(2)) if m else 0
    s = SKIPPED_RE.search(out)
    return failed, passed, int(s.group(1)) if s else 0


def slice_bounds(text: str, start_marker: str | None, end_marker: str | None) -> tuple[int, int]:
    """Character range to confine the replacement to. Defaults to the whole file."""
    if not start_marker:
        return 0, len(text)
    i = text.find(start_marker)
    if i == -1:
        die(f"--start-marker not found: {start_marker[:70]!r}")
    j = text.find(end_marker, i + len(start_marker)) if end_marker else -1
    return i, (j + len(end_marker)) if j != -1 else len(text)


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
    bf, bp, bs = counts(base_out)
    print(f"  exit={base_rc}  failed={bf} passed={bp} skipped={bs}")

    if bp + bf == 0:
        print("\nUNTRUSTWORTHY: the baseline ran no tests. A command that matches nothing")
        print("exits 0 and proves nothing. Fix the test selector before replaying.")
        return 2
    if base_rc != 0:
        print("\nUNTRUSTWORTHY: the baseline is already failing. Get to green first --")
        print("otherwise you cannot tell which failure your mutation caused.")
        return 2

    try:
        target.write_text(original[:lo] + region.replace(args.old, args.new, 1) + original[hi:])
        print(f"\n[mutated] {label}")
        rc, out = run(args.test, cwd)
        f, p, s = counts(out)
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
