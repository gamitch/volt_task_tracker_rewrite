# VOLT Team Portal — Redesign PRD

**Product:** VOLT Time Tracker → VOLT Team Portal (working name)
**Version:** 1.5 — July 12, 2026 (v1.1: exact source schema + migration mapping from `gamitch/volt-timetracker`; v1.2: domains locked — `portal.voltfrc.org`, `mail.voltfrc.org`; v1.3: per-route layout specs in 7.1; v1.4: shareable deep links NAV-08; v1.5: cheap-agent hardening — static Astryx API doc, normative SQL in 8.4, ICS library mandate, no-ASCII-in-DOM rule; v1.6: behavioral design rules 5.7 BEH-01…09 + motivation-ethics constitution rule)
**Owner:** George Mitchom (VOLT — Valkyries Of Leadership and Technology, FRC Team 11195)
**Consumers of this document:** The multi-agent swarm at `gamitch/volt_task_tracker_rewrite` (boss-architect, foreman-planner, worker/checker agents). Every requirement carries an ID so checkers can cite it in acceptance criteria.

---

## 0. How to use this document with the swarm

- **`docs/swarm/project-brief.md`** — a pre-filled drop-in version ships alongside this PRD (`project-brief.md`). Copy it into the repo verbatim.
- **`docs/swarm/constitution.md`** — Section 16 lists non-negotiables the boss-architect must add.
- **`docs/swarm/task-ledger.md`** — Section 14 provides the epic/task breakdown with acceptance criteria seeds. The boss-architect converts these into ledger entries; it may split tasks but must not drop requirements.
- **Requirement IDs** (e.g., `MTG-07`) are the authority. If a worker's implementation conflicts with an ID, the ID wins. If two IDs conflict, escalate to boss-arbiter; do not improvise.
- **Astryx is the only UI vocabulary.** Workers must consult component docs before use — see Section 5.6 for the exact CLI commands. Hand-rolled UI primitives that duplicate an existing Astryx component are a checker BLOCKER.

---

## 1. Product summary

VOLT's current time tracker (volt-timetracker.lovable.app) is a single shared-link app with no authentication: one dashboard, one event list mixing outreach, meetings, and competitions, and coach-entered attendance. It works, but it is coach-only in practice, meeting attendance is clunky, and there is no way for students or parents to have their own view.

The rewrite keeps the existing Supabase backend approach and rebuilds the product as a **role-aware, authenticated team portal** with:

1. **Meetings** and **Outreach** as fully separate sections — separate lists, separate stats. Meeting attendance produces a **participation %**; outreach attendance produces **volunteer hours toward season goals**. The two never mix in a list or a metric.
2. **Dead-simple attendance capture** — students self check-in by scanning a rotating QR code (or typing a short code), and the coach has a one-screen roll-call console that can override anything.
3. **Accounts and roles** — Admin, Coach, Student, Parent — via Supabase Auth (email/password + Google), closed roster, coach-sent invites, parent↔student linking.
4. **Email reminders** (Resend) and a **subscribable read-only calendar feed** (ICS) that drops VOLT events into Google Calendar.
5. A frontend rebuilt on **Meta's Astryx design system**, themed to VOLT's violet/blue brand, light + dark.

Band-style community features (posts, albums, files, chat) are explicitly **v2 backlog** (Section 13); the attached Band-inspired PRD is the reference document for that phase, not this one.

## 2. Locked decisions (do not revisit)

| # | Decision | Value |
|---|---|---|
| D1 | Backend | Keep Supabase (Postgres + Auth + Realtime + Edge Functions + Storage). New dedicated Supabase project owned by George; data migrated from the Lovable Cloud project. |
| D2 | Frontend | Greenfield SPA: **Vite + React 18 + TypeScript (strict)**, React Router, TanStack Query, Supabase JS client. **No Tailwind, no shadcn** — Astryx cascade layers replace them (see NFR-08). |
| D3 | Design system | **Astryx** (`@astryxdesign/core` + custom theme extending `@astryxdesign/theme-neutral`), dark mode via `mode="system"` with user override. |
| D4 | Attendance capture | **Both**: student self check-in (rotating QR / 6-char code) **and** coach roll-call console; coach entries always override. |
| D5 | Auth | Supabase Auth: email/password **and** Google OAuth. No Facebook in v1. |
| D6 | Account creation | **Closed roster.** Admin/Coach sends email invites; no open signup. |
| D7 | Parent linking | Parents are invited against specific student records; a parent sees only linked students. |
| D8 | Data | **Migrate all history** (events, roster, attendance/hours, teams, goals) from the current app. |
| D9 | Reminders | Built-in: **Resend** transactional email + Supabase scheduled functions (`pg_cron` → Edge Function). No Make/Zapier. |
| D10 | Calendar | **Read-only ICS feed** per user (subscribe URL for Google Calendar). Two-way Google Calendar sync = v2. |
| D11 | Band features | None in v1. Posts/albums/files/chat → v2 backlog. |
| D12 | Navigation | Left sidebar (`SideNav`) with Meetings and Outreach as separate top-level sections; role-aware Home. |
| D13 | Timezone | Display timezone `America/Chicago`; all timestamps stored UTC. |

## 3. Personas and role experiences

| Role | Who | Primary jobs | Primary device |
|---|---|---|---|
| **Admin** | George (head coach/lead) | Everything Coach does + seasons, teams, goals, invites, migration, exports | Desktop |
| **Coach** | Mentors / other coaches | Create meetings & outreach events, run check-in, mark days complete, monitor participation % and hours, view reports | Desktop + phone at the shop |
| **Student** | VOLT team members (assume 13–18; see OQ-1) | Check in to meetings, sign up for outreach, see own hours vs goal and participation % | Phone |
| **Parent** | Guardians of linked students | See kids' upcoming events, RSVP status, attendance/participation, receive reminders & weekly digest | Phone + email |

Persona acceptance smoke tests (used in final `/swarm-check`):

- **P-COACH:** From Home, a coach can start tonight's meeting check-in in ≤ 2 taps and see live status for every roster member on one screen.
- **P-STUDENT:** A student scanning the shop QR goes from camera to "You're checked in" in ≤ 10 seconds with no typing (when already signed in).
- **P-COACH2:** A second coach can open Reports and answer "which students are below 70% participation this season?" without exporting anything.
- **P-PARENT:** A parent opening the app sees, above the fold on a phone, each linked kid's next event and current hours/participation.

## 4. Information architecture & navigation

### 4.1 App shell

- **NAV-01** Use Astryx `AppShell` with `TopNav` (top slot) and `SideNav` (sidebar slot, `collapsible`); wrap the app in `Layer` provider and `Theme`.
- **NAV-02** `TopNav` contains: VOLT wordmark/logo (links Home), season selector (`Selector`, admin/coach only, defaults to active season), and user menu (`Avatar` + `DropdownMenu`: Profile, Appearance, Sign out).
- **NAV-03** `SideNav` items are filtered by role:

| Item | Route | Admin | Coach | Student | Parent |
|---|---|---|---|---|---|
| Home | `/` | ✓ | ✓ | ✓ | ✓ |
| Meetings | `/meetings` | ✓ | ✓ | ✓ | ✓ (read) |
| Outreach | `/outreach` | ✓ | ✓ | ✓ | ✓ (read + RSVP for kid) |
| Calendar | `/calendar` | ✓ | ✓ | ✓ | ✓ |
| Roster | `/roster` | ✓ | ✓ | — | — |
| Reports | `/reports` | ✓ | ✓ | — | — |
| Settings | `/settings` | ✓ | ✓ | ✓ | ✓ |

- **NAV-04** Active item highlighted by `SideNav`'s built-in state; current page also sets `document.title` ("Meetings · VOLT").
- **NAV-05** Mobile (< 768px): `SideNav` is replaced by Astryx `MobileNav` drawer triggered from `TopNav`. Student Home additionally surfaces a persistent **Check in** card whenever a meeting session is live (MTG-10) so check-in never requires navigation.
- **NAV-06** Route guards: unauthenticated → `/login`; authenticated but role lacks route → redirect to `/` with `Toast` "You don't have access to that page."
- **NAV-08 Shareable deep links:** every event/session detail is URL-addressable — `/outreach/:eventId` (outreach + competitions) and `/meetings/:sessionId` (meeting detail page replacing the dialog in CAL-02). Detail views and list-row `MoreMenu`s include **Copy link** (`Toast` "Link copied"). Unauthenticated visits store the intended URL and redirect back to it after login (including the Google OAuth round-trip). Invalid/inaccessible IDs render the DES-12 error state, revealing nothing about the event.
- **NAV-07** Meetings and Outreach are **separate routes with separate queries**. No screen may render a combined meetings+outreach list except Calendar (`/calendar`) and per-student history in Reports, where every row carries a type `Badge`.

