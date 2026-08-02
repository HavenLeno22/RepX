# Accessibility

> **Purpose:** Define RepX's accessibility commitments, with particular
> attention to a product whose core interaction is physical movement in front
> of a camera.
> **Version:** 0.1.0
> **Status:** Draft
> **Last Updated:** 2026-08-01

## Table of Contents

1. [Standards](#standards)
2. [Motion & Camera-Based Interaction](#motion--camera-based-interaction)
3. [Visual Accessibility](#visual-accessibility)
4. [Open Questions](#open-questions)

## Standards

*(Placeholder — target conformance level, e.g. WCAG 2.1 AA where applicable to
a native mobile app, plus platform-native accessibility APIs (iOS
Accessibility, Android Accessibility Services) for all non-camera UI.)*

## Motion & Camera-Based Interaction

The core gameplay loop requires physical movement in front of a camera, which
is inherently exclusionary to players with certain mobility limitations. This
is a real product-design tension, not one this document can wave away —
flagged here as a priority open question for product/design rather than
something engineering can solve unilaterally in the AI/exercise engine.

Separately, reduced-motion support for the app's UI animations (see
[`docs/DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md#motion)) should respect the OS-level
reduced-motion setting regardless of the mobility question above.

## Visual Accessibility

*(Placeholder — color contrast requirements for the design system's token set,
dynamic type/font scaling support, screen reader labeling for all non-camera
screens.)*

## Open Questions

- Whether/how to offer alternative competitive modes for players who can't
  perform camera-tracked bodyweight exercises (adaptive exercise variants,
  seated exercises) — a product decision, not just an engineering one.
- Screen reader experience during an active match, given the primarily visual/
  physical nature of gameplay.
