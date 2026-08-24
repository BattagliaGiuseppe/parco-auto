# P2.2 – Automatic Activity Reconciliation

Database migration is already LIVE on Supabase. **Do not execute SQL manually.**

Copy this patch into the repository root, commit and push.

## What it adds
- Connected session -> Event/Test -> Event car -> Event session -> Turn.
- Connected turns are marked `hours_source=connected`, so the existing turn-hours trigger does not count hours twice.
- Best/average lap are copied into turn metrics; V-max/RPM and exact engine/track times remain traceable in notes/session data.
- Reconciliation is idempotent and can be retried from the Connected Vehicles page.
- Unknown track strings do not create new circuit master records automatically.
- Ingest remains non-blocking: a reconciliation problem becomes `needs_review` rather than losing the device session.

## Live verification already performed
The P2.1 test session was reconciled successfully. A rollback simulation verified that car hours were identical before/after reconciliation and a second reconciliation returned duplicate=true.