### 4.2 Layout wireframes (desktop)

```
┌──────────────────────────────────────────────────────────────┐
│ TopNav:  ⚡VOLT      [Season: 2026–2027 ▾]        (🔔 v2) (👤)│
├───────────┬──────────────────────────────────────────────────┤
│ SideNav   │  COACH HOME (Analytics Dashboard template base)  │
│ ● Home    │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐     │
│ ○ Meetings│  │Particip│ │Hours vs│ │Attend. │ │Next 7d │     │
│ ○ Outreach│  │  %     │ │ goal   │ │last mtg│ │events  │     │
│ ○ Calendar│  └────────┘ └────────┘ └────────┘ └────────┘     │
│ ○ Roster  │  [Start check-in →]  [New outreach event]        │
│ ○ Reports │  ┌ Next up ─────────────┐ ┌ Recent signups ────┐ │
│ ○ Settings│  │ list of sessions     │ │ activity feed      │ │
│           │  └──────────────────────┘ └────────────────────┘ │
└───────────┴──────────────────────────────────────────────────┘
```

```
LIVE ATTENDANCE CONSOLE (/meetings/live/:sessionId, coach)
┌──────────────────────────────────────────────────────────────┐
│ ← Tuesday Build Meeting · 6:00–8:00 PM      [End meeting]    │
├────────────────────────────┬─────────────────────────────────┤
│  QR PANEL                  │  ROSTER  (search ⌕)  12/18 in   │
│  ┌──────────────┐          │  ● Ada Q.   [Present|Late|Exc|Ab]│
│  │   rotating   │ code:    │  ● Bea R.   [Present|Late|Exc|Ab]│
│  │      QR      │ 7 F 4 K 2 9  ○ Cy T.  [Present|Late|Exc|Ab]│
│  └──────────────┘          │  ...one Item row per student    │
│  [Open kiosk view ⤢]       │  (SegmentedControl per row)     │
└────────────────────────────┴─────────────────────────────────┘
```

```
STUDENT HOME (mobile, 375px)
┌──────────────────────────┐
│ ⚡ Hi Ada                 │
│ ┌──────────────────────┐ │
│ │ MEETING LIVE NOW     │ │  ← only while a session is live
│ │ [Scan QR] or code:   │ │
│ │ [ _ _ _ _ _ _ ] →    │ │
│ └──────────────────────┘ │
│ Your outreach hours      │
│ ▓▓▓▓▓▓▓░░░ 62 / 100 h    │
│ Participation: 87%       │
│ ── Next up ────────────  │
│ Sat · STEM Fair  [Going▾]│
│ Tue · Build Mtg  6–8 PM  │
│ ── Sign-up opportunities │
│ Jul 25 · Library demo    │
│            [Sign up]     │
└──────────────────────────┘
```

## 5. Design system & visual identity

### 5.1 Direction

VOLT's brand is electric: Valkyries, voltage, violet. The interface should feel like a well-lit robotics shop — calm neutral surfaces doing the work, with one live wire of color. Everything quiet, one signature moment loud.

- **DES-01 Signature element — the Check-in Bolt.** Successful student check-in shows a full-screen confirmation: a lightning-bolt mark draws in (~400ms), surface flashes to the accent color and settles, with "You're in" + `Timestamp` and a running tally ("14th in tonight"). This is the only orchestrated animation in the app. It must respect `prefers-reduced-motion` (instant state, no draw-in).
- **DES-02** Everything else uses Astryx defaults for motion and elevation. No decorative gradients, no card glows, no parallax.

### 5.2 Theme (exact spec)

- **DES-03** Create `src/theme/volt.ts` with `defineTheme` extending `neutralTheme`:

```tsx
import {defineTheme} from '@astryxdesign/core/theme';
import {neutralTheme} from '@astryxdesign/theme-neutral';

export const voltTheme = defineTheme({
  name: 'volt',
  extends: neutralTheme,
  color: {accent: '#5B2EE5', neutralStyle: 'cool'},
  typography: {
    heading: {
      family: 'Space Grotesk',
      url: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&display=swap',
      fallbacks: 'system-ui, sans-serif',
    },
    body: {
      family: 'Inter',
      url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap',
      fallbacks: '-apple-system, sans-serif',
    },
  },
  radius: {base: 6, multiplier: 1},
  tokens: {
    // [light, dark]
    '--color-accent': ['#5B2EE5', '#9B7BFF'],
  },
});
```

- **DES-04 Named palette** (the only brand colors; everything else comes from theme tokens):

| Name | Hex (light / dark) | Use |
|---|---|---|
| Volt Violet | `#5B2EE5` / `#9B7BFF` | Accent: primary buttons, active nav, progress toward goal, the Bolt |
| Circuit Blue | Astryx `blue` variant | Outreach type badge/cards |
| Meeting Violet | Astryx `purple` variant | Meeting type badge/cards |
| Comp Orange | Astryx `orange` variant | Competition type badge/cards |

- **DES-05** Attendance status colors use Astryx semantic variants only: Present = `success`, Late = `warning`, Excused = `neutral`, Absent = `error` (`StatusDot` / `Badge`).
- **DES-06** Theme provider: `<Theme theme={voltTheme} mode={userMode}>` where `userMode` ∈ `system | light | dark`, persisted per profile (SET-03). Both modes must pass WCAG AA contrast for accent-on-surface and text tokens (checker-accessibility verifies).
- **DES-07** Use the `/built` theme import + `theme.css` pattern for production (pre-built CSS, no runtime injection).

### 5.3 Layout & component conventions

- **DES-08** Page scaffolding: start from Astryx **templates**, then adapt — Coach Home from `Analytics Dashboard`; `/login` from `Basic Login`; Reports tables from `Grouped Table`. Emit with `npx astryx template <name>`.
- **DES-09** Page regions use `Section`; discrete items use `Card`/`ClickableCard`; rows use `Item` inside `List`; key-value blocks use `MetadataList`; data grids use `Table` with `PowerSearch` where filtering is specified.
- **DES-10** Forms use `FormLayout` + Astryx inputs (`TextInput`, `TextArea`, `NumberInput`, `DateInput`, `TimeInput`, `DateTimeInput`, `DateRangeInput`, `Selector`, `MultiSelector`, `RadioList`, `CheckboxInput`, `Switch`, `SegmentedControl`). Validation feedback via each input's `status` prop / `FieldStatus`; never bare red text.
- **DES-11** Destructive/irreversible actions (delete event, deactivate student, revoke calendar feed, cancel session) always confirm via `AlertDialog`.
- **DES-12** Every async list screen has all four states specified: loading (`Skeleton`), empty (`EmptyState` with one action), error (`Banner status="error"` with retry), populated. Workers must implement all four; checkers verify.
- **DES-13** Feedback: success/confirmation via `Toast`; persistent conditions via `Banner`.

### 5.4 Copy voice

- **DES-14** Sentence case everywhere. Plain verbs. Buttons say what happens: "Start check-in", "Mark day complete", "Send invite" — never "Submit" or "OK". An action keeps its name through the flow ("Send invite" → toast "Invite sent to ada@…").
- **DES-15** Empty states direct the next action. Examples (use these verbatim as defaults):
  - Meetings, coach: "No meetings scheduled. Set up your weekly build meetings once and check-in takes care of itself." → [Schedule meetings]
  - Outreach, student: "No upcoming outreach yet. When your coach posts an event, you can sign up here."
  - Reports: "No completed sessions this season yet. Stats appear after the first meeting or outreach day is marked complete."
- **DES-16** Errors say what happened and what to do: "That check-in code expired. Codes refresh every minute — grab the new one from the screen." No apologies, no "Oops".

### 5.5 Accessibility

- **DES-17** WCAG 2.1 AA. Keyboard path for every flow including the roll-call console (arrow through roster rows, 1–4 keys set Present/Late/Excused/Absent on the focused row). Visible focus, labels on all inputs, `aria-live="polite"` on the live check-in tally.

