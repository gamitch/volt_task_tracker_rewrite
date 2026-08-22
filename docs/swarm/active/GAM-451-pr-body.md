Closes GAM-451

## Summary

- Replace the student and parent meetings history-first view with a next-meeting hero, short upcoming list, attendance summary, and collapsed past meetings.
- Keep participation as a database passthrough, including an indeterminate null state, and scope parent meetings to the selected child's active teams.
- Add keyboard-accessible child switching, responsive 375px behavior, two-child persona fixtures, and browser evidence for student and parent isolation.

## Verification

- Focused Vitest: 94/94, exit 0
- Student meetings scope: 29/29, exit 0 (baseline 25)
- Full Vitest: 2,675/2,675, exit 0
- `npm run typecheck`: exit 0
- `npm run build`: exit 0
- `npm run lint`: exit 0 (0 errors; 380 existing warnings)
- `npm run format:check`: exit 0
- `git diff --check 41c81a5..73e5574`: exit 0
- Mutation replay: all 11 required mutations red, then restored green
- Persona browser checks: `reports-accounting.spec.ts` 5/5 and `student-parent.spec.ts` 9/9 on clean seeded data

## Browser evidence

- `84-student-meetings-mobile.png`: 375×812 student hero, one participation bar, no horizontal overflow
- `85-parent-meetings-nina-history.png`: 1440×1000 selected-child isolation and distinct retrospective history

## Follow-up

- GAM-486 tracks two out-of-scope stale comments that still name the deleted `aggregateParticipationRows` helper.

## Persona-suite baseline note

A raw run against one shared mutable database finished 46/53. Three failures were local PostgreSQL display-timezone differences and four were cross-spec state contamination. With UTC and a clean reseed per spec, every spec passed except two pre-existing date/stand-in assertions in `student-checkin.spec.ts`; all GAM-451 persona journeys passed.
