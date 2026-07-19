// src/emails/layout/renderEmailLayout.ts
//
// T048 -- EML-01's "shared branded layout" (VOLT wordmark, violet accent,
// footer with a manage-preferences link). Every send is logged separately by
// the caller (see `supabase/functions/send-invite/email_log.ts`) -- this
// module only produces HTML, it never touches a database or the network.
//
// WHY A PLAIN TEMPLATE-LITERAL MODULE, NOT REACT/JSX (Known Context/Traps #3
// in this task's worker packet): this file is deliberately zero-dependency
// TypeScript -- no React/JSX, no CSS import, no `@astryxdesign/*` import --
// so the exact same source file is importable, byte-unchanged, from BOTH:
//   1. the src/ Vite/tsc toolchain (future T049/T050/T051 templates under
//      src/emails/templates/**), and
//   2. the Deno runtime `supabase/functions/send-invite/index.ts`, via a
//      relative import that reaches outside its own function directory
//      (`../../../src/emails/layout/renderEmailLayout.ts`) -- the same kind
//      of cross-directory relative import Supabase's own docs use for a
//      `supabase/functions/_shared/` helper, just one level further up the
//      repo tree. Deno resolves relative file imports by file-system path
//      regardless of directory depth, and this file has no dependency that
//      would fail to resolve identically under Deno vs. tsc/Vite (no JSX,
//      no bundler-specific syntax, no `import.meta.env`).
// A React/JSX-based email renderer (an `@react-email/*`-style package,
// which is how HTML emails are conventionally built with React) was
// explicitly rejected: it is not on the constitution item 9 dependency
// allowlist, and even if it were, it only runs inside a bundler/Node build
// step -- there is no such build step wired between src/ and the Deno Edge
// Function today, so a JSX-based layout would not be consumable from
// send-invite/index.ts without adding new infrastructure this task is not
// scoped to build. A hand-written HTML-string function has no such gap.
//
// RESIDUAL RISK (flagged explicitly, not silently assumed away): whether
// Supabase's real deploy bundler (`supabase functions deploy` / the eszip
// bundling it uses) actually walks and includes a relative import that
// reaches all the way from `supabase/functions/send-invite/` up to
// top-level `src/emails/layout/` has NOT been verified against a live
// Supabase CLI/Docker in this sandbox (Docker Hub / deno.land network
// egress is blocked here, the same class of block already documented for
// T017/T032's "External Blocker" sections). This is the single largest
// unverified assumption in this task's Deno-side wiring; a checker with
// Docker access should confirm `supabase functions deploy send-invite`
// (or at minimum `deno check`/`deno bundle` against this import graph)
// actually resolves this path before treating it as production-ready.
//
// Email HTML constraints (why this looks different from a normal
// component): most email clients strip external stylesheets, many strip
// `<style>` blocks entirely, and none run JavaScript -- so this uses
// table-based layout with INLINE styles for everything that must render
// correctly everywhere, plus a best-effort `<style>` block (silently
// ignored by clients that strip it, falling back to the inline light-mode
// styles, which remain fully readable either way) for
// `prefers-color-scheme: dark` support only.
import { ACCENT_DARK, ACCENT_LIGHT, MANAGE_PREFERENCES_URL, ON_ACCENT_DARK, ON_ACCENT_LIGHT } from './constants.ts';

export interface RenderEmailLayoutOptions {
  /**
   * Shown by email clients in the inbox list/preview pane; hidden in the
   * rendered body via a zero-size, hidden span. Plain text -- this function
   * escapes it internally, do not pass pre-escaped HTML here.
   */
  previewText: string;
  /**
   * Trusted HTML for the email's own content area. The caller (a specific
   * template -- e.g. this task's own `inviteFixtureBody.ts`, or a future
   * T049/T050/T051 template) owns escaping any dynamic values it
   * interpolates into this string before passing it in; this layout
   * wrapper does not re-escape it, the same way a React parent does not
   * re-escape a `children` prop's own internal content.
   */
  bodyHtml: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Wraps template-specific `bodyHtml` in VOLT's shared branded email layout:
 * wordmark header, violet accent, manage-preferences footer link (EML-01).
 * Returns a complete, standalone HTML document string ready to hand to
 * Resend's `html` send field.
 *
 * EML-04 note: the manage-preferences footer link below is present on
 * every email this layout wraps, per EML-01's "footer with
 * manage-preferences link" requirement -- that is unconditional. EML-04's
 * "Transactional invite emails are not gated by preferences" is a separate
 * concern (whether a *send* is skipped/allowed based on `notification_prefs`
 * for a given category), not about hiding this footer link; this task does
 * not implement any preference-gating logic (out of scope -- send-invite's
 * own send is unconditional once an invite is created, matching EML-04).
 */
export function renderEmailLayout(options: RenderEmailLayoutOptions): string {
  const previewText = escapeHtml(options.previewText);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>VOLT Robotics</title>
    <style>
      /* Best-effort dark-mode support only -- many email clients strip
         <style> blocks entirely and fall back to the inline light-mode
         styles below, which remain fully readable either way. */
      @media (prefers-color-scheme: dark) {
        .volt-body { background-color: #17131f !important; }
        .volt-card { background-color: #241d33 !important; color: #f4f2fb !important; }
        .volt-wordmark { color: ${ACCENT_DARK} !important; }
        .volt-accent-bar { background-color: ${ACCENT_DARK} !important; color: ${ON_ACCENT_DARK} !important; }
        .volt-footer { color: #b9b2cc !important; }
        .volt-footer a { color: ${ACCENT_DARK} !important; }
      }
    </style>
  </head>
  <body class="volt-body" style="margin:0; padding:0; background-color:#f3f1fa; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,sans-serif;">
    <span style="display:none; visibility:hidden; opacity:0; height:0; width:0; overflow:hidden; mso-hide:all;">
      ${previewText}
    </span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f1fa; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="volt-card" style="max-width:560px; background-color:#ffffff; border-radius:12px; overflow:hidden;">
            <tr>
              <td class="volt-accent-bar" style="background-color:${ACCENT_LIGHT}; color:${ON_ACCENT_LIGHT}; padding:20px 32px;">
                <span class="volt-wordmark" style="font-family:'Space Grotesk',-apple-system,sans-serif; font-weight:700; font-size:22px; letter-spacing:1px; color:${ON_ACCENT_LIGHT};">VOLT</span>
                <span style="font-size:13px; opacity:0.85; margin-left:8px;">Robotics</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px; color:#1c1830; font-size:15px; line-height:1.6;">
                ${options.bodyHtml}
              </td>
            </tr>
            <tr>
              <td class="volt-footer" style="padding:20px 32px; border-top:1px solid #eae7f5; color:#6b6480; font-size:12px; line-height:1.6;">
                VOLT Robotics &middot; FRC Team Portal<br />
                Manage which emails you receive: <a href="${MANAGE_PREFERENCES_URL}" style="color:${ACCENT_LIGHT};">${MANAGE_PREFERENCES_URL}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