### 5.6 How agents must consult Astryx (constitution material) 

- **DES-18** Add to `package.json`: `"astryx": "node node_modules/@astryxdesign/cli/bin/astryx.mjs"`.
- **DES-19** The authoritative component API is the static file **`docs/swarm/astryx-api.md`** (generated from the installed package; ships with this PRD — regenerate on Astryx upgrades via `npm run astryx -- manifest --json` + `docs.mjs`). Workers copy prop names from that file; the CLI (`npm run astryx -- component <Name>`) is a live cross-check, not the primary source. A prop that does not appear in `astryx-api.md` is presumed hallucinated — checker MAJOR.
- **DES-20** Discovery commands: `npm run astryx -- component --list`, `npm run astryx -- template --list`, `npm run astryx -- docs theme`, `npm run astryx -- manifest --json`.
- **DES-21** Styling escalation order (do not skip steps): component as-is → theme token in `volt.ts` → `xstyle`/className on the component → custom CSS. Ejecting component source requires boss-architect approval.

### 5.7 Behavioral design rules (v1.6 — these extend/override the requirements they reference)

- **BEH-01 Milestones (goal gradient):** every hours-vs-goal `ProgressBar` (HOME-01/02/03, OUT-01, RPT-03) renders tick marks at 25/50/75/100%. Student/parent views add one line: "12 h to your next milestone". Crossing a milestone fires a single celebratory `Toast` ("75% of your goal — nice work ⚡"); dedupe per device (localStorage of last celebrated milestone per student+season).
- **BEH-02 Honest momentum:** the student hours bar renders confirmed hours (accent) plus MET-04 planned hours as a visually lighter second segment, legend "62 h confirmed + 14 h planned". The two are never summed into one number. Progress is never artificially inflated (no fake head starts).
- **BEH-03 One primary action (Student Home):** the hero card resolves to exactly ONE CTA by priority: live meeting check-in → oldest unanswered future RSVP ("You have 2 events to answer → Sign-up opportunities") → quiet greeting (no CTA). Never two primary `Button`s in the hero area.
- **BEH-04 RSVP completion nudge:** the SideNav Outreach item shows a neutral count `Badge` of unanswered future outreach sessions (student: own; parent: linked kids combined). Clears as answered. Neutral styling — never error/red, never urgency copy.
- **BEH-05 KPI card discipline:** one metric per `Card` — large value, small label, optional secondary trend/delta line. Never two numbers of equal visual weight in one card.
- **BEH-06 Consistency strip, not streaks:** student/parent meeting views (MTG-14, HOME-03) show the last 5 completed meetings as `StatusDot`s (present/late/excused/absent per DES-05). Streak counters and "don't break it" mechanics are prohibited (see constitution) — excused kids must never look like failures.
- **BEH-07 Smart defaults + computed buttons:** every form field pre-fills its most common value; event times and locations default to the creator's last-used values. Confirm buttons state their computed outcome: "Create 14 meetings", "Mark complete — 6 attended · 42 h", "Send 3 invites". A bare "Create"/"Submit"/"OK" is a checker MAJOR (extends DES-14).
- **BEH-08 Date rendering:** dates always carry weekday names ("Sat, Jul 25"); ranges and schedules show computed counts and durations ("Tue + Thu · 8 sessions", "6:00–8:00 PM · 2 h"). Applies everywhere sessions render, including emails and ICS summaries.
- **BEH-09 Say what happens next:** action confirmations state the next system event ("You're signed up — we'll remind you 2 days before"). RSVP controls carry helper text "You can change this until the event starts". The ICS Subscribe `Popover` states what the feed contains. Extends DES-14/16.

## 6. Feature requirements

### 6.1 Authentication & accounts

- **AUTH-01** Supabase Auth with providers: email/password and Google OAuth. Public signups **disabled** in Supabase settings.
- **AUTH-02** `/login` (from `Basic Login` template): email + password fields, "Continue with Google" `Button variant="secondary"`, "Forgot password" link (Supabase reset email). No self-serve "Create account" link.
- **AUTH-03 Invite flow (the only way in):**
  1. Admin/Coach creates a roster entry (student or parent) with email in `/roster` and clicks **Send invite**.
  2. Edge Function `send-invite` creates an `invites` row and calls Supabase `inviteUserByEmail` (email template branded via Resend, EML-01).
  3. Recipient lands on `/accept-invite`: shows their name + role, choice of "Set a password" or "Continue with Google".
  4. On first successful sign-in, a DB trigger matches `auth.users.email` to the pending invite, creates `profiles` with the invited role, links `students.profile_id` or `guardian_links` as appropriate, and marks the invite accepted.
- **AUTH-04** A Google sign-in with an email that has **no** pending invite or existing profile lands on a "You're not on the roster yet" screen (name of team contact, no data access) and the session is signed out. RLS independently guarantees zero data visibility for profile-less users.
- **AUTH-05** Roles: `admin | coach | student | parent`, stored on `profiles.role`, enforced by RLS (Section 8.3) — never by frontend checks alone.
- **AUTH-06** Invites expire after 14 days; `/roster` shows status (Pending / Accepted / Expired) with **Resend invite** action.
- **AUTH-07** Students may exist on the roster with no account (no email yet). All coach-side features work for account-less students; self check-in requires an account.
- **AUTH-08** Session persistence via Supabase client defaults; sign out from user menu.

### 6.2 Home dashboards (role-aware `/`)

- **HOME-01 Coach/Admin Home** (from `Analytics Dashboard` template), scoped to selected season:
  - KPI `Card`s: Team participation % (MET-02) · Total outreach hours vs team goal with `ProgressBar` · Attendance rate of last completed meeting · Events in next 7 days.
  - Primary actions: **Start check-in** (visible when a meeting session is live or starts within 60 min, deep-links to console) and **New outreach event**.
  - "Next up": next 5 sessions (any type, type `Badge`, RSVP/roster counts).
  - "Recent signups": last 10 RSVP changes for future outreach sessions ("Ada signed up for STEM Fair · 2h ago").
- **HOME-02 Student Home** (mobile-first): live-meeting check-in card when a session is live (MTG-10); hours `ProgressBar` (MET-04) + participation % (MET-01); "Next up" = their `going` sessions; "Sign-up opportunities" = future outreach sessions not yet responded to, with inline **Sign up** / **Can't go**.
- **HOME-03 Parent Home:** one `Card` per linked student: name + team badge, hours bar, participation %, next 3 events with RSVP status; RSVP control on behalf of student (OUT-06). Footer note: "You get a weekly summary by email every Sunday — manage in Settings."
- **HOME-04** Admin Home = Coach Home + a "Season setup" shortcut card when the active season is missing goals or teams.

### 6.3 Meetings & attendance (participation %)

**Scheduling**

- **MTG-01** `/meetings` (coach): `Section` "Upcoming" and `Section` "Past" lists of **meeting sessions** (`Item` rows: date, time range, team scope, status `Badge`, attendance summary for past). Actions: **Schedule meetings**, per-row `MoreMenu` (Edit, Cancel session — `AlertDialog`).
- **MTG-02** **Schedule meetings** `Dialog purpose="form"`: title (default "Team meeting"), team scope (`MultiSelector` of teams, default all), location, schedule mode (`SegmentedControl`: Single | Weekly recurring | Custom dates — parity with the current app), date/time pickers (`DateInput`/`TimeInput`, `DateRangeInput` for recurring range, weekday `CheckboxList` for recurring), notes. Creates one `events` row (type `meeting`) + one `event_sessions` row per date. Nothing is created until **Create meetings** is clicked; the button is disabled until title + at least one valid date exist.
- **MTG-03** Meetings do not use RSVP. Expected attendees = active roster of the scoped team(s) as of the session date.

**Live check-in**

