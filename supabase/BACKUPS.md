# Backup runbook

Before entering live results, choose retention and an approved secure backup destination with the committee. Do not commit backups or credentials. No paid backup service has been enabled.

With the Supabase CLI installed and linked securely to the selected project:

```sh
mkdir -p backups
supabase db dump --linked --file backups/schema.sql
supabase db dump --linked --data-only --use-copy --file backups/data.sql
```

Confirm the CLI version and its scope before relying on dumps: auth identities, roles and storage contents require separate handling. Keep encrypted, access-controlled copies outside the working machine. Export original objects from the private `result-sheets` bucket via Supabase's supported storage APIs using administrative credentials only in a trusted server process. Retain each object's path and its `result_sheets` metadata mapping. Browser public keys are not backup administrator credentials.

Restore first to an isolated test project, following the current Supabase restore documentation. Restore schema/data and original storage objects, re-establish the shared committee auth identity and committee membership, then verify login, RLS denials, result counts, audit history, sample photo checksums and signed URLs. Record the restore date, row/object counts and operator. A dump alone is not a verified backup. Automated backup scheduling and a restore drill are still required before production acceptance.
