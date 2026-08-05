#!/usr/bin/env python3
"""Resolve append-collision conflicts in shared append-only docs: keep both
sides, main's first.

Refuses to guess. If both sides of a conflict touch the same ledger row ID, that
is a real disagreement about one row -- not adjacency -- and it is left for a
human to merge cell by cell.

Exit codes:
  0  resolved (or nothing to do)
  1  a conflict needs manual attention; the file is left untouched
  2  bad input
"""

from __future__ import annotations

import argparse
import pathlib
import re
import subprocess
import sys

ROW_RE = re.compile(r"^\| (T\d+) \|")


def rows(lines: list[str]) -> set[str]:
    return {m.group(1) for line in lines if (m := ROW_RE.match(line))}


def blocks(lines: list[str]):
    """Yield (start, mid, end) indices for each conflict block."""
    starts = [i for i, l in enumerate(lines) if l.startswith("<<<<<<<")]
    for s in starts:
        m = next(i for i in range(s, len(lines)) if lines[i].startswith("======="))
        e = next(i for i in range(m, len(lines)) if lines[i].startswith(">>>>>>>"))
        yield s, m, e


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("file")
    ap.add_argument("--verify-rows", action="store_true",
                    help="after resolving, check no ledger row ID from main was lost")
    ap.add_argument("--base", default="origin/main", help="ref to compare rows against")
    args = ap.parse_args()

    path = pathlib.Path(args.file)
    if not path.is_file():
        print(f"no such file: {path}", file=sys.stderr)
        return 2

    lines = path.read_text().split("\n")
    found = list(blocks(lines))
    if not found:
        print("no conflict markers -- nothing to do")
        return 0

    # Refuse anything that is a genuine disagreement rather than adjacency.
    for s, m, e in found:
        ours, theirs = lines[s + 1 : m], lines[m + 1 : e]
        shared = rows(ours) & rows(theirs)
        if shared:
            print(f"MANUAL: both sides edit the same ledger row(s): {', '.join(sorted(shared))}")
            print("  This is a real conflict, not an append collision. Take the side that")
            print("  actually changed each row; if both did, merge the cells by hand.")
            print("  File left untouched.")
            return 1

    out, prev = [], 0
    for s, m, e in found:
        ours, theirs = lines[s + 1 : m], lines[m + 1 : e]
        out += lines[prev:s]
        out += theirs + ["", "---", ""] + ours   # main's side first
        prev = e + 1
        head = lambda blk: next((x for x in blk if x.startswith(("## ", "| T"))), "(untitled)")
        print(f"kept both: main={head(theirs)[:52]!r} + ours={head(ours)[:52]!r}")
    out += lines[prev:]

    if any(l.startswith(("<<<<<<<", "=======", ">>>>>>>")) for l in out):
        print("markers remain after resolution -- refusing to write", file=sys.stderr)
        return 1

    path.write_text("\n".join(out))
    print(f"resolved {len(found)} conflict block(s) in {path}")

    if args.verify_rows:
        try:
            base = subprocess.run(
                ["git", "show", f"{args.base}:{path.as_posix()}"],
                capture_output=True, text=True, check=True,
            ).stdout.split("\n")
        except subprocess.CalledProcessError:
            print(f"could not read {args.base}:{path} -- skipping row check")
            return 0
        lost = rows(base) - rows(out)
        if lost:
            print(f"LOST from {args.base}: {', '.join(sorted(lost))}", file=sys.stderr)
            return 1
        print(f"row check: no ledger row lost from {args.base} ({len(rows(base))} checked)")

    print("Now confirm YOUR entry survived too -- keeping main and dropping your own")
    print("work passes every check above and is still wrong.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