- **MTG-04** A session is **live** from 15 minutes before `start_time` until `end_time`. Coach can also manually **Start check-in** early/late from the session row.
- **MTG-05** `/meetings/live/:sessionId` (coach console): two-pane layout per wireframe — QR panel + live roster.
- **MTG-06 Rotating code:** QR encodes `https://portal.voltfrc.org/checkin?s=<sessionId>&t=<token>`; alongside it a 6-character A–Z/2–9 short code. Token = HMAC-SHA256(`sessionId` + 60-second time bucket, `CHECKIN_HMAC_SECRET`), truncated; short code derived from the same HMAC. The Edge Function `checkin` accepts current and previous bucket (≤ 2 min validity). QR/code refresh client-side every 45 s. Short-code attempts rate-limited to 5/min per user.
- **MTG-07 Kiosk view** `/kiosk/:sessionId`: fullscreen QR + short code + live tally ("12 of 18 checked in"), meant for a shop TV/iPad on the coach's session. No roster names shown (privacy).
- **MTG-08 Student check-in:** scanning the QR (or entering the code on the Home card) calls `checkin`, which validates token, session liveness, and that the student belongs to the session's team scope, then upserts `attendance` with `method='qr'`, `check_in_at=now()`. Status auto-set: `present` if `check_in_at ≤ start_time + 10 min`, else `late`. Response renders the **Check-in Bolt** (DES-01). Errors per DES-16 (expired code, session not live, not on this team's roster).
- **MTG-09** Duplicate check-in is idempotent — show "Already checked in at 6:04 PM", no error.
- **MTG-10** Student Home live card (NAV-05): "Meeting live now" + 6-char code input + **Check in** button; same validation path as QR.
- **MTG-11 Coach roll call & override:** each roster row in the console has `SegmentedControl` [Present | Late | Excused | Absent]. A coach tap upserts with `method='coach'`, `recorded_by=coach`, and **always wins** over QR values (QR writes never overwrite a `method='coach'` row). Rows update in real time via Supabase Realtime subscription on `attendance` for the session.
- **MTG-12** Only coaches/admins may set `excused`.
- **MTG-13 End meeting:** button → `AlertDialog` summary ("14 present · 2 late · 1 excused · 1 absent") → sets session `completed`, fills `absent` for roster members with no attendance row, sets `check_out_at = end_time` for open check-ins. Completed sessions feed MET-01/02. Attendance remains editable by coaches after completion (audit-logged).
- **MTG-14 Student/parent meeting views:** `/meetings` for students = their own history (status per session) + participation %; parents see the same per linked student. Read-only.

### 6.4 Outreach & volunteer hours

- **OUT-01** `/outreach` (coach): season goal summary (`ProgressBar`: team total vs sum of student goals), "Upcoming" list (signup counts as `AvatarGroup` + number), "Past" list (hours awarded, people reached), **New outreach event** action.
- **OUT-02 New/edit outreach event** `Dialog` (parity with current app): title, description, location name + address, category fixed `outreach`, schedule mode (single / multi-day / recurring / custom dates → `event_sessions`), per-session start/end times, expected **people reached** placeholder per day, adult volunteers (`NumberInput` × 2: count and hours — persisted on `events` for grant reporting), team scope, **Share to calendar feed** on by default. Disabled **Create event** until title + ≥ 1 dated session.
- **OUT-03 Signups (RSVP):** students see future outreach sessions with `SegmentedControl` [Sign up | Maybe | Can't go] → `rsvps.status` ∈ `going | maybe | declined`, `responded_by = student`. Changing is allowed until session start.
- **OUT-04** Session detail `/outreach/:eventId`: `MetadataList` (when/where/scope), per-session signup lists grouped Going / Maybe / Can't go / No response, map link (plain Google Maps URL from address), creator, edit/cancel via `MoreMenu`.
- **OUT-05 Mark day complete (coach):** on/after a session date, **Mark day complete** opens a `Dialog`: attendee checklist pre-checked from `going` RSVPs (coach adjusts), actual **people reached** (`NumberInput`), optional per-student hours override (`NumberInput`, defaults to session duration, for partial attendance). Confirm → session `completed`; checked students get `attendance` rows (`method='coach'`, status `present`); hours computed per MET-03. Not reversible without edit (audit-logged).
- **OUT-06 Parent RSVP-on-behalf:** parents may set their linked student's RSVP; `responded_by = parent`. Student sees "Mom signed you up" (`Timestamp` + responder name) and may change it.
- **OUT-07** No QR check-in for outreach in v1 — completion is coach-driven (keeps the two capture models from blurring).
- **OUT-08** Leaderboard `Section` on `/outreach` (all roles): top 10 by season volunteer hours. Names render as "First L." when the privacy toggle is on (ROS-08, default on).

### 6.5 Competitions

- **CMP-01** Competitions are `events.type='competition'`, created from Calendar or Outreach's **New event** dialog via a type `Selector` (admin/coach). They appear in Calendar, Home "Next up", and reminders — but count toward **neither** participation % nor volunteer hours by default.
- **CMP-02** Per-event flags `counts_participation` / `counts_volunteer_hours` (default false for competitions, fixed true/false for meetings/outreach respectively) let an admin opt a special event into a metric. The UI exposes these flags only for competitions.
- **CMP-03** Competition sessions support RSVP (same as outreach) so coaches can plan travel/attendance.

### 6.6 Calendar & ICS feed

- **CAL-01** `/calendar`: Astryx `Calendar` month grid (`weekStartsOn="sun"`) + chronological session list below (parity with current app). Filter `SegmentedControl`: All | Meetings | Outreach | Competitions. Month prev/next/today controls. Sessions render as dots/labels colored per DES-04.
- **CAL-02** Clicking a session opens its detail (routes per NAV-08).
- **CAL-03 Subscribe:** **Subscribe** button → `Popover` with the user's personal ICS URL, **Copy link** button, "Add to Google Calendar: Settings → Add calendar → From URL" helper text, and **Reset link** (revokes old token, `AlertDialog`).
- **CAL-04 ICS spec:** Edge Function `GET /functions/v1/ics?token=<uuid>` — token maps to a profile via `calendar_feeds`; returns `text/calendar` with `X-WR-CALNAME: VOLT`, `REFRESH-INTERVAL;VALUE=DURATION:PT6H`. Includes sessions from 30 days past to all future **visible to that user's role** (students: team-scoped events; parents: linked students' events; coaches/admins: all). One `VEVENT` per session, `UID=<session_id>@volt`, `SUMMARY=[Meeting|Outreach|Comp] <title>`, `LOCATION`, `DESCRIPTION` includes RSVP status when applicable. Canceled sessions emit `STATUS:CANCELLED`. Feed generation MUST use the `ical-generator` npm package (`npm:ical-generator` in the Deno Edge Function) — hand-concatenated VCALENDAR strings (line folding, date formats) are a checker BLOCKER.
- **CAL-05** Feed is read-only and unauthenticated-by-token; tokens are UUIDv4, revocable, one active per profile.

### 6.7 Email notifications (Resend)

- **EML-01** All email through Resend as `VOLT Robotics <notifications@mail.voltfrc.org>` — the `mail.voltfrc.org` subdomain is verified in Resend (SPF + DKIM + DMARC records added at the voltfrc.org DNS host); env `RESEND_API_KEY`. Shared branded layout (wordmark, violet accent, footer with manage-preferences link). Every send logged to `email_log`.
- **EML-02 Templates (v1 set):**
  | ID | Trigger | To |
  |---|---|---|
  | invite | AUTH-03 | invitee |
  | signup-confirm | RSVP set to `going` | student (+ linked parents) |
  | event-reminder-48h | 48 h before outreach/competition session | `going` students + their parents |
  | event-reminder-3h | 3 h before same | same |
  | meeting-reminder-3h | 3 h before meeting session | students in scope (pref-gated, default **on**) |
  | weekly-digest | Sundays 5:00 PM CT | parents (default on) — per kid: last week's attendance, hours vs goal, next week's schedule |
- **EML-03 Scheduling:** `pg_cron` job every 15 min invokes Edge Function `send-reminders`, which selects due sessions, expands recipients, filters by `notification_prefs`, dedupes against `email_log` (never send the same template for the same session+recipient twice), and batches to Resend.
- **EML-04** Every email footer links to `/settings#notifications`; preferences per EML template category (SET-02). Transactional invite emails are not gated by preferences.
- **EML-05** No email content may include another student's data (a parent digest covers only linked students).

### 6.8 Roster & teams

