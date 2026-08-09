#!/usr/bin/env python3
"""Tests for `replay.py`'s summary parser and its three verdicts.

T612. The parser is the part of this skill that decides whether an agent
believes its own evidence, and it shipped for weeks reading a genuinely red
focused run as "executed no tests". Every summary line asserted below was
captured from a real `npx vitest run` in this repository (vitest 3.2.7,
`src/pages/meetings/ScheduleMeetingsDialog.test.tsx`, 70 tests) rather than
written from memory -- the defect existed precisely because the shape was
imagined instead of measured.

    python3 .claude/skills/mutation-replay/scripts/test_replay.py
"""

from __future__ import annotations

import pathlib
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from replay import SummaryParseError, counts  # noqa: E402

REPLAY = pathlib.Path(__file__).resolve().parent / "replay.py"


class SummaryParsing(unittest.TestCase):
    """(failed, passed, skipped) read off real runner output."""

    def test_focused_run_where_every_matched_test_failed(self):
        """The T612 regression itself: a red focused run has no `passed` segment.

        Captured from `npx vitest run ScheduleMeetingsDialog.test.tsx
        -t 'opens prefilled from initialData'` with the disclosure string
        mutated -- exit=1, one real AssertionError.
        """
        out = " Test Files  1 failed (1)\n      Tests  1 failed | 69 skipped (70)\n"
        self.assertEqual(counts(out), (1, 0, 69))

    def test_focused_run_green(self):
        out = " Test Files  1 passed (1)\n      Tests  1 passed | 69 skipped (70)\n"
        self.assertEqual(counts(out), (0, 1, 69))

    def test_focused_run_mixed(self):
        out = "      Tests  1 failed | 1 passed | 68 skipped (70)\n"
        self.assertEqual(counts(out), (1, 1, 68))

    def test_selector_matched_nothing(self):
        """`-t` with no match: everything skipped, exit 0. Must stay readable
        as 0 executed, because that is the real "ran no tests" case."""
        out = " Test Files  1 skipped (1)\n      Tests  70 skipped (70)\n"
        self.assertEqual(counts(out), (0, 0, 70))

    def test_whole_suite(self):
        out = " Test Files  75 passed (75)\n      Tests  1821 passed (1821)\n"
        self.assertEqual(counts(out), (0, 1821, 0))

    def test_whole_suite_with_failures(self):
        out = "      Tests  2 failed | 1819 passed (1821)\n"
        self.assertEqual(counts(out), (2, 1819, 0))

    def test_todo_counts_as_not_executed(self):
        out = "      Tests  1 passed | 2 todo | 67 skipped (70)\n"
        self.assertEqual(counts(out), (0, 1, 69))

    def test_jest_shape(self):
        """The module docstring has always claimed Jest support; before T612
        the regex could not match a `Tests:` line at all."""
        out = "Tests:       1 failed, 55 passed, 56 total\n"
        self.assertEqual(counts(out), (1, 55, 0))

    def test_colour_codes_are_stripped(self):
        out = "      Tests  \x1b[31m1 failed\x1b[39m | \x1b[2m69 skipped\x1b[22m (70)\n"
        self.assertEqual(counts(out), (1, 0, 69))

    def test_last_summary_line_wins(self):
        """A test's own stdout can print something summary-shaped; the runner's
        real line is the one at the end."""
        out = (
            "stdout | some.test.ts\n"
            "  Tests  9 passed (9)\n"
            "      Tests  1 failed | 69 skipped (70)\n"
        )
        self.assertEqual(counts(out), (1, 0, 69))


class SummaryRefusals(unittest.TestCase):
    """Unreadable output must raise, never quietly count as zero."""

    def test_no_summary_line_at_all(self):
        out = "No test files found, exiting with code 1\n"
        with self.assertRaises(SummaryParseError):
            counts(out)

    def test_segments_that_do_not_add_up(self):
        """A shape whose parts contradict its declared total is a shape this
        script does not understand -- exactly the T612 situation."""
        with self.assertRaises(SummaryParseError):
            counts("      Tests  1 failed | 2 skipped (70)\n")

    def test_unknown_segment(self):
        with self.assertRaises(SummaryParseError):
            counts("      Tests  1 exploded (1)\n")

    def test_prose_is_not_a_summary(self):
        with self.assertRaises(SummaryParseError):
            counts("      Tests  are currently disabled\n")


def fake_runner(green: str, red: str) -> str:
    """A `--test` command that reports `red` once the file carries the mutation."""
    return (
        f"if grep -q MUTANT widget.ts; then printf '%s\\n' '{red}'; exit 1; "
        f"else printf '%s\\n' '{green}'; exit 0; fi"
    )


class Verdicts(unittest.TestCase):
    """End-to-end: the three exit codes, and the revert, over the real script."""

    GREEN = "      Tests  1 passed | 69 skipped (70)"
    RED = "      Tests  1 failed | 69 skipped (70)"
    ORIGINAL = "export const guard = true;\n"

    def replay(self, test_cmd: str) -> tuple[subprocess.CompletedProcess[str], pathlib.Path]:
        tmp = pathlib.Path(tempfile.mkdtemp())
        widget = tmp / "widget.ts"
        widget.write_text(self.ORIGINAL)
        proc = subprocess.run(
            [
                sys.executable,
                str(REPLAY),
                "--cwd",
                str(tmp),
                "--file",
                "widget.ts",
                "--old",
                "true",
                "--new",
                "MUTANT",
                "--test",
                test_cmd,
            ],
            capture_output=True,
            text=True,
        )
        return proc, widget

    def test_red_focused_run_is_reddened_not_untrustworthy(self):
        proc, widget = self.replay(fake_runner(self.GREEN, self.RED))
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        self.assertIn("REDDENED", proc.stdout)
        self.assertNotIn("UNTRUSTWORTHY", proc.stdout + proc.stderr)
        self.assertEqual(widget.read_text(), self.ORIGINAL)

    def test_still_green_is_a_finding(self):
        proc, widget = self.replay(fake_runner(self.GREEN, self.GREEN))
        self.assertEqual(proc.returncode, 1, proc.stdout + proc.stderr)
        self.assertIn("STILL GREEN", proc.stdout)
        self.assertEqual(widget.read_text(), self.ORIGINAL)

    def test_mutated_run_that_executes_nothing_is_untrustworthy(self):
        skipped_all = "      Tests  70 skipped (70)"
        proc, widget = self.replay(fake_runner(self.GREEN, skipped_all))
        self.assertEqual(proc.returncode, 2, proc.stdout + proc.stderr)
        self.assertIn("executed no tests", proc.stdout)
        self.assertEqual(widget.read_text(), self.ORIGINAL)

    def test_unreadable_mutated_output_names_itself_and_reverts(self):
        proc, widget = self.replay(fake_runner(self.GREEN, "      Tests  banana"))
        self.assertEqual(proc.returncode, 2, proc.stdout + proc.stderr)
        self.assertIn("could not read the test counts of the mutated run", proc.stderr)
        self.assertEqual(widget.read_text(), self.ORIGINAL)

    def test_unreadable_baseline_output_stops_before_mutating(self):
        proc, widget = self.replay("echo 'No test files found, exiting with code 1'; exit 1")
        self.assertEqual(proc.returncode, 2, proc.stdout + proc.stderr)
        self.assertIn("could not read the test counts of the baseline run", proc.stderr)
        self.assertEqual(widget.read_text(), self.ORIGINAL)


if __name__ == "__main__":
    unittest.main(verbosity=2)
