// T099: proves the real, once-Passed T049 invite template
// (`src/emails/templates/invite.tsx`) is what actually renders at
// `send-invite/index.ts`'s three real-email call sites, and that T048's
// throwaway placeholder disclaimer sentence ("This is a placeholder message
// from T048's shared-layout fixture -- T049 owns the real invite template
// content.") is gone from this function's real output everywhere.
//
// WHY THIS FILE DOES NOT `import "./index.ts"` DIRECTLY (disclosed choice,
// not an oversight): `index.ts`'s own `handleResendInvite` doc comment
// already establishes -- and a prior, already-Passed task (T090) already
// verified -- that importing `index.ts` from any `deno test` file executes
// its unconditional top-level `Deno.serve(...)` call at module-load time,
// which throws `NotCapable: Requires net access ...` under this repo's
// established plain `deno test supabase/functions/send-invite/` invocation
// (no `--allow-net`/`--allow-env` flags; verified again for this task by a
// throwaway probe import, same empirical method T090 used). Separately (a
// second, independent blocker discovered while building THIS task, not
// introduced by it): `deno check`/`deno test`'s own type-checking pass on
// `index.ts` already fails on unrelated, pre-existing code --
// `writeEmailLog(adminClient, ...)` at both of its call sites (the
// service-role `SupabaseClient`'s inferred `.insert(...)` return type is
// structurally incompatible with `email_log.ts`'s own `EmailLogWriter`
// interface) -- confirmed via `deno check` against `git show HEAD:supabase/
// functions/send-invite/index.ts` (i.e. this error predates this task's own
// changes entirely; `email_log.ts` is outside this task's Allowed Files, so
// fixing that mismatch is explicitly out of scope here -- flagged in this
// task's worker output as a real, pre-existing gap for a future task/dispute,
// not silently absorbed into this one). Combining both blockers, this file
// instead verifies the exact same real-world property -- "the real template
// renders at all three call sites, and the placeholder string is gone" --
// two ways that need neither permission flag:
//   1. Renders T049's REAL, unmodified exported functions
//      (`buildInviteBodyHtml`/`buildInvitePreviewText`, imported directly
//      from their real source file below -- the exact same module Deno's
//      module cache resolves `index.ts`'s own import to) with representative
//      props, and asserts the placeholder string is absent from that real
//      output (this is the literal "provable via a test asserting the
//      rendered HTML does not contain that string" acceptance criterion for
//      the send path, T099's worker packet).
//   2. Reads `index.ts`'s own real source text (`--allow-read` only, no
//      network/env permission needed) and asserts, by direct inspection of
//      the actual shipped file, that: (a) the placeholder string is not
//      present anywhere in the file; (b) there is no import from
//      `inviteFixtureBody.ts` (T048's fixture) at all; (c) the import that
//      IS present resolves to T049's real template file; (d) each of the
//      three call sites this task's packet named textually calls the real,
//      non-fixture functions.
import assert from 'node:assert/strict';
import { buildInviteBodyHtml, buildInvitePreviewText } from '../../../src/emails/templates/invite.tsx';

const PLACEHOLDER_SENTENCE =
  "(This is a placeholder message from T048's shared-layout fixture -- T049 owns the real invite template content.)";
const PLACEHOLDER_FRAGMENT_1 = "T048's shared-layout fixture";
const PLACEHOLDER_FRAGMENT_2 = 'T049 owns the real invite template content';

function readIndexSource(): string {
  // `import.meta.url` anchors this to this test file's own real location
  // regardless of the cwd `deno test` is invoked from -- same directory as
  // `index.ts`, so a plain relative `./index.ts` resolves correctly.
  return Deno.readTextFileSync(new URL('./index.ts', import.meta.url));
}

// --- 1. Real render, using T049's real exported functions directly -------

Deno.test('buildInviteBodyHtml (T049 real template): rendered output never contains T048s placeholder sentence', () => {
  const html = buildInviteBodyHtml({ role: 'coach', inviterName: 'Jordan Lee', expiresInDays: 14 });
  assert.ok(!html.includes(PLACEHOLDER_SENTENCE), 'rendered body HTML must not contain the placeholder sentence');
  assert.ok(!html.includes(PLACEHOLDER_FRAGMENT_1), 'rendered body HTML must not mention T048s fixture');
  assert.ok(!html.includes(PLACEHOLDER_FRAGMENT_2), 'rendered body HTML must not mention "T049 owns..." disclaimer text');
  // Positive assertion too -- not just "placeholder text is absent", but
  // that this is genuinely the real, wired-through content: the inviter
  // name and real expiry this task's index.ts change passes through.
  assert.ok(html.includes('Jordan Lee'), 'real inviterName must appear in rendered output');
  assert.ok(html.includes('expires in 14 days'), 'real expiresInDays must appear in rendered output');
});

Deno.test('buildInviteBodyHtml (T049 real template): graceful-fallback path (no inviterName) also has no placeholder text', () => {
  const html = buildInviteBodyHtml({ role: 'parent', expiresInDays: 14 });
  assert.ok(!html.includes(PLACEHOLDER_SENTENCE));
  assert.ok(html.includes("You've been invited to join"));
});