- **ROS-01** `/roster` with `TabList`: **Students | Parents | Teams | Invites**.
- **ROS-02 Students tab:** `Table` (search by name via `PowerSearch`; filter by team, account status, active). Columns: `Avatar`+name, team `Badge`, grad year, account status (`StatusDot`: Active / Invited / No account), goal override, `MoreMenu` → Edit, Invite (if email), Invite parent, Deactivate (`AlertDialog`), View history.
- **ROS-03 Add/edit student** `Dialog`: name, email (optional), team `Selector`, grad year (optional), active `Switch`, individual goal override `NumberInput` (blank = inherit season default).
- **ROS-04 Parents tab:** parent rows with linked students (`AvatarGroup`), invite status, `MoreMenu` → Edit links, Resend invite, Remove (unlink + deactivate profile, `AlertDialog`).
- **ROS-05 Invite parent** (from a student row): email, relationship label, optional additional linked students (`MultiSelector`). Sends invite per AUTH-03.
- **ROS-06 Teams tab:** manage teams (name, short name, program FRC/FTC/Other, color chip from Astryx variants, sort order). Teams are **archived**, not deleted (matches old schema; archived teams disappear from selectors and expected rosters but keep history). Hard delete only when a team has no students or history, via `AlertDialog`.
- **ROS-07 Invites tab:** all invites with status, sent `Timestamp`, Resend / Revoke.
- **ROS-08 Admin toggles** (rendered on Roster for admin only): leaderboard privacy "Show first name + last initial publicly" (default on), season default goal hours shortcut (links Settings › Season).
- **ROS-09** Deactivating a student removes them from future expected rosters and leaderboards but preserves history and metrics for sessions while active.

### 6.9 Reports & exports

- **RPT-01** `/reports` (coach/admin), season-scoped, `TabList`: **Participation | Hours | Events**.
- **RPT-02 Participation tab:** `Grouped Table`-style table grouped by team: student, meetings expected / present / late / excused, participation % (MET-01) with `ProgressBar`, sortable; `PowerSearch` filter (team, below-% threshold, name). A "below 70%" quick filter chip answers P-COACH2.
- **RPT-03 Hours tab:** student, team, confirmed hours, planned hours (going RSVPs on future sessions × duration), goal, % to goal, `ProgressBar`; team subtotal rows; season totals for people reached and adult volunteers (count and hours).
- **RPT-04 Events tab:** all sessions with type, date, attendance/signup counts, hours awarded, people reached, adult volunteers, status.
- **RPT-05 CSV exports** (`Button variant="secondary"` per tab + a combined menu): `roster.csv`, `events.csv`, `attendance.csv`, `hours_by_student.csv`. Client-generated from the same queries, UTF-8, header row, ISO dates. Parity requirement: old app's "Download events CSV / roster CSV" consumers keep working (columns superset of old ones — verified during migration).
- **RPT-06** Students/parents do not access `/reports`; their equivalents live on Home and `/meetings`.

### 6.10 Settings

- **SET-01** `/settings` sections (`Section` + `FormLayout`): Profile (display name, avatar upload via `FileInput` → Supabase Storage), Appearance, Notifications, Calendar feed, Danger zone (Sign out everywhere).
- **SET-02 Notifications:** `Switch` per category from EML-02 relevant to the role; parents additionally choose digest on/off.
- **SET-03 Appearance:** `RadioList` System / Light / Dark → `Theme mode`, persisted to `profiles.theme_mode`.
- **SET-04 Season management (admin only, `/settings/season`):** create/edit seasons (name, start/end `DateRangeInput`, default goal hours `NumberInput`), set active season. Exactly one active season; switching prompts `AlertDialog`.

## 7. Screen inventory (routes × roles × states)

| Route | Roles | Base template/pattern | Key components | Notes |
|---|---|---|---|---|
| `/login` | public | `Basic Login` | `TextInput type="email/password"`, `Button` | AUTH-02 |
| `/accept-invite` | invited | Login Card pattern | — | AUTH-03 |
| `/` | all | `Analytics Dashboard` (coach) / custom stacks | `Card`, `ProgressBar`, `List` | HOME-01…04 |
| `/meetings` | all | List page | `Section`, `Item`, `Badge` | MTG-01, MTG-14 |
| `/meetings/live/:sessionId` | coach/admin | custom 2-pane | `SegmentedControl`, `StatusDot`, QR | MTG-05…13 |
| `/kiosk/:sessionId` | coach/admin | fullscreen | QR, tally | MTG-07 |
| `/checkin` | student | fullscreen result | Bolt (DES-01) | MTG-08/09 |
| `/outreach` | all | List page | `ProgressBar`, `AvatarGroup` | OUT-01…08 |
| `/outreach/:eventId` | all | Detail page template | `MetadataList`, `Dialog` | OUT-04/05 |
| `/calendar` | all | custom | `Calendar`, `SegmentedControl`, `Popover` | CAL-01…03 |
| `/roster` | coach/admin | `Grouped Table` | `Table`, `PowerSearch`, `TabList` | ROS-01…09 |
| `/reports` | coach/admin | `Grouped Table` | `Table`, `ProgressBar` | RPT-01…05 |
| `/settings` | all | Settings template | `FormLayout`, `Switch`, `RadioList` | SET-01…04 |

Every route implements the four states of DES-12. QR rendering uses a small MIT-licensed QR lib (e.g., `qrcode.react`); this is the only permitted non-Astryx UI dependency.

### 7.1 Per-route layout specs

Wireframes are **structural intent, not pixel specs** — spacing, sizing, and visual detail come from Astryx and the theme. Checkers verify region placement and content presence, never ASCII fidelity. **CRITICAL: never render box-drawing or bracket characters (┌ ─ │ [ ]) in the DOM — the sketches translate to Astryx `Card`/`Section`/`List` structure, nothing else.** Routes marked *template as-is* intentionally have no wireframe: emit the named template and adapt content only; inventing custom layout there is a checker MAJOR.

**Wireframed in 4.2 (do not duplicate):** Coach/Admin Home · Live attendance console · Student Home (mobile).

**Template as-is:** `/login` → `Basic Login` (fields per AUTH-02, VOLT wordmark above the card) · `/accept-invite` → `Login Card` pattern · `/reports` → `Grouped Table` per tab (columns per RPT-02…04) · `/settings` → Settings template (sections in SET-01 order). Dialog forms render fields **in the exact order listed** in MTG-02 (Schedule meetings) and OUT-02 (New outreach event).

**Parent Home** (`/`, parent, mobile-first) — one card per linked student:

```
┌──────────────────────────┐
│ ⚡ Hi Maria               │
│ ┌ Ada · Gear Girls ─────┐│
│ │ Hours ▓▓▓▓▓░░ 62/100 h││
│ │ Participation 87%     ││
│ │ Next up               ││
│ │ Sat STEM Fair [Going▾]││  ← RSVP-on-behalf (OUT-06)
│ │ Tue Build Mtg 6–8 PM  ││  ← meetings read-only
│ └───────────────────────┘│
│ ┌ Bea · P3 … same card ─┐│
│ "Weekly summary lands    │
│  Sundays → Settings"     │
└──────────────────────────┘
```

**Meetings list** (`/meetings`) — coach vs student variants:

```
COACH                              STUDENT
┌ Upcoming ───────────────────┐    ┌ Your participation: 87% ──┐
│ Tue Jul 14 · 6–8  [Start    │    │ Next: Tue Jul 14 6–8 PM   │
│   check-in]            [⋮]  │    ├ History ──────────────────┤
│ Thu Jul 16 · 6–8       [⋮]  │    │ Jul 09  ● Present         │
├ Past ───────────────────────┤    │ Jul 07  ◐ Late (6:14 PM)  │
│ Jul 09 · 14/18 present · 78%│    │ Jul 02  ○ Excused         │
│ [Schedule meetings]         │    └───────────────────────────┘
└─────────────────────────────┘    Parent = student view per kid.
```

**Kiosk** (`/kiosk/:sessionId`, fullscreen on shop TV/iPad):

```
┌──────────────────────────────────────┐
│         Tuesday Build Meeting        │
│   ┌────────────┐    Check in:        │
│   │     QR     │    code 7F4K29      │
│   │  (rotates  │    (refreshes ~45s) │
│   │   ~45s)    │                     │
│   └────────────┘                     │
│        12 of 18 checked in           │  ← aria-live tally
│   No student names on this screen.   │
└──────────────────────────────────────┘
```

**Check-in result** (`/checkin`, fullscreen, three end states):

