/**
 * T018: barrel export for the `/accept-invite` page component.
 *
 * `router.tsx` currently wires `/accept-invite` to its own inline
 * placeholder (see `AcceptInvitePage.tsx`'s module doc, gap #1). Once a
 * task with `router.tsx` in its Allowed Files does that wiring, the
 * expected import is
 * `import { AcceptInvitePage } from '../pages/accept-invite';`.
 */
export { AcceptInvitePage, default } from './AcceptInvitePage';
export type { AcceptInvitePageProps } from './AcceptInvitePage';
export type { AcceptInviteData, InviteRole, InviteStatus, LoadInviteFn } from './types';
