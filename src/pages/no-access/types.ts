/**
 * T020: data-loading seam for the `/no-access` screen (AUTH-04's "You're not
 * on the roster yet" screen).
 *
 * This module exists because of a genuine, unresolved gap -- a different
 * flavor than `../accept-invite/types.ts`'s (T018) gap, and explicitly
 * flagged as a dispute candidate in this task's worker output. That gap was
 * "the data exists in the schema (`invites`) but this page's RLS-restricted
 * caller cannot read it directly." THIS gap is one level more fundamental:
 * the data does not exist ANYWHERE in the schema at all. `teams` (per
 * `supabase/migrations/20260716000000_identity_roster.sql`) has only `name`,
 * `short_name`, `program`, `color`, `archived`, `sort_order` -- no contact
 * person/email/phone column, on `teams` or on any other table in the schema.
 * There is no future Edge Function or RLS-policy fix that alone would make
 * this real; the schema itself would need a new column or table first.
 *
 * A second, independent ambiguity worth naming explicitly here (not just a
 * missing column): AUTH-04's caller is, by definition, NOT on any roster --
 * they have no `students`/`guardian_links` row and (per this task's
 * companion RLS-denial test) no visibility into `students.team_id` even if
 * they did. There is therefore no principled way to resolve WHICH team's
 * contact should be shown for a completely unaffiliated visitor -- "team
 * contact" as literally worded in the PRD excerpt presupposes the visitor
 * already has a team association, which is precisely the case that never
 * holds on this screen. The most likely real intent (not confirmed against
 * any PRD excerpt available to this task) is a single org-level contact
 * (e.g. the program's lead admin/coach), not a specific team's contact --
 * flagged here as part of the same dispute-candidate recommendation.
 *
 * Instead of fabricating a live query against either gap, this module
 * defines the *shape* the page needs (`NoAccessData`) and a *seam* for
 * supplying it (`LoadNoAccessDataFn`), mirroring
 * `../accept-invite/types.ts`'s `AcceptInviteData`/`LoadInviteFn` pattern
 * exactly -- an async seam, not a plain sync prop, on the same reasoning
 * that pattern used: whatever eventually resolves this (a new schema column/
 * table plus a real query, or a static org-config value baked into a future
 * settings screen) is realistically an async lookup once it exists, even
 * though today's default implementation has nothing real to await.
 */

/**
 * The data this page needs in order to render AUTH-04's "name of team
 * contact" requirement. A designed seam, not a live query result -- see
 * module doc above. Named `contactName` (not `teamContactName`) precisely
 * because of the "which team?" ambiguity documented above -- this seam
 * deliberately does not presuppose the answer is team-scoped.
 */
export interface NoAccessData {
  contactName: string;
}

/**
 * Data-loading seam. Resolves the contact-name data this page displays, or
 * rejects on a genuine lookup failure.
 *
 * `NoAccessPage`'s default implementation of this (`defaultLoadNoAccessData`
 * in `NoAccessPage.tsx`) is an obviously-fake placeholder that does NOT call
 * Supabase (no real mechanism exists anywhere to call). Real callers (a
 * future task, once the schema gap above is resolved, or a verification
 * harness exercising fixture data) should supply their own `loadData` prop.
 */
export type LoadNoAccessDataFn = () => Promise<NoAccessData>;