```
SUCCESS (Bolt, DES-01)   ALREADY IN            ERROR (DES-16)
┌─────────────┐          ┌─────────────┐       ┌──────────────┐
│      ⚡      │          │      ✓      │       │      !       │
│  You're in  │          │  Already    │       │ That code    │
│  6:04 PM    │          │  checked in │       │ expired.     │
│  14th in    │          │  at 6:04 PM │       │ Codes refresh│
│  tonight    │          │             │       │ every minute.│
│   [Done]    │          │   [Done]    │       │ [Try again]  │
└─────────────┘          └─────────────┘       └──────────────┘
Reduced motion: success renders instantly, no draw-in.
```

**Outreach** (`/outreach`):

```
COACH (desktop)
┌ Season goal ────────────────────────────────────────┐
│ Team total ▓▓▓▓▓▓░░░░ 812 / 1,500 h    [New event]  │
├ Upcoming ───────────────────────────────────────────┤
│ Jul 25 · Library demo · 10–2   👤👤👤 8 going    [⋮] │
│ Aug 02 · STEM Fair · 9–4       👤👤 5 going      [⋮] │
├ Past ───────────────────────────────────────────────┤
│ Jul 05 · Scout camp · 42 h awarded · 120 reached [⋮] │
├ Leaderboard · top 10 (ROS-08 names) ────────────────┤
└─────────────────────────────────────────────────────┘
STUDENT: goal bar = own hours (MET-04); upcoming rows gain
[Sign up | Maybe | Can't go] SegmentedControl (OUT-03).
```

**Outreach detail** (`/outreach/:eventId`) + completion dialog:

```
┌ ← STEM Fair            [Mark day complete]  [⋮] ┐
│ MetadataList: when · where · teams · creator    │
│ Session: Sat Aug 2 · 9:00 AM–4:00 PM (7 h)      │
│ ┌ Going (8) ─┐ ┌ Maybe (2) ─┐ ┌ No response (5)┐│
│ │ avatar rows│ │            │ │                ││
└─────────────────────────────────────────────────┘
Mark day complete (Dialog, OUT-05):
  ☑ Attendee checklist (pre-checked from Going)
  People reached      [ 120 ]
  Adult volunteers    [ 4 ] count · [ 12 ] hours
  Hours per student   (default 7.0, per-row NumberInput)
  [Cancel]                       [Mark day complete]
```

**Calendar** (`/calendar`):

```
┌ [All|Meetings|Outreach|Comps]  ‹ July 2026 ›  Today  [Subscribe]┐
│  S   M   T   W   T   F   S     ● dots colored per DES-04        │
│              1   2   3   4                                      │
│  5   6   7●  8   9●  10  11                                     │
├ Session list (chronological; type Badge · time · RSVP counts) ──┤
│ Tue Jul 14 · Meeting · Build night · 6–8 PM                     │
│ Sat Jul 25 · Outreach · Library demo · 8 going                  │
└─────────────────────────────────────────────────────────────────┘
[Subscribe] → Popover: personal ICS URL · [Copy link] · [Reset link]
```

**Roster** (`/roster`, Students tab):

```
┌ [Students | Parents | Teams | Invites]      [Add student] ┐
│ ⌕ PowerSearch: name · team · account status · active      │
│ 👤 Ada Quinn   [Gear Girls]  2027  ● Active     100h  [⋮] │
│ 👤 Bea Ruiz    [P3]          2028  ◌ Invited      —   [⋮] │
│ 👤 Cy Tran     [Gear Girls]  2026  ○ No account   —   [⋮] │
│  ⋮ → Edit · Invite · Invite parent · View history ·       │
│      Deactivate (AlertDialog)                             │
└───────────────────────────────────────────────────────────┘
```

## 8. Data model & security

### 8.1 Tables (new Supabase project)

All tables: `id uuid pk default gen_random_uuid()`, `created_at timestamptz default now()`; FKs `on delete restrict` unless noted.

| Table | Fields (beyond id/created_at) |
|---|---|
| `profiles` | `id` = `auth.users.id` (pk, fk), `display_name text`, `email text unique`, `role role_enum('admin','coach','student','parent')`, `avatar_url text`, `theme_mode text default 'system'` |
| `teams` | `name text unique`, `short_name text`, `program text null check in ('FRC','FTC','Other')`, `color text`, `archived bool default false`, `sort_order int default 0` (short_name/archived/sort_order carried from old schema) |
| `seasons` | `name text`, `starts_on date`, `ends_on date`, `default_goal_hours numeric default 100`, `is_active bool` (partial unique index where true) |
| `students` | `profile_id uuid null fk profiles`, `display_name text`, `team_id fk teams`, `grad_year int null`, `is_active bool default true`, `goal_hours_override numeric null` |
| `guardian_links` | `parent_profile_id fk profiles`, `student_id fk students`, `relationship text`, unique(parent, student) |
| `invites` | `email text`, `role role_enum`, `student_id uuid null` (self for students / linked kid for parents), `invited_by fk profiles`, `status text('pending','accepted','expired','revoked')`, `expires_at timestamptz` |
| `events` | `season_id fk`, `type text('meeting','outreach','competition')`, `title`, `description`, `location_name`, `address`, `team_ids uuid[] null` (null = all teams), `counts_participation bool`, `counts_volunteer_hours bool`, `adult_volunteers_count int default 0`, `adult_volunteer_hours numeric default 0` (carried from old schema for grant reporting), `created_by fk profiles null` (null for imports) |
| `event_sessions` | `event_id fk on delete cascade`, `session_date date`, `starts_at timestamptz`, `ends_at timestamptz`, `status text('scheduled','completed','canceled')`, `people_reached int null`, `notes text` |
| `rsvps` | `session_id fk`, `student_id fk`, `status text('going','maybe','declined')`, `responded_by fk profiles null` (null for imports), `updated_at`, unique(session, student) |
| `attendance` | `session_id fk`, `student_id fk`, `status text('present','late','excused','absent')`, `check_in_at timestamptz null`, `check_out_at timestamptz null`, `hours_override numeric null`, `method text('qr','coach','import')`, `recorded_by fk profiles null`, `updated_at`, unique(session, student) |
| `notification_prefs` | `profile_id fk unique`, one bool per EML-02 category, `digest_enabled bool default true` |
| `calendar_feeds` | `profile_id fk`, `token uuid unique default gen_random_uuid()`, `revoked_at timestamptz null` |
| `email_log` | `to_email`, `template text`, `session_id uuid null`, `profile_id uuid null`, `status text`, `sent_at` |
| `audit_log` | `actor fk profiles`, `action text`, `entity text`, `entity_id uuid`, `meta jsonb` |

- **DATA-01** Derived metrics come from SQL views (`v_student_participation`, `v_student_hours`, `v_team_rollups`) implementing Section 9 exactly — the frontend never re-implements a formula.
- **DATA-02** Audit-log writes (DB triggers) for: attendance edits after session completion, role changes, deactivations, event/session cancellations, invite revocations.

### 8.2 Metric formulas (normative — Section 9 shorthand `MET-*`)

- **MET-01 Student participation %** (season) = `present+late marks` ÷ (`completed meeting sessions in season, in the student's team scope, while student active` − `excused marks`) × 100. Denominator floor 1; display "—" when no completed meetings. `counts_participation=true` sessions only.
- **MET-02 Team participation %** = Σ present+late marks ÷ Σ (expected − excused) across the same sessions (attendance-weighted aggregate, not an average of averages).
- **MET-03 Student session hours** (outreach/flagged) = `hours_override` if set, else `(check_out−check_in)` clamped to the session window if both exist, else scheduled session duration. Completed sessions with status present/late only.
- **MET-04 Hours vs goal** = Σ MET-03 ÷ (`goal_hours_override` ?? season `default_goal_hours`). Planned hours = Σ duration of future `going` sessions (shown separately, never added to confirmed).
- **MET-05** Late is present for every metric; it exists only as a visible flag.

### 8.3 Row Level Security (default deny)

RLS enabled on every table; no `anon` access except the `ics` and `checkin` Edge Functions (which use service role internally after validating token/JWT). Policy matrix (English; boss-architect emits SQL):

| Table | admin/coach | student | parent |
|---|---|---|---|
| profiles | read all; admin updates roles | read+update own (name, avatar, theme) | same as student |
| students | full | read own row + name/team of teammates (leaderboard) | read linked students |
| events / sessions | full | read team-scoped | read linked students' scope |
| rsvps | full | read/write own | read linked; write linked (responded_by=self) |
| attendance | full (writes audited) | read own; insert own only via `checkin` function | read linked |
| invites, audit_log, email_log | admin/coach read (invites write) | none | none |
| notification_prefs, calendar_feeds | own | own | own |

