# RepX — Assets

Brand and design assets shared across the frontend app and marketing/docs surfaces.

## Status

🚧 Empty — no assets exist yet. Populated once [`docs/DESIGN_SYSTEM.md`](../docs/DESIGN_SYSTEM.md)
tokens and brand identity are finalized.

## Anticipated contents

```
assets/
├── brand/          # Logo lockups, wordmark, favicon source
├── icons/           # App icon source files (per-platform exports generated at build time)
├── fonts/            # Licensed font files
├── illustrations/    # Onboarding / empty-state illustrations
└── tokens/            # Design tokens (color, spacing, radius, motion) — source of truth
                        #   consumed by frontend/src/design-system
```

Platform-specific derived assets (e.g. `frontend/assets/`, iOS `Assets.xcassets`,
Android `mipmap-*`) are generated/copied from here at build time rather than
hand-duplicated, so there is a single source of truth per asset.
