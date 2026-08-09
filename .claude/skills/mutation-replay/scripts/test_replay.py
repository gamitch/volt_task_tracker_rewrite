#!/usr/bin/env python3
"""Tests for `replay.py`'s summary parser and its three verdicts.

T612. The parser is the part of this skill that decides whether an agent
believes its own evidence, and it shipped reading a genuinely red focused run
as "executed no tests". The summary shapes below were captured from real
`npx vitest run` output in this repository (vitest 3.2.7 --
`src/pages/meetings/ScheduleMeetingsDialog.test.tsx`, 70 tests, and the whole
suite at 83 files / 2153 tests) rather than written from memory; the two
multi-outcome cases recombine those measured shapes. The defect existed
precisely because the shape was imagined instead of measured.

GAM-309 added the `unittest` and `pytest` shapes on the same terms -- captured
from real runs rather than quoted from documentation. See `PythonRunnerParsing`.
Nothing here imports pytest: the fixtures are its output, so the `skill-scripts`
job stays standard-library-only.

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
        out = " Test Files  83 passed (83)\n      Tests  2153 passed (2153)\n"
        self.assertEqual(counts(out), (0, 2153, 0))

    def test_whole_suite_with_failures(self):
        out = "      Tests  2 failed | 2151 passed (2153)\n"
        self.assertEqual(counts(out), (2, 2151, 0))

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


class PythonRunnerParsing(unittest.TestCase):
    """GAM-309. The same, for the two Python runners.

    Every string below was captured from a real run in this container on
    2026-08-09 -- CPython 3.11.15's `unittest`, and pytest 9.1.1 installed in a
    throwaway venv purely to observe its output. None is quoted from
    documentation or memory, because that is how the shape got imagined wrong
    in T612. The 61-second case is real too: a `time.sleep(61)` test was run to
    watch pytest switch on the `(0:01:01)` suffix.

    unittest never prints `passed`, so it is derived by subtracting the buckets
    it does print from `Ran N tests` -- which doubles as the cross-check the
    vitest path gets from its declared total.
    """

    def test_unittest_all_green(self):
        """This repo's own `skill-scripts` job, before this change landed."""
        out = "----------------------------------------------------------------------\nRan 19 tests in 0.246s\n\nOK\n"
        self.assertEqual(counts(out), (0, 19, 0))

    def test_unittest_singular_test_and_failure(self):
        """`Ran 1 test` -- singular, per CPython's `run != 1 and "s" or ""`."""
        out = "Ran 1 test in 0.000s\n\nFAILED (failures=1)\n"
        self.assertEqual(counts(out), (1, 0, 0))

    def test_unittest_every_bucket_at_once(self):
        """2 passes, 1 failure, 1 error, 1 skip, 1 xfail, 1 unexpected success.

        Errors and unexpected successes are failures here because they are what
        CPython itself failed the run over; the expected failure ran and left
        the run green, so it lands in passed alongside the two real passes.
        """
        out = (
            "Ran 7 tests in 0.001s\n\nFAILED (failures=1, errors=1, skipped=1, "
            "expected failures=1, unexpected successes=1)\n"
        )
        self.assertEqual(counts(out), (3, 3, 1))

    def test_unittest_green_with_skip_and_expected_failure(self):
        out = "Ran 3 tests in 0.001s\n\nOK (skipped=1, expected failures=1)\n"
        self.assertEqual(counts(out), (0, 2, 1))

    def test_unittest_unexpected_success_alone_is_a_failure(self):
        out = "Ran 1 test in 0.000s\n\nFAILED (unexpected successes=1)\n"
        self.assertEqual(counts(out), (1, 0, 0))

    def test_unittest_selector_matched_nothing(self):
        """`-k` with no match: `Ran 0 tests` and, confusingly, `OK`. Must read
        as 0 executed so the caller's own "ran no tests" refusal can fire."""
        out = "Ran 0 tests in 0.000s\n\nOK\n"
        self.assertEqual(counts(out), (0, 0, 0))

    def test_unittest_last_run_wins(self):
        out = "Ran 9 tests in 0.010s\n\nOK\n\nRan 3 tests in 0.001s\n\nFAILED (failures=2)\n"
        self.assertEqual(counts(out), (2, 1, 0))

    def test_pytest_every_bucket(self):
        out = "============== 3 failed, 2 passed, 1 skipped, 1 xfailed in 0.03s ===============\n"
        self.assertEqual(counts(out), (3, 3, 1))

    def test_pytest_quiet_mode_drops_the_padding(self):
        """`-q` prints the same body with no `=` rules, so the anchor cannot
        depend on them."""
        out = "3 failed, 2 passed, 1 skipped, 1 xfailed in 0.03s\n"
        self.assertEqual(counts(out), (3, 3, 1))

    def test_pytest_all_green(self):
        out = "============================== 2 passed in 0.01s ===============================\n"
        self.assertEqual(counts(out), (0, 2, 0))

    def test_pytest_warnings_and_deselected_are_not_outcomes(self):
        """A warning is not a test. Refusing this line would make an ordinary
        run carrying one deprecation warning unreplayable."""
        out = "============= 1 failed, 1 passed, 1 deselected, 1 warning in 0.02s =============\n"
        self.assertEqual(counts(out), (1, 1, 1))

    def test_pytest_collection_error_is_singular(self):
        out = "=============================== 1 error in 0.12s ===============================\n"
        self.assertEqual(counts(out), (1, 0, 0))

    def test_pytest_no_tests_ran(self):
        out = "============================ no tests ran in 0.00s =============================\n"
        self.assertEqual(counts(out), (0, 0, 0))

    def test_pytest_deselected_everything(self):
        out = "============================ 2 deselected in 0.00s =============================\n"
        self.assertEqual(counts(out), (0, 0, 2))

    def test_pytest_xfailed_and_xpassed_executed(self):
        """Both ran and neither failed the run, so both count as passed."""
        out = "1 passed, 1 xfailed, 1 xpassed in 0.02s\n"
        self.assertEqual(counts(out), (0, 3, 0))

    def test_pytest_long_run_appends_a_clock(self):
        out = "1 passed in 61.01s (0:01:01)\n"
        self.assertEqual(counts(out), (0, 1, 0))