- **SEC-01** Email addresses and any contact info are visible only to admin/coach and the owner (Band PRD §19 carried forward).
- **SEC-02** No PII in URLs, logs, or analytics. Leaderboard obeys ROS-08.
- **SEC-03** `CHECKIN_HMAC_SECRET`, `RESEND_API_KEY` live only in Supabase Edge Function secrets.
- **SEC-04** All students are minors: no public pages, no indexing (robots noindex), no photos in v1, no last names in kiosk/leaderboard surfaces by default.

### 8.4 Reference SQL (normative — copy verbatim, do not re-derive)

Workers implement RLS and metrics by **copying this SQL**, not by translating Sections 8.3/9 themselves. Any policy that subqueries a table inside that same table's policy (the classic `profiles`-recursion bug) is a checker BLOCKER — role checks go through these `security definer` helpers only:

```sql
create or replace function auth_role() returns text
language sql stable security definer set search_path = public
as $$ select role from profiles where id = auth.uid() $$;

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(auth_role() in ('admin','coach'), false) $$;

-- students I am (student role) or I guard (parent role)
create or replace function my_student_ids() returns setof uuid
language sql stable security definer set search_path = public
as $$
  select id from students where profile_id = auth.uid()
  union
  select student_id from guardian_links where parent_profile_id = auth.uid()
$$;
```

