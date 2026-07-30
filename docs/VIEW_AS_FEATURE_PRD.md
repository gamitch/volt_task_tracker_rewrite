# View As — Coach/Admin Impersonation: Requirements & Design

**Status:** Draft, requirements-only. All five open questions resolved by George on 2026-07-30 (see Decisions below) — not yet reviewed by `checker-premise`, not yet packeted. Written for George; intended to be handed to the active swarm session's planning process (`boss-architect`/`foreman-planner`) rather than implemented directly from this doc.

**Author:** a separate Claude Code session, written 2026-07-30, grounded directly against this repo's current auth/RLS implementation (citations below), not written from general knowledge of "how impersonation usually works."

**Precedence, per `docs/swarm/constitution.md`:** this is a new feature not covered by `VOLT_Portal_PRD.md`'s existing requirement IDs. It does not amend that PRD; it's a standalone addendum. If anything here conflicts with the PRD or the constitution, those win — flag the conflict rather than resolve it silently, per constitution item 20.

---

## Decisions (George, 2026-07-30)

Rulings on the five open questions originally in section 9 — the rest of this doc has been updated to reflect them; this block is the record of what was decided and why it matters.

| # | Question | Ruling | Implication |
|---|---|---|---|
| VIEW-Q1 | Admin only, or admin + coach? | **Both** — coach gets the capability too. | VIEW-01/02 scope both roles. Blast-radius counter-consideration from the original framing still applies operationally (more people with a powerful capability) — worth keeping in mind for the audit-review cadence, not a reason to revisit the ruling. |
| VIEW-Q2 | Read-only v1, or read+write v1? | **Read+write**, not phased. | VIEW-07 (attribution correctness) is a hard v1 requirement, not a fast-follow. Raises the bar on the session-mint mechanism (section 5) — a bug there is now immediately exposed to real mutations from day one, with no read-only proving period first. |
| VIEW-Q3 | Can staff View As other staff? | **No.** | VIEW-02 confirmed as a hard requirement, not a recommendation. |
| VIEW-Q4 | Time-box duration? | **30 minutes.** | VIEW-06 updated. The sub-question of *what expiry does* (hard kick vs. re-confirm prompt) wasn't explicitly ruled on — VIEW-06 below carries a recommended default (hard kick), flagged as inferred, not confirmed. |
| VIEW-Q5 | Audit trail user-facing? | **No, stays staff-only** — but the RSVP activity view specifically should say a staff member acted on the student's behalf. | New requirement, VIEW-12 below. This is a distinct signal from the staff-only audit trail (section 7) — see VIEW-12 for why `rsvps.responded_by` alone can't carry it and what a fix needs. |

## 1. Problem

