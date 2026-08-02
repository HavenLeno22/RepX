# Notifications

> **Purpose:** Define how RepX communicates with players outside the app —
> match events, competitive milestones, and re-engagement.
> **Version:** 0.1.0
> **Status:** Draft
> **Last Updated:** 2026-08-01

## Table of Contents

1. [Channels](#channels)
2. [Notification Categories](#notification-categories)
3. [Delivery Architecture](#delivery-architecture)
4. [User Control](#user-control)
5. [Open Questions](#open-questions)

## Channels

- Push notifications (FCM for Android, APNs for iOS — see
  `backend/.env.example` for the relevant config keys).
- In-app notifications/badges.

## Notification Categories

*(Placeholder — illustrative categories: match found (time-sensitive,
matchmaking-related — see [`docs/MATCHMAKING.md`](MATCHMAKING.md)), match
result, rating milestones, streak reminders, social (future — friend activity).)*

## Delivery Architecture

The `notifications` backend module (see
[`docs/SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md#backend-module-boundaries))
owns delivery. Time-sensitive notifications (match found) likely need a
different delivery path/priority than digest-style re-engagement notifications
(streak reminders) — exact design TBD.

## User Control

Notification preferences are part of [`docs/SETTINGS.md`](SETTINGS.md) — users
must be able to control category-level opt-in/out, not just a global on/off.

## Open Questions

- Push provider abstraction (direct FCM/APNs vs. a unified provider like
  OneSignal/Expo push service).
- Digest/quiet-hours support.
