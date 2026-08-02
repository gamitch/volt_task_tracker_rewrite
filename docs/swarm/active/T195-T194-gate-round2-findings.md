# T195 + T194 premise gate — round 2

## Verdict

**REVISE — BLOCKER.** Round one’s product and security corrections were
accepted. Two verification prescriptions still needed correction.

## Remaining findings and resolution

1. The supplied PostgreSQL 17 gate cannot install the unrelated
   `20260719000000_cron.sql` migration because plain PostgreSQL lacks
   Supabase-hosted `pg_cron`, `pg_net`, and Vault. The checker experimentally
   applied every other current migration unchanged using the packet’s required
   auth/storage scaffolding. The packet now requires skipping exactly that one
   named platform migration, prints the skip, and forbids skipping or rewriting
   any other production migration.
2. The round-one hostile ownership mutation still left the attacker's normal
   active feed in place. Even after disabling RLS and the explicit identity
   check, inserting another feed for the attacker hit the partial unique index,
   rolled the function back, and kept the cross-owner test green. The revised
   mutation now also creates the replacement for the target row’s returned
   profile id. That deliberately defeats all three independent protections and
   makes the target-row replacement observable.

## Gate status

This was the second ordinary premise round. Constitution item 19 requires a
`DISPATCH` verdict before implementation and item 19a requires human-owner
authorization before a third premise round. No worker may receive this packet
until that escalation is authorized and the corrected packet passes.