The coach/admin cannot see or act in the app as a student or parent would. This is a real operational gap, not a hypothetical: identical email-per-account means a second "test" admin account can't stand in for a real student/parent. Today, debugging a user-reported issue means reasoning about their view from code, or asking them to screen-share — and there's no way to act on their behalf (submit an RSVP for a student who can't do it themselves, for example) with the action correctly attributed to them.

## 2. Goals

- A staff user (admin or coach — both, per VIEW-Q1's ruling) can select a student or parent and view the app exactly as that person would see it.
- The staff user can perform actions "as" that person, shipping in v1 alongside read access (VIEW-Q2's ruling — not phased), with the action correctly attributed to the real target in the database — not to the staff member.
- Return to the staff member's own session is instant, always available, and never requires re-authentication.
- Every use of this capability is auditable after the fact.

## Non-goals

- Not a general-purpose impersonation framework for arbitrary future use cases — scoped to support/debug for student and parent accounts only.
- Not available to student or parent roles under any circumstance.
- Not a way to bypass role-gating — a staff member viewing as a student sees exactly the student's routes/UI, nothing more.
- Not persistent — always a session-scoped mode with a hard exit, never a standing "become this user" login.

## 3. User stories

- As a coach, a parent tells me their calendar subscription link is broken. I want to view the app as that parent so I can see exactly what they see and reproduce the bug.
- As an admin, a student is confused about their RSVP and can't get it to work from their own device. I want to submit the RSVP as that student so the record reflects the student's actual response, not mine.
- As a coach/admin, once I'm done, I want to get back to my own account in one click, with no doubt about which identity I'm currently operating as.
- As the system, I need a durable record of who viewed as whom, when, so any question about "did the student really do that, or did staff do it for them" is answerable later.

## 4. Key technical finding — this requires real session impersonation, not client-side "render as"

This determines the whole architecture, so it's stated up front rather than buried in a design section.

This project's RLS policies (`supabase/migrations/20260717000002_rls.sql`) use two patterns:
- **`staff_all`** (`using (is_staff()) with check (is_staff())`) — full read/write for admin+coach. Present on `profiles`, `teams`, `seasons`, `students`, `guardian_links`, `invites`, `events`, `event_sessions`, `rsvps`, `attendance` (verified: `grep -n "create policy" supabase/migrations/20260717000002_rls.sql` lists `staff_all` on all ten).
- **`self_all`** (`using (profile_id = auth.uid()) with check (profile_id = auth.uid())`) — **no staff override at all.** Present on exactly two tables: `notification_prefs` (`:240-243`) and `calendar_feeds` (`:250-253`).

**Consequence:** staff already has DB-level read/write access to almost everything via `is_staff()` — so for most of the app, a "render the admin's own already-visible data as if it belonged to the target" trick would technically work for *reads*. But `notification_prefs` and `calendar_feeds` have no staff bypass at all — an admin's own session has **zero** RLS access to another user's rows in those two tables, full stop. Settings → Notifications and Settings → Calendar feed cannot be viewed or edited on someone else's behalf under any client-side trick; the only way in is a session whose `auth.uid()` genuinely resolves to the target.

This also settles attribution (VIEW-07 below): `rsvps`' `own_or_linked_write`/`own_or_linked_update` policies require `responded_by = auth.uid()` (`:207`, `:212`). If the staff member's own `auth.uid()` is used to submit an RSVP "for" a student, either the write is rejected by that policy, or (since `staff_all` also permits the write via `is_staff()` with no `responded_by` constraint) it succeeds but silently attributes the action to the staff member's own id, not the student's — the exact "acting on behalf of but the record doesn't reflect it" failure the feature exists to avoid.

**Conclusion: View As must swap the client's active session to a real, valid session for the target user**, so `auth.uid()` resolves to the target everywhere, and every existing RLS policy — `own_or_linked_write`, `self_all`, all of it — applies exactly as it would if the target had signed in directly. No RLS policy needs to change for this (a genuine architectural upside): the policies already do the right thing once `auth.uid()` is honestly the target's id. The complexity is entirely in the auth/session layer, not the RLS layer.

## 5. Architecture sketch (needs a technical spike, not asserted as final)

**Recommended shape:** a secure server-side mechanism — a Supabase Edge Function running under the service-role key — that, given a staff caller's own valid session and a target profile id, verifies the caller `is_staff()`, then mints a genuine session for the target user and returns it to the client. The client swaps its active Supabase client session to the returned one for the duration of View As.

This needs a technical spike before it's packeted, specifically to confirm:
- The exact `@supabase/supabase-js`/Supabase Admin API mechanism available in this project's pinned version for generating a session for an arbitrary user without their password (candidates to investigate: `auth.admin.generateLink`, session/token minting via the admin API — the current capability needs verifying against this repo's actual dependency version, not assumed from general Supabase knowledge).
- Whether the mechanism can run entirely inside a Supabase Edge Function (service-role key never leaves the server, per constitution item 5 — **BLOCKER if the service-role key ever reaches frontend code or the client bundle**).

**Session handling, client side:**
- The staff member's real session must be retained (not discarded) while impersonating, so "Exit View As" is instant with no re-authentication. Recommend holding both sessions distinctly (e.g., the real session kept in memory/a separate store, the impersonated one active for API calls) rather than overwriting the only copy of the real session.
- **The impersonated session must not survive a page reload/tab close the way a normal session does, and must never leak across browser tabs via shared storage.** This is a direct, concrete lesson from this same codebase's own T154 bug (`docs/swarm/task-ledger.md`, T154 row): a single browser-scoped storage key (`volt.themeMode`) caused one user's theme to bleed into the next user's session on the same browser. An impersonated *session* persisting or leaking the same way would be materially worse than a theme flash — it would mean a staff member's impersonated identity survives after they believe they've exited, or leaks to a different tab/user on a shared machine. Whatever storage key holds the impersonated session, it must be scoped narrowly (tab-scoped or in-memory, not a shared `localStorage` key mirroring the real-session pattern) and must not be trusted on resume without re-verifying staff authorization server-side.

## 6. Functional requirements

- **VIEW-01 — Entry point.** Staff can initiate View As from Roster (a per-row action on `StudentsTab`/`ParentsTab`) and from a global entry point reachable from any screen (e.g. an admin-menu search), so it isn't limited to hunting through Roster first.
- **VIEW-02 — Target scope.** View As targets are limited to `student` and `parent` profiles. Viewing as another `admin`/`coach` is **not permitted** (VIEW-Q3, decided — not just a v1 scope-down, a hard rule).
- **VIEW-03 — Real identity, not simulation.** Per section 4: View As operates via a real session for the target, not client-side data relabeling. Every existing RLS policy applies unmodified.
- **VIEW-04 — Persistent, unmissable indicator.** While impersonating, a banner is visible on every screen, stating who is being viewed and their role, with an always-available exit control. Cannot be dismissed/hidden while the session is active (only ended via the exit control). Exact component/props must come from `docs/swarm/astryx-api.md` — not invented here (constitution item 2).
- **VIEW-05 — Instant, no-reauth exit.** One action returns the staff member to their own session, from any screen, at any time.
- **VIEW-06 — Time-boxing.** A View As session auto-expires after **30 minutes** (VIEW-Q4, decided) and must be explicitly re-entered, not silently renewed. **Expiry behavior default (recommended, not explicitly confirmed by George's ruling — the duration was decided, this part wasn't):** a hard revert to the staff member's own session, not a re-confirmation prompt that could be dismissed absent-mindedly — time-boxing exists as a security control, and a prompt that can be reflexively clicked through defeats that purpose. Flag for a quick confirm if this inference is wrong.
- **VIEW-07 — Attribution correctness.** Actions taken while impersonating are attributed to the target's real id in the database (e.g. `rsvps.responded_by`), because the session genuinely is the target's — no special-casing needed in application mutation code beyond the session swap itself.
- **VIEW-08 — Non-escalation.** A staff member viewing as a student/parent sees exactly that role's routes and UI — `RequireRole` (`src/app/guards.tsx`) must evaluate against the *impersonated* session's resolved role, not the staff member's true role. No route or control beyond what the target role can normally reach is exposed during View As.
- **VIEW-09 — No credential exposure.** The mechanism never displays, requests, or transmits the target's password, OTP, or any secret to the staff member or the client. The service-role key never reaches frontend code or the client bundle (constitution item 5, BLOCKER).
- **VIEW-10 — Audit logging.** Every View As session's start and end is recorded durably: acting staff member's real id, target id, start time, end time. See section 7 for the recommended storage shape.
- **VIEW-11 — Full read+write in v1 (VIEW-Q2, decided).** Mutation capability ships alongside read access from the start, not phased behind a read-only proving period. This means VIEW-07's attribution correctness and VIEW-03's real-session-impersonation mechanism must both be solid before *any* version of this feature ships — there's no lower-risk read-only milestone to de-risk the mechanism first. Weight the technical spike and premise-gate review (section 5, section 10) accordingly.
- **VIEW-12 — Visible "acted on your behalf" indicator (new, from VIEW-Q5's ruling).** The audit trail itself stays staff-only/not user-facing (confirmed) — but the RSVP activity/history view specifically should indicate when a staff member responded on the student's behalf, rather than looking indistinguishable from the student's own action. **Why this needs a design decision, not just a UI tweak:** `rsvps.responded_by` must stay the target's real id — that's what makes VIEW-03/VIEW-07's RLS analysis (section 4) correct in the first place. So a *second* signal is needed to know "was this specific row written during an active View As session, and by which staff member," which the schema doesn't currently carry. Two candidate approaches, for whoever designs the migration (likely the same design decision as section 7's audit-log shape):
  - **(a) A nullable `acted_by_profile_id` column** on `rsvps` (scope beyond RSVPs is open — George named the RSVP activity view specifically; treat other surfaces like attendance/check-off as a later follow-up, not assumed in scope now), populated only when the write goes through the impersonation path. This needs a way to stop an ordinary session from setting it to an arbitrary value — e.g. a new security-definer helper (`impersonator_id()`, same pattern as `auth_role()`/`is_staff()`) reading a custom JWT claim the session-minting Edge Function embeds, with an RLS `with check` permitting a non-null `acted_by_profile_id` only when it equals `impersonator_id()`. This is genuinely new ground (no existing precedent in this schema to copy), not a mechanical extension of an established pattern — needs its own careful review.
  - **(b) Derive it at read time** by joining the RSVP's `created_at`/`updated_at` against the View As session log (section 7) for that target — no schema change to `rsvps`, but a costlier read path, and only as trustworthy as the session log's own timestamps.
  Recommend (a) for directness and auditability, but this is exactly what the technical spike and premise gate should settle, not asserted as final here.

## 7. Audit logging — reuse the existing pattern, don't invent a parallel one

This project already has an `audit_log` table (`supabase/migrations/20260717000001_support_audit.sql:86`: `id`, `actor` (fk `profiles`, not null), `action text`, `entity text`, `entity_id uuid`, `meta jsonb`, `created_at`), readable by staff only (`staff_read` policy, `20260717000002_rls.sql:272-273`), populated exclusively by `SECURITY DEFINER` trigger functions or service-role Edge Functions — never a general client-writable table.

`audit_log`'s existing rows are single point-in-time events (attendance edits, role changes, deactivations, cancellations, invite revocations per that migration's own header comment) — a View As session has a *duration* (start and end), which doesn't map cleanly onto that shape. Two options, for whoever designs the actual migration:

1. Write two `audit_log` rows per session (`action = 'view_as_start'` / `'view_as_end'`, `entity = 'profile'`, `entity_id` = target's id, `actor` = staff member's real id, `meta` = `{}` or a session-correlation id — **never names/emails, per constitution item 6, BLOCKER if violated**), from the same Edge Function that mints/ends the impersonated session (consistent with the existing "populated exclusively by service-role functions" pattern).
2. A dedicated `view_as_sessions` support table (`id`, `admin_profile_id`, `target_profile_id`, `started_at`, `ended_at` nullable, `ended_reason`) that more naturally models a session with duration, with its own trigger writing companion `audit_log` rows for consistency with the existing staff-readable audit trail.

No recommendation forced here — this is a genuine migration-design decision (constitution item 18 already puts this task at opus tier regardless, since it's auth/session/permission work; the ledger row for whichever task implements this should record the choice and why).

## 8. Security & privacy requirements

- Minors are involved (constitution item 6) — the audit trail must carry ids only, never names/emails, matching the existing `audit_log`/`email_log` convention exactly.
- View As must not be usable to reach anything a direct `staff_all`/`is_staff()` session couldn't already reach today for reads (section 4 establishes the two exceptions where it grants *more* — `notification_prefs`/`calendar_feeds` — which is the point of the feature, not an escalation, since those are still the target's own data, not third-party data).
- The mechanism must be independently reviewable: because this touches auth, session handling, role-resolution, and permission logic, constitution item 18 requires opus-tier dispatch for whichever task(s) implement it, and item 19's `checker-premise` gate applies before any worker touches it — flagging this explicitly so it isn't missed at packeting time.
- Recommend (not asserted as required) a step-up confirmation before entering View As (e.g., a confirmation dialog naming the target, not full re-authentication) — cheap friction against an accidental click given the capability's power, without the UX cost of a full re-login.

## 9. Open questions — resolved

All five (VIEW-Q1 through VIEW-Q5) were resolved by George on 2026-07-30 — see the Decisions block near the top of this doc for the rulings and their implications. One sub-question remains a recommendation rather than a confirmed ruling: VIEW-06's exact expiry *behavior* (hard kick vs. re-confirm prompt) — the 30-minute *duration* is decided, that one detail isn't. Flag it for a quick confirm rather than treating the recommended default as settled.

Remaining genuinely open item, surfaced by VIEW-12 (new): the exact schema/mechanism for the "acted on your behalf" indicator (a new `acted_by_profile_id`-style column plus a new `impersonator_id()` security-definer helper, vs. deriving it from the session log at read time) is a real design decision, not yet made — see VIEW-12 for the two candidate approaches. This is engineering-scoped (belongs to the technical spike / premise gate in section 10), not a question that needs another round with George.

## 10. Process notes for whoever packets this

- This is squarely an item-18 opus-tier task (auth, session, role-resolution, and permission logic are all touched) — the dispatch call needs the `model: "opus"` override, not the worker's pinned default.
- Full `checker-premise` gate (item 19) before any worker touches it — this is a novel pattern, not a rollout of an already-verified one, so the light-check exception (item 19b) doesn't apply.
- Section 4/7's citations (`20260717000002_rls.sql`, `20260717000001_support_audit.sql`) were verified by direct read against `dcfa6e0f27648b2d08343a692324b051adba54c1` (this doc's base commit) — re-verify before relying on them if picked up later, per this project's own citation-drift lessons.
- This doc does not touch `docs/swarm/task-ledger.md`, `constitution.md`, or any source file — it's a standalone addendum for the boss-architect/foreman-planner process to turn into real task packets, same as any other new feature request.
