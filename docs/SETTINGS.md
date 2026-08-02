# Settings

> **Purpose:** Define the account and app-level settings RepX exposes to players.
> **Version:** 0.1.0
> **Status:** Draft
> **Last Updated:** 2026-08-01

## Table of Contents

1. [Account Settings](#account-settings)
2. [Notification Preferences](#notification-preferences)
3. [Privacy & Data](#privacy--data)
4. [App Preferences](#app-preferences)
5. [Open Questions](#open-questions)

## Account Settings

- Linked auth identities (Google/Apple/email — see
  [`docs/AUTHENTICATION.md`](AUTHENTICATION.md#account-linking)).
- Profile info (display name, avatar).
- *(Placeholder: device/session list and remote sign-out — referenced as
  planned in [`docs/AUTHENTICATION.md`](AUTHENTICATION.md#security-considerations).)*

## Notification Preferences

Category-level controls per [`docs/NOTIFICATIONS.md`](NOTIFICATIONS.md#user-control).

## Privacy & Data

- Camera/pose-tracking permission management.
- Data export/deletion requests (see
  [`docs/SECURITY.md`](SECURITY.md#open-questions)).

## App Preferences

*(Placeholder — units (metric/imperial where relevant), accessibility
preferences per [`docs/ACCESSIBILITY.md`](ACCESSIBILITY.md), theme if light/
dark mode ships per [`docs/DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md#open-questions).)*

## Open Questions

- Account deletion flow and its interaction with the ELO ledger (does a
  deleted account's match history remain for the opponent's record integrity?
  — relates to [`docs/DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md)).
