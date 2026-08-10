#!/usr/bin/env python3
"""Tests for gate-run's summary parsers and scope derivation.

Standard library only, and the fixtures are captured output rather than an
imported dependency -- same rule as mutation-replay's test_replay.py, so this
runs on the CI runner's system python3 with no install step.

The parsers are the part worth testing: a gate that misreads a summary reports
a number three agents will then quote at each other. Everything else in
gates.py is `subprocess.run` handing back an exit code, which has no logic to
get wrong.

    python3 .claude/skills/gate-run/scripts/test_gates.py
"""

from __future__ import annotations

import sys
import unittest

sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))

from gates import (  # noqa: E402
    FAIL,
    PASS,
    UNTRUSTED,
    Unreadable,
    common_scope,
    eslint_verdict,
    parse_eslint,
    porcelain_paths,
    parse_vitest,
)


class ParseVitest(unittest.TestCase):
    def test_all_green(self):
        """The shape GAM-304 recorded four times: 83 files / 2162 tests."""
        out = "\n Test Files  83 passed (83)\n      Tests  2162 passed (2162)\n"
        self.assertEqual(parse_vitest(out), (83, 2162, 0))

    def test_scoped_green(self):
        out = "\n Test Files  4 passed (4)\n      Tests  225 passed (225)\n"
        self.assertEqual(parse_vitest(out), (4, 225, 0))

    def test_failures_are_counted(self):
        out = (
            "\n Test Files  1 failed | 82 passed (83)"
            "\n      Tests  1 failed | 2161 passed (2162)\n"
        )
        self.assertEqual(parse_vitest(out), (83, 2162, 1))

    def test_no_passed_segment(self):
        """T612's shape: every matched test failed, so no `passed` segment.

        The old mutation-replay parser scored this as failed=0 passed=0 and
        told the agent its genuinely red run had executed nothing. Reading the
        parenthesised total instead of hunting for `passed` is what fixes it.
        """
        out = (
            "\n Test Files  1 failed (1)"
            "\n      Tests  1 failed | 69 skipped (70)\n"
        )
        self.assertEqual(parse_vitest(out), (1, 70, 1))

    def test_ansi_colour_codes_are_stripped(self):
        out = (
            "\n \x1b[1m\x1b[32m Test Files \x1b[39m\x1b[22m 83 passed (83)"
            "\n \x1b[1m\x1b[32m      Tests \x1b[39m\x1b[22m 2162 passed (2162)\n"
        )
        self.assertEqual(parse_vitest(out), (83, 2162, 0))

    def test_zero_collected_still_parses(self):
        """Parsing succeeds; refusing is the caller's job, and it does refuse.

        Measured, not assumed: vitest 3.2.7 here exits 1 on an empty match and
        prints no summary at all, so this shape appears only under
        `passWithNoTests`, which is not set in this config. The gate treats
        (0, 0) as UNTRUSTWORTHY rather than a pass for that eventuality.
        """
        out = "\n Test Files  0 passed (0)\n      Tests  0 passed (0)\n"
        self.assertEqual(parse_vitest(out), (0, 0, 0))

    def test_missing_summary_refuses(self):
        with self.assertRaises(Unreadable):
            parse_vitest("Error: Cannot find module 'vite'\n")

    def test_half_a_summary_refuses(self):
        """One line without the other is not a summary worth trusting."""
        with self.assertRaises(Unreadable):
            parse_vitest("\n Test Files  83 passed (83)\n")

    def test_missing_total_refuses(self):
        with self.assertRaises(Unreadable):
            parse_vitest("\n Test Files  83 passed\n      Tests  2162 passed\n")


class ParseEslint(unittest.TestCase):
    def test_silence_is_clean(self):
        self.assertEqual(parse_eslint(""), (0, 0))
        self.assertEqual(parse_eslint("   \n  \n"), (0, 0))

    def test_the_377_warning_baseline(self):
        """This repo's standing state: zero errors, 377 pre-existing warnings."""
        out = "\n✖ 377 problems (0 errors, 377 warnings)\n"
        self.assertEqual(parse_eslint(out), (0, 377))

    def test_errors_are_read_separately_from_warnings(self):
        out = "\n✖ 380 problems (3 errors, 377 warnings)\n"
        self.assertEqual(parse_eslint(out), (3, 377))

    def test_singular_forms(self):
        out = "\n✖ 2 problems (1 error, 1 warning)\n"
        self.assertEqual(parse_eslint(out), (1, 1))

    def test_output_without_a_tally_refuses(self):
        """Lines with no tally could be anything; guessing would invent a pass."""
        with self.assertRaises(Unreadable):
            parse_eslint("Oops! Something went wrong! :(\nERR_MODULE_NOT_FOUND\n")