class PythonRunnerRefusals(unittest.TestCase):
    """GAM-309. A Python shape read half-right must raise, exactly as a vitest
    one does -- the point of the fix is to widen what is understood, never to
    widen what is guessed at."""

    def test_unittest_verdict_with_no_total_line(self):
        with self.assertRaises(SummaryParseError):
            counts("OK (skipped=1)\n")

    def test_unittest_total_with_no_verdict_line(self):
        """Output truncated between the two lines: half a summary is not one."""
        with self.assertRaises(SummaryParseError):
            counts("Ran 3 tests in 0.001s\n")

    def test_unittest_unknown_bucket(self):
        with self.assertRaises(SummaryParseError):
            counts("Ran 3 tests in 0.001s\n\nFAILED (explosions=1)\n")

    def test_unittest_buckets_exceed_the_declared_total(self):
        """The subtraction is the cross-check; a negative remainder fails it."""
        with self.assertRaises(SummaryParseError):
            counts("Ran 1 test in 0.000s\n\nFAILED (failures=5)\n")

    def test_unittest_failed_naming_nothing_that_failed(self):
        """Reading this as 0 failing would report a red run as STILL GREEN."""
        with self.assertRaises(SummaryParseError):
            counts("Ran 3 tests in 0.001s\n\nFAILED\n")

    def test_unittest_ok_naming_something_that_failed(self):
        with self.assertRaises(SummaryParseError):
            counts("Ran 3 tests in 0.001s\n\nOK (failures=1)\n")

    def test_pytest_unknown_outcome(self):
        with self.assertRaises(SummaryParseError):
            counts("1 exploded in 0.01s\n")

    def test_pytest_duplicate_segment(self):
        with self.assertRaises(SummaryParseError):
            counts("1 passed, 2 passed in 0.01s\n")

    def test_pytest_body_must_start_the_line(self):
        """The near-miss GAM-309 warned about: if the pattern were loosened to
        hunt for `N passed` anywhere, prose in a traceback would parse."""
        with self.assertRaises(SummaryParseError):
            counts("assert 19 passed in 0.18s == True\n")

    def test_pytest_summary_without_a_duration(self):
        """The duration is load-bearing anchoring, not decoration."""
        with self.assertRaises(SummaryParseError):
            counts("3 failed, 2 passed\n")


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

    def test_unittest_shaped_runner_reddens_without_a_shim(self):
        """GAM-309, end to end over the real script. This is the case that used
        to exit 2 at the baseline and forced T612 to wrap its runner in a
        throwaway shell script that reprinted the counts in vitest's shape."""
        proc, widget = self.replay(
            fake_runner("Ran 19 tests in 0.177s\n\nOK", "Ran 19 tests in 0.177s\n\nFAILED (failures=7)")
        )
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        self.assertIn("REDDENED", proc.stdout)
        self.assertIn("failed=7 passed=12", proc.stdout)
        self.assertNotIn("UNTRUSTWORTHY", proc.stdout + proc.stderr)
        self.assertEqual(widget.read_text(), self.ORIGINAL)

    def test_pytest_shaped_runner_reddens_without_a_shim(self):
        proc, widget = self.replay(
            fake_runner("19 passed in 0.18s", "7 failed, 12 passed in 0.20s")
        )
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        self.assertIn("REDDENED", proc.stdout)
        self.assertIn("failed=7 passed=12", proc.stdout)
        self.assertEqual(widget.read_text(), self.ORIGINAL)

    def test_unreadable_baseline_output_stops_before_mutating(self):
        proc, widget = self.replay("echo 'No test files found, exiting with code 1'; exit 1")
        self.assertEqual(proc.returncode, 2, proc.stdout + proc.stderr)
        self.assertIn("could not read the test counts of the baseline run", proc.stderr)
        self.assertEqual(widget.read_text(), self.ORIGINAL)


if __name__ == "__main__":
    unittest.main(verbosity=2)