Canonical policy shapes (every table in the 8.3 matrix uses exactly these three patterns with the matrix's scoping):

```sql
alter table attendance enable row level security;

create policy staff_all on attendance
  for all to authenticated
  using (is_staff()) with check (is_staff());

create policy own_or_linked_read on attendance
  for select to authenticated
  using (student_id in (select my_student_ids()));

-- profiles: no self-referential subqueries; auth.uid() + helpers only
create policy profiles_read on profiles
  for select to authenticated using (true);
create policy profiles_self_update on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = auth_role());  -- cannot change own role
```

Student self-inserts to `attendance` happen only inside the `checkin` Edge Function (service role after token validation) — there is **no** insert policy for students.

Metric views (implement MET-01…05; the frontend and reports read these views only):

```sql
create or replace view v_student_hours as
select
  a.student_id,
  e.season_id,
  sum(coalesce(
    a.hours_override,
    case when a.check_in_at is not null and a.check_out_at is not null
      then greatest(extract(epoch from
        (least(a.check_out_at, es.ends_at) - greatest(a.check_in_at, es.starts_at))) / 3600.0, 0)
    end,
    extract(epoch from (es.ends_at - es.starts_at)) / 3600.0
  )) as confirmed_hours
from attendance a
join event_sessions es on es.id = a.session_id and es.status = 'completed'
join events e on e.id = es.event_id and e.counts_volunteer_hours
where a.status in ('present','late')
group by a.student_id, e.season_id;

create or replace view v_student_participation as
with expected as (
  select s.id as student_id, s.team_id, es.id as session_id, e.season_id
  from students s
  join events e on e.counts_participation
    and (e.team_ids is null or s.team_id = any(e.team_ids))
  join event_sessions es on es.event_id = e.id and es.status = 'completed'
  where s.is_active
)
select
  x.student_id, x.team_id, x.season_id,
  count(*) as expected_ct,
  count(*) filter (where a.status in ('present','late')) as present_ct,
  count(*) filter (where a.status = 'late')    as late_ct,
  count(*) filter (where a.status = 'excused') as excused_ct,
  round(100.0 * count(*) filter (where a.status in ('present','late'))
        / greatest(count(*) - count(*) filter (where a.status = 'excused'), 1), 1)
    as participation_pct
from expected x
left join attendance a
  on a.session_id = x.session_id and a.student_id = x.student_id
group by x.student_id, x.team_id, x.season_id;

create or replace view v_team_participation as
select team_id, season_id,
  round(100.0 * sum(present_ct) / greatest(sum(expected_ct) - sum(excused_ct), 1), 1)
    as participation_pct
from v_student_participation
group by team_id, season_id;
```

Implementation note (accepted deviation from MET-01's "while active" phrasing): activity is the current `is_active` boolean — deactivated students drop out of the views (ROS-09 history remains in base tables). NFR-03 fixtures test: excused-shrinks-denominator, hours_override-wins, check-in clamping to the session window, and the no-completed-sessions "—" case (expected_ct = 0 rows simply absent; UI renders "—").

## 9. Integrations summary

| Integration | Mechanism | Env/config |
|---|---|---|
| Google OAuth | Supabase Auth provider | Google Cloud OAuth client (George creates; redirect = Supabase callback) |
| Resend | Edge Functions `send-invite`, `send-reminders` | `RESEND_API_KEY`, verified sending domain |
| Scheduling | `pg_cron` every 15 min → `send-reminders` | — |
| ICS | Edge Function `ics` | `calendar_feeds` tokens |
| QR check-in | Edge Function `checkin` | `CHECKIN_HMAC_SECRET` |
| Hosting | Static SPA on Vercel at **`portal.voltfrc.org`** (CNAME to Vercel; the public site at voltfrc.org is untouched) + Supabase | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

## 10. Migration plan (Lovable Cloud → new project)

Source of truth: **`github.com/gamitch/volt-timetracker`** (mirror of `/Users/georgemitchom/volt-timetracker`), migrations in `supabase/migrations/*.sql`, read and verified 2026-07-12. Data lives in the Lovable Cloud Supabase project referenced by the repo's env vars.

### 10.1 Source schema (as-built)

| Old table | Columns |
|---|---|
| `students` | id, name, team_affiliation (text; the app joins it against `teams.name`), active, goal_hours (nullable numeric), created_at |
| `events` | id, date, start_time (text), end_time (text), name, location, duration_hours, attendees uuid[] (legacy — backfilled into session_attendance by migration 2), adult_volunteers_count, adult_volunteer_hours, notes, is_multi_day, status ('planned'\|'completed'), category ('outreach'\|'meeting'\|'competition'), created_at |
| `event_sessions` | id, event_id (cascade), date, start_time (text), end_time (text), duration_hours, created_at |
| `session_attendance` | id, session_id, student_id, hours, planned (bool: **true = expected/RSVP, false = confirmed actual**), created_at, unique(session_id, student_id) |
| `teams` | id, name (unique), short_name, color, archived, sort_order, created_at — seeded: Gear Girls, Polytechnic Puzzle Pieces (P3), Skyline Robotics (archived), VOLT (archived) |
| `app_settings` | singleton row: season_goal (default 100) |
| views | `event_hour_summary`, `student_hour_summary` (student hours already filter to `category='outreach'` — the old app agrees with MET-03's outreach-only rule) |

Notable: **no `people_reached` column exists** — the deployed form field is not persisted, so that metric starts fresh in the new app. All old RLS policies are `USING (true)` for `anon`, including DELETE; the rewrite eliminates this.

### 10.2 Column mapping (normative — deviations require boss-arbiter)

| Old | New | Rule |
|---|---|---|
| `teams.*` | `teams.*` | 1:1 including short_name, archived, sort_order; `program` left null for George to set later |
| `students.name` | `students.display_name` | direct |
| `students.team_affiliation` | `students.team_id` | join on `teams.name`; unmatched values create an archived team and appear in the migration report |
| `students.goal_hours` | `students.goal_hours_override` | direct |
| `students.active` | `students.is_active` | direct |
| `app_settings.season_goal` | `seasons.default_goal_hours` | create season "2025–2026" spanning min→max session dates, `is_active=false`; George creates the new active season at cutover (SET-04) |
| `events.name / location / notes / category / adult_volunteers_count / adult_volunteer_hours` | `events.title / location_name / description / type / adult_volunteers_count / adult_volunteer_hours` | direct (category vocabulary is identical); `team_ids = null` (all-team scope); counts flags per type defaults (CMP-02); `season_id` assigned by date; `created_by = null` |
| `events.date / start_time / end_time / is_multi_day / attendees / status / duration_hours` | — | dropped: sessions are authoritative. ETL asserts migration 2's backfill covered every event and every `attendees[]` uuid before dropping |
| `event_sessions.date + start_time/end_time` (text) | `event_sessions.starts_at / ends_at` (timestamptz) | parse in America/Chicago; unparseable strings fall back to 00:00 and are flagged in the migration report |
| parent `events.status` | `event_sessions.status` | 'completed' when old event status='completed' AND session date ≤ cutover date, else 'scheduled' |
| `session_attendance` where `planned=true` | `rsvps` | status `going`, `responded_by = null` |
| `session_attendance` where `planned=false` | `attendance` | status `present`, `method='import'`, `check_in_at/check_out_at = null`, **`hours_override = old hours`, always set** — guarantees hour totals match the old views exactly |

Mapping notes: (a) migrated meetings carry all-team scope, so pre-cutover participation % is approximate — Reports label imported seasons "imported"; (b) no historical late/excused/absent data exists; imported attendance is present-only; (c) `notes` on old events lands in `events.description`.

### 10.3 Tasks

- **MIG-01 Schema verification:** the ETL run begins by introspecting the live old project and diffing against 10.1; any drift halts the run and updates `docs/migration/source-schema.md` for boss review.
- **MIG-02 Mapping:** Section 10.2 is the mapping document — copy it to `docs/migration/mapping.md` unchanged.
- **MIG-03 ETL script:** idempotent `scripts/migrate.ts` using service-role keys for both projects (env-provided, never committed), natural-key upserts, `--dry-run` mode printing per-table counts plus the migration report (unmatched teams, unparseable times, attendees-backfill mismatches) without writing.
- **MIG-04 Validation gates (checker-enforced):** per-table row counts match; per-student confirmed hours in new `v_student_hours` ≡ old `student_hour_summary.attended_hours`; per-event totals ≡ old `event_hour_summary`; adult volunteer count/hour sums match; George spot-checks 5 students.
- **MIG-05 Roster → accounts:** migrated students have `profile_id = null`; George adds emails afterward via Roster → Send invite (AUTH-07 keeps everything working meanwhile).
- **MIG-06 Cutover:** old app stays live and read-only until MIG-04 passes with George's sign-off; then retire the Lovable link and rotate or pause the old project's keys (its anon policies are world-writable and the repo is public — see security note in delivery message).

## 11. Non-functional requirements

- **NFR-01** TypeScript `strict`; ESLint + Prettier; CI: typecheck, lint, unit (Vitest), build.
- **NFR-02** Playwright smoke tests for the four persona flows (P-COACH, P-STUDENT, P-COACH2, P-PARENT) plus login and RLS-denial (student fetching another student's attendance gets zero rows).
- **NFR-03** Metric views (Section 9) covered by SQL/unit tests with fixture data, including the excused-denominator and hours-override cases.
- **NFR-04** Initial route JS < 300 KB gz; route-level code splitting; skeletons within 100 ms of navigation.
- **NFR-05** Live console updates ≤ 2 s after a QR check-in (Supabase Realtime).
- **NFR-06** Responsive 375 px → 1440 px; coach console usable on a phone (panes stack, QR collapses behind a button).
- **NFR-07** WCAG 2.1 AA per DES-17; checker-accessibility signs off per screen, both modes.
- **NFR-08** CSS cascade layers declared explicitly per Astryx migration docs (`@layer reset, astryx-base, app`); no unlayered global CSS.
- **NFR-09** All times stored UTC, rendered `America/Chicago` via `Timestamp`.

## 12. Phasing

**v1 (this PRD):** everything above.
**v1.1:** coach low-RSVP alert email; excused-absence request flow for parents; attendance edit history UI; kiosk PIN fallback for students without phones.
**v2 (Band-inspired backlog — see attached Band PRD for specs):** announcements/posts feed with composer; photo albums; file library; real-time chat + calls; push notifications; two-way Google Calendar sync; payments/sign-up/poll structured attachments.

## 13. Suggested swarm epics (boss-architect converts to task ledger)

| Epic | Scope (requirement IDs) | Acceptance seed |
|---|---|---|
| E1 Scaffold + theme | D2, D3, DES-03…21, NAV-01…07, NFR-01/04/08 | App shell renders both modes; `npm run astryx` works; CI green |
| E2 Schema + RLS + views | Section 8, DATA-01/02, NFR-03 | Migrations apply cleanly; RLS matrix verified by SQL tests; metric fixtures pass |
| E3 Auth + invites | AUTH-01…08, ROS-05/07, EML invite | Persona accounts created only via invite; Google email-mismatch path per AUTH-04 |
| E4 Roster + teams + seasons | ROS-01…09, SET-04 | Coach adds student, invites parent, links kid, overrides goal |
| E5 Meetings + check-in | MTG-01…14, DES-01, NFR-05 | P-COACH and P-STUDENT pass end-to-end with rotating code validation |
| E6 Outreach + RSVP + hours | OUT-01…08, CMP-01…03 | Mark-day-complete produces MET-03 hours; parent RSVP-on-behalf works |
| E7 Calendar + ICS | CAL-01…05 | Feed validates in Google Calendar; role scoping verified |
| E8 Email + scheduling | EML-01…05 | Reminder dedupe proven; digest renders per kid |
| E9 Reports + CSV | RPT-01…06, HOME-01…04 | P-COACH2 passes; CSV parity with old exports |
| E10 Migration | MIG-01…06 | Validation gates pass; George sign-off recorded |
| E11 Polish + a11y + smoke | DES-12/15/16, NFR-02/06/07 | Playwright suite green; a11y checker sign-off |

Dependency order: E1 → E2 → E3 → (E4, E5, E6 in parallel) → (E7, E8, E9) → E10 → E11.

### Constitution additions (Section 16 of the swarm's constitution)

1. RLS is default-deny; any table without policies is a BLOCKER.
2. UI must use Astryx components; consult docs via CLI before use (DES-19); escalation order DES-21.
3. Metric formulas live only in SQL views (DATA-01); duplicating them in TS is a BLOCKER.
4. No PII in logs, URLs, or fixtures with real student names.
5. Requirement IDs in this PRD outrank any agent preference; conflicts escalate to boss-arbiter.
6. Astryx props come only from `docs/swarm/astryx-api.md` (DES-19); RLS policies and metric views come only from Section 8.4, copied verbatim.
7. Motivation mechanics are limited to honest progress signals (Section 5.7). Loss-aversion framing, streaks, FOMO/scarcity, countdowns, guilt copy, and re-engagement pressure are prohibited → BLOCKER. Users are minors and volunteers; the app never optimizes for its own engagement.

## 14. v1 acceptance criteria (overall)

1. All four persona smoke tests (Section 3) pass on production build, mobile and desktop, light and dark.
2. Meetings and Outreach never appear in a combined list outside Calendar/Reports (NAV-07).
3. A QR check-in with an expired token fails with the DES-16 message; a valid one lands within the grace rule (MTG-08).
4. Coach override survives a subsequent QR write (MTG-11).
5. Participation % and hours match hand-computed fixtures including excused and override cases (MET-01…05).
6. ICS URL subscribed in Google Calendar shows role-correct events; reset invalidates the old URL.
7. Reminder emails send once per session+recipient+template; preferences and digest opt-out respected.
8. Migration validation gates (MIG-04) pass with George's sign-off.
9. An uninvited Google sign-in reaches no data (AUTH-04 + RLS test).
10. CSV exports open in Excel/Sheets with correct headers and ISO dates.

## 15. Assumptions & open questions

| ID | Item | Working assumption (used unless George overrides) |
|---|---|---|
| OQ-1 | Student ages | All 13+. If any student is under 13, that student gets no account in v1 (coach-managed attendance only) and we revisit consent flows. |
| OQ-2 | Source schema | **Resolved 2026-07-12:** schema read from `github.com/gamitch/volt-timetracker`; normative mapping now in Section 10.2. |
| OQ-3 | Late grace period | 10 minutes (constant `LATE_GRACE_MIN`, documented, not user-configurable in v1). |
| OQ-4 | Hosting | **Resolved 2026-07-12:** Vercel with custom domain `portal.voltfrc.org` (George owns voltfrc.org; one CNAME record). |
| OQ-5 | Sending domain | **Resolved 2026-07-12:** `mail.voltfrc.org` verified in Resend before E8 completes; sender `VOLT Robotics <notifications@mail.voltfrc.org>`. |
| OQ-6 | Default goal | 100 hours (matches current app) until season setup changes it. |
| OQ-7 | Parent RSVP-on-behalf | Enabled (OUT-06). Flip `counts` if the team prefers student-only RSVPs. |