class EslintVerdict(unittest.TestCase):
    """Gate 4 is the only gate whose verdict is not the raw exit code.

    That is right for warnings -- eslint exits 0 with 377 of them -- but it
    once meant the exit code was ignored entirely, so an eslint that died
    before printing anything parsed as (0, 0) and passed.
    """

    def test_clean_run_passes(self):
        self.assertEqual(eslint_verdict(0, 0, 0, None), (PASS, ""))

    def test_warnings_alone_pass(self):
        """This repo's standing state: exit 0, zero errors, 377 warnings."""
        self.assertEqual(eslint_verdict(0, 0, 377, None), (PASS, ""))

    def test_errors_fail(self):
        status, _ = eslint_verdict(1, 3, 377, None)
        self.assertEqual(status, FAIL)

    def test_warnings_over_explicit_ceiling_fail(self):
        status, note = eslint_verdict(0, 0, 378, 377)
        self.assertEqual(status, FAIL)
        self.assertIn("377", note)

    def test_warnings_at_the_ceiling_pass(self):
        self.assertEqual(eslint_verdict(0, 0, 377, 377), (PASS, ""))

    def test_nonzero_exit_with_no_errors_is_untrustworthy(self):
        """Exit 1 means eslint found lint errors -- but the tally shows none.

        The two disagree, so the run cannot be scored either way. This is the
        catch-all behind the exit-2 contract check, and it covers the shape the
        container this skill was written in produced: eslint dying before it
        could print a tally (`Cannot find package '@eslint/js'`). A tally-only
        verdict called that a clean gate.
        """
        status, note = eslint_verdict(1, 0, 0, None)
        self.assertEqual(status, UNTRUSTED)
        self.assertIn("non-lint reason", note)

    def test_nonzero_exit_with_errors_is_an_ordinary_failure(self):
        """Exit 1 with errors in the tally is eslint working correctly."""
        status, _ = eslint_verdict(1, 5, 0, None)
        self.assertEqual(status, FAIL)

    def test_exit_two_is_untrustworthy_even_with_a_tally(self):
        """eslint's contract: 2 means eslint failed, whatever it printed.

        Reading the tally first called this an ordinary lint failure, which
        would send someone hunting for 5 errors that an aborted run never
        really counted.
        """
        status, note = eslint_verdict(2, 5, 0, None)
        self.assertEqual(status, UNTRUSTED)
        self.assertIn("configuration or internal", note)


class CommonScope(unittest.TestCase):
    def test_single_directory(self):
        self.assertEqual(
            common_scope(
                ["src/pages/home/StudentHome.tsx", "src/pages/home/ParentHome.tsx"]
            ),
            "src/pages/home/",
        )

    def test_non_src_files_are_ignored(self):
        """Docs and migrations move constantly and say nothing about test scope."""
        self.assertEqual(
            common_scope(
                [
                    "docs/swarm/active/GAM-304-run-log.md",
                    "src/pages/home/StudentHome.tsx",
                    "supabase/migrations/0042_rsvp.sql",
                ]
            ),
            "src/pages/home/",
        )

    def test_siblings_truncate_to_their_shared_parent(self):
        self.assertEqual(
            common_scope(["src/pages/home/A.tsx", "src/pages/outreach/B.tsx"]),
            "src/pages/",
        )

    def test_unrelated_trees_give_up(self):
        """`src/` alone is the full suite again -- that is gate 5, not gate 6."""
        self.assertIsNone(
            common_scope(["src/pages/home/A.tsx", "src/lib/loaders/outreach.ts"])
        )

    def test_no_src_files_gives_up(self):
        self.assertIsNone(common_scope(["docs/swarm/constitution.md", "README.md"]))

    def test_empty_diff_gives_up(self):
        self.assertIsNone(common_scope([]))

    def test_file_directly_under_src_gives_up(self):
        self.assertIsNone(common_scope(["src/main.tsx"]))

    def test_shared_prefix_is_not_stitched_from_scattered_matches(self):
        """src/pages/home + src/lib/home share only `src`, not `src/home`.

        A parser that filtered matching segments instead of truncating at the
        first mismatch would emit `src/home/`, a path that exists nowhere --
        vitest would then match no tests and exit non-zero for a reason that
        has nothing to do with the change.
        """
        self.assertIsNone(
            common_scope(["src/pages/home/A.tsx", "src/lib/home/B.ts"])
        )


class PorcelainPaths(unittest.TestCase):
    """Scope derivation folds in uncommitted work, so these paths must parse.

    `base...HEAD` sees only commits, but dirty runs are supported -- without
    these, gate 6 could scope to a directory the current edits are not in.
    """

    def test_modified_and_untracked(self):
        porcelain = " M src/pages/home/StudentHome.tsx\n?? src/pages/home/New.tsx\n"
        self.assertEqual(
            porcelain_paths(porcelain),
            ["src/pages/home/StudentHome.tsx", "src/pages/home/New.tsx"],
        )

    def test_staged_and_partially_staged(self):
        porcelain = "M  src/a.ts\nMM src/b.ts\nA  src/c.ts\n"
        self.assertEqual(porcelain_paths(porcelain), ["src/a.ts", "src/b.ts", "src/c.ts"])

    def test_rename_resolves_to_the_target(self):
        """Gate 6 must test where the code lives now, not where it used to."""
        porcelain = "R  src/old/Thing.tsx -> src/new/Thing.tsx\n"
        self.assertEqual(porcelain_paths(porcelain), ["src/new/Thing.tsx"])

    def test_quoted_paths_are_unwrapped(self):
        porcelain = ' M "src/pages/odd name.tsx"\n'
        self.assertEqual(porcelain_paths(porcelain), ["src/pages/odd name.tsx"])

    def test_empty_is_empty(self):
        self.assertEqual(porcelain_paths(""), [])

    def test_uncommitted_work_reaches_the_scope(self):
        """The whole point: a dirty-only change still scopes gate 6."""
        committed: list[str] = []
        dirty = " M src/pages/home/StudentHome.tsx\n M src/pages/home/ParentHome.tsx\n"
        self.assertEqual(
            common_scope(committed + porcelain_paths(dirty)), "src/pages/home/"
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
