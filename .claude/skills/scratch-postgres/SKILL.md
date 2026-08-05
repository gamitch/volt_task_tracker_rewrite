---
name: scratch-postgres
description: Stand up a disposable PostgreSQL cluster, load this repo's migrations, and prove a database-level claim by running it rather than reasoning about it. Use whenever a task turns on RLS policies, grants, view semantics, constraints, triggers, defaults, or ON CONFLICT behaviour — including any premise gate for migration work. Also use before believing a comment in a migration file about how RLS or views behave, and before writing a SQL assertion script.
---

# Scratch PostgreSQL

Database semantics are the one area of this repo where careful reading loses to
execution most reliably. **11 task entries** in `docs/swarm/verification-log.md`
rest on a scratch cluster, and the pattern that keeps recurring is a migration
comment asserting something Postgres does not do.

## Why this exists — a claim that has been wrong three times

Three migrations in this repo state that a plain view *"runs under the querying
session's own RLS against its base tables."* **It does not.** A view without
`security_invoker` executes with the **view owner's** rights, and an owner without
`FORCE ROW LEVEL SECURITY` bypasses RLS entirely.

That false claim was filed as D010, copied into a second migration, and nearly
derailed a third task before a scratch cluster settled it. Reading did not catch
it in over a week; one measurement did, in minutes.

**So: do not settle a database question from documentation, from a comment in the
repo, or from reasoning about how Postgres ought to work.**

## Starting one

```bash
.claude/skills/scratch-postgres/scripts/start.sh --port 55432
# ... psql -h /tmp -p 55432 -U postgres -d scratch ...
.claude/skills/scratch-postgres/scripts/start.sh --stop --port 55432
```

The script applies `supabase/migrations/*.sql` in order and stubs the Supabase-
managed `auth` schema that migrations reference but the repo does not define.

**`initdb` refuses to run as root.** The script runs the cluster as the `postgres`
user and fixes permissions; done by hand this fails with a silent empty data
directory and a confusing "server not running" error. That cost two attempts here.

## Proving the claim, not the call shape

**Assert post-write row state, not the statement you issued.** Query the row back
and compare values. A test that checks which SQL was generated proves nothing
about what the database did with it.

**Run the counterfactual in both directions.** Showing a view returns 3 rows is
half a proof; showing `set (security_invoker = on)` collapses it to 1 and `reset`
restores 3 is the other half. Without the second direction you have not localised
the cause.

**For before/after comparisons, split the migration loop.** Apply every migration
except the new one, snapshot, apply the new one, snapshot again, diff. Applying
everything at once cannot show what your migration changed.

## Does the result generalise to production?

This is the question a local result cannot answer by itself, and it matters
because the owner applies migrations to hosted Supabase and nowhere else.

**The mechanism can differ by object ownership.** Locally the owner may be a
superuser with `BYPASSRLS`; on hosted Supabase it is `postgres`, which owns the
tables and also carries `BYPASSRLS`.

**Test the weaker case.** Re-run with the objects owned by a role created
`NOSUPERUSER NOBYPASSRLS`. If the behaviour still holds there, it holds on hosted
Supabase *a fortiori*, and you can say so. If it only holds under a superuser, say
that instead — do not generalise silently.

## Denials do not all look alike

Getting this wrong produces a test that passes while asserting the wrong thing.

- A **cross-user INSERT** blocked by RLS raises `42501` (`insufficient_privilege`).
- A **cross-user UPDATE** blocked by RLS does **not** raise. The row is visible but
  outside the UPDATE's scope, so it reports `UPDATE 0`.
- A **NOT NULL violation** on an upsert fails on the INSERT leg *and* the conflict
  leg — Postgres checks the constraint on the candidate tuple before conflict
  arbitration.

An assertion built on catching an exception will silently pass for the UPDATE
case. Assert the affected-row count or re-read the row.

## Leave nothing behind

Stop the cluster and delete its data directory when finished, and say in your
output that you did. A scratch cluster is an instrument. If the assertions are
worth keeping, commit them as a script under `supabase/tests/` following
`run_t205_anon_grant.sh` — that directory is the durable home; the cluster is not.