Deno.test('buildInvitePreviewText (T049 real template): rendered preview text never contains placeholder wording', () => {
  const preview = buildInvitePreviewText({ role: 'admin', inviterName: 'Alex Rivera' });
  assert.ok(!preview.includes(PLACEHOLDER_FRAGMENT_1));
  assert.ok(!preview.includes(PLACEHOLDER_FRAGMENT_2));
  assert.ok(preview.includes('Alex Rivera'));
});

// --- 2. Source-text inspection of the real, shipped index.ts -------------

Deno.test('send-invite/index.ts source: the placeholder disclaimer string is gone everywhere in this file', () => {
  const source = readIndexSource();
  assert.ok(!source.includes(PLACEHOLDER_SENTENCE), 'full placeholder sentence must not appear anywhere in index.ts');
  assert.ok(!source.includes(PLACEHOLDER_FRAGMENT_1), '"T048\'s shared-layout fixture" must not appear anywhere in index.ts');
  assert.ok(
    !source.includes(PLACEHOLDER_FRAGMENT_2),
    '"T049 owns the real invite template content" must not appear anywhere in index.ts',
  );
});

Deno.test('send-invite/index.ts source: no longer imports T048s inviteFixtureBody.ts fixture at all', () => {
  const source = readIndexSource();
  // A historical/explanatory comment mentioning the old fixture's filename
  // is fine (this file's own header comment does exactly that, describing
  // the T099 swap) -- what must be genuinely gone is an actual `import`
  // statement pulling from it, and any call to its two exported functions.
  assert.ok(!/from\s+'[^']*inviteFixtureBody\.ts'/.test(source), 'index.ts must not import from inviteFixtureBody.ts');
  assert.ok(!source.includes('buildInviteFixtureBodyHtml('), 'the fixture body-builder must never be called');
  assert.ok(!source.includes('buildInviteFixturePreviewText('), 'the fixture preview-text builder must never be called');
});

Deno.test('send-invite/index.ts source: imports the real T049 template functions from the real template file', () => {
  const source = readIndexSource();
  assert.match(
    source,
    /import\s*\{\s*buildInviteBodyHtml,\s*buildInvitePreviewText\s*\}\s*from\s*'\.\.\/\.\.\/\.\.\/src\/emails\/templates\/invite\.tsx';/,
    'index.ts must import buildInviteBodyHtml/buildInvitePreviewText from the real src/emails/templates/invite.tsx',
  );
});

Deno.test('send-invite/index.ts source: call site 1 (main send path) calls the real template functions, not the fixture', () => {
  const source = readIndexSource();
  // Isolate the send path's own `renderEmailLayout({...})` call (the one
  // immediately preceded by "T099: real T049 template" -- the send path's
  // own comment above it) from the resend path's separate call.
  const sendPathMatch = source.match(
    /T099: real T049 template[\s\S]*?const emailHtml = renderEmailLayout\(\{([\s\S]*?)\}\);/,
  );
  assert.ok(sendPathMatch, 'expected to find the send path renderEmailLayout({...}) call');
  const block = sendPathMatch![1];
  assert.match(block, /buildInvitePreviewText\(/, 'send path previewText must call the real buildInvitePreviewText');
  assert.match(block, /buildInviteBodyHtml\(/, 'send path bodyHtml must call the real buildInviteBodyHtml');
  assert.ok(!block.includes('Fixture'), 'send path renderEmailLayout call must not reference any Fixture-named function');
});

Deno.test('send-invite/index.ts source: call site 2 (resend paths preview text) no longer uses the fixture preview-text function', () => {
  const source = readIndexSource();
  const resendMatch = source.match(/const emailHtml = renderEmailLayout\(\{\s*previewText: (\w+)\(/);
  assert.ok(resendMatch, 'expected to find the resend path renderEmailLayout call and its previewText call');
  assert.notEqual(resendMatch![1], 'buildInviteFixturePreviewText', 'resend previewText must not call the fixture function');
});

Deno.test('send-invite/index.ts source: call site 3 (buildResendInviteBodyHtml) has real, expiry-based closing copy, not the placeholder', () => {
  const source = readIndexSource();
  const fnMatch = source.match(/function buildResendInviteBodyHtml\([^)]*\): string \{([\s\S]*?)\n\}/);
  assert.ok(fnMatch, 'expected to find buildResendInviteBodyHtml\'s function body');
  const body = fnMatch![1];
  assert.ok(!/placeholder/i.test(body), 'buildResendInviteBodyHtml must not contain any "placeholder" wording');
  assert.ok(!body.includes(PLACEHOLDER_FRAGMENT_1), 'buildResendInviteBodyHtml must not reference T048s fixture');
  assert.ok(
    body.includes('expires in ${params.expiresInDays} days'),
    'buildResendInviteBodyHtml must report a real, parameterized expiry in its closing line',
  );
});

Deno.test('send-invite/index.ts source: buildResendInviteBodyHtml is called with a real expiresInDays value (INVITE_EXPIRY_DAYS), not omitted', () => {
  const source = readIndexSource();
  assert.match(
    source,
    /buildResendInviteBodyHtml\(\{\s*role: updatedInvite\.role,\s*actionLink: linkData\.properties\.action_link,\s*expiresInDays: INVITE_EXPIRY_DAYS,\s*\}\)/,
    'the resend call site must pass a real expiresInDays (INVITE_EXPIRY_DAYS), matching the freshly computed expires_at window',
  );
});
