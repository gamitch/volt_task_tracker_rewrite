# Cowork handoff — VOLT Portal swarm setup

You are picking up a finished planning phase. The four files in this folder are the complete context; no chat history exists or is needed. Precedence: VOLT_Portal_PRD.md (v1.5, requirement IDs are authoritative) > constitution.md > project-brief.md. astryx-api.md is the generated Astryx component API reference.

## Your job: prepare github.com/gamitch/volt_task_tracker_rewrite so George can run the swarm in Claude Code

1. Clone the repo into this working folder (ask George for the local path if it already exists).
2. Place files: project-brief.md → docs/swarm/project-brief.md (overwrite template); constitution.md → docs/swarm/constitution.md (overwrite template); astryx-api.md → docs/swarm/astryx-api.md; VOLT_Portal_PRD.md → docs/VOLT_Portal_PRD.md.
3. Ensure .gitignore covers .env, .env.*, *.local (the old repo leaked a .env — never again).
4. Create .env.local.example listing (values blank): VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and comments noting CHECKIN_HMAC_SECRET + RESEND_API_KEY live in Supabase Edge Function secrets, and OLD_SUPABASE_URL / OLD_SERVICE_ROLE_KEY are needed only for scripts/migrate.ts.
5. Generate a value for CHECKIN_HMAC_SECRET (openssl rand -hex 32), hand it to George in chat — do not write it to any tracked file.
6. Verify tooling: node ≥ 20, supabase CLI installed; report versions.
7. Commit ("Seed swarm docs: PRD v1.5, brief, constitution, Astryx API reference") and push after George confirms.
8. Walk George through the human-only prerequisites checklist (he has it from planning): new Supabase project (signups off, pg_cron on), Google OAuth client, Resend + mail.voltfrc.org DNS, Vercel, old-project keys, OQ-1 age check. You cannot create accounts or enter credentials for him.

Stop after step 7 and confirm before anything irreversible. Do not begin implementing the app — that is the swarm's job in Claude Code via /swarm-plan.
