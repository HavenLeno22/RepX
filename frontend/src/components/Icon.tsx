/**
 * The RepX icon family.
 *
 * Replaces the emoji the product used to navigate with. Emoji were the single
 * most damaging shortcut in the old build: they render as a different artwork on
 * every operating system, they carry their own colours (so ⚔️ put a brown handle
 * and a grey blade next to Electric Lime), they cannot inherit `currentColor`,
 * and they sit on a baseline no two of them agree on. A navigation rail built
 * from them cannot look intentional on any device you did not personally test.
 *
 * These are 24×24 stroke icons on a single grid, drawn to one specification:
 * 1.75 stroke, round caps and joins, no fills. They inherit colour and size from
 * their parent, so an icon inside a lime button is lime-ink automatically and an
 * icon in muted text is muted.
 *
 * Hand-authored rather than pulled from a package because the whole set is ~40
 * paths — smaller than the dependency's tree-shaking metadata, and it can never
 * drift when someone upgrades a minor version.
 *
 * Sizes are the four in the design system: 16 (small), 20 (medium), 24 (large),
 * 32+ (hero). Anything else is a mistake.
 */

import type { SVGProps } from "react";

export type IconName =
  | "home"
  | "trophy"
  | "swords"
  | "sword"
  | "activity"
  | "settings"
  | "bell"
  | "user"
  | "users"
  | "medal"
  | "crown"
  | "gem"
  | "flame"
  | "calendar"
  | "chevron-up"
  | "chevron-down"
  | "chevron-right"
  | "chevron-left"
  | "check"
  | "check-circle"
  | "star"
  | "grid"
  | "zap"
  | "rotate"
  | "target"
  | "info"
  | "search"
  | "plus"
  | "x"
  | "play"
  | "camera"
  | "shield"
  | "trending-up"
  | "clock"
  | "history"
  | "sparkle"
  | "lock"
  | "globe"
  | "brain"
  | "dumbbell"
  | "log-out"
  | "bar-chart"
  | "skull"
  | "handshake";

/** Path data only — every icon shares the same svg wrapper below. */
const PATHS: Record<IconName, string> = {
  home: "M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5M9.5 20v-6h5v6",
  trophy:
    "M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8.5 21h7",
  swords:
    "M4 3h3l9 9-3 3-9-9V3ZM20 3h-3l-4 4M13.5 16.5 17 20l3-3-3.5-3.5M3.5 17 7 20.5M2.5 20 6 16.5",
  sword: "M6 3h3l11 11-3 3L6 6V3ZM13.5 16.5 17 20l3-3-3.5-3.5",
  activity: "M3 12h3.5l2.5-7 5 14 2.5-7H21",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.7 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 15.1 4.7a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.09a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1.03Z",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  medal:
    "M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM8.2 13.8 7 22l5-3 5 3-1.2-8.2M12 6.5l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2L9 8.7l2-.3Z",
  crown: "M3 18h18M3 18 2 7l5.5 4L12 4l4.5 7L22 7l-1 11M8 14.5h8",
  gem: "M6 3h12l3 6-9 12L3 9l3-6ZM3 9h18M9.5 3 7.5 9l4.5 12M14.5 3l2 6-4.5 12",
  flame:
    "M12 22a7 7 0 0 0 7-7c0-5-4-6-4-10 0 0-3 1.5-3 5 0 1.5-1 2-1.5 1.5C10 11 10 9 10 9s-5 2.5-5 6a7 7 0 0 0 7 7Z",
  calendar:
    "M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6ZM4 10h16M8 3v4M16 3v4",
  "chevron-up": "m5 15 7-7 7 7",
  "chevron-down": "m5 9 7 7 7-7",
  "chevron-right": "m9 5 7 7-7 7",
  "chevron-left": "m15 5-7 7 7 7",
  check: "m4 12.5 5.5 5.5L20 6",
  "check-circle": "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM8 12.2l2.8 2.8L16 9.5",
  star: "m12 3 2.9 5.9 6.6.9-4.8 4.6 1.2 6.5-5.9-3.1-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9L12 3Z",
  grid: "M4 4h7v7H4V4ZM13 4h7v7h-7V4ZM4 13h7v7H4v-7ZM13 13h7v7h-7v-7Z",
  zap: "M13 2 4 14h7l-1 8 9-12h-7l1-8Z",
  rotate: "M21 12a9 9 0 1 1-3-6.7M21 3v6h-6",
  target:
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16v-4.5M12 8.2v.1",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.4-4.4",
  plus: "M12 5v14M5 12h14",
  x: "M6 6l12 12M18 6 6 18",
  play: "M6.5 4.5 19 12 6.5 19.5v-15Z",
  camera:
    "M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8ZM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  shield: "M12 3l8 3.5v5c0 5-3.4 8.9-8 10.5-4.6-1.6-8-5.5-8-10.5v-5L12 3Z",
  "trending-up": "M3 17.5 9.5 11l4 4L21 7.5M15.5 7.5H21V13",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5.2l3.4 2",
  history: "M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3 4v5h5M12 7.5v5l3.5 2",
  sparkle:
    "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3ZM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z",
  lock: "M6 11a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-8ZM8.5 9V7a3.5 3.5 0 1 1 7 0v2",
  globe:
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3.5 9h17M3.5 15h17M12 3c2.2 2.4 3.4 5.6 3.4 9S14.2 18.6 12 21c-2.2-2.4-3.4-5.6-3.4-9S9.8 5.4 12 3Z",
  brain:
    "M9.5 3.5A3 3 0 0 0 6.6 7a3 3 0 0 0-1.8 5.2A3 3 0 0 0 6.6 17a3 3 0 0 0 2.9 3.5V3.5ZM14.5 3.5A3 3 0 0 1 17.4 7a3 3 0 0 1 1.8 5.2A3 3 0 0 1 17.4 17a3 3 0 0 1-2.9 3.5V3.5ZM12 3.5v17",
  dumbbell: "M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11",
  "log-out":
    "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l4-4-4-4M14 12H3.5",
  "bar-chart": "M4 20V10M10 20V4M16 20v-7M22 20H2",
  skull:
    "M12 3a8 8 0 0 0-8 8c0 2.6 1.3 4.4 3 5.5V20a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3.5c1.7-1.1 3-2.9 3-5.5a8 8 0 0 0-8-8ZM9 11.5v.1M15 11.5v.1M10.5 21v-3M13.5 21v-3",
  handshake:
    "m11 17-3.5-3.5M3 11l4-4 4 3 3-2 4 3.5M21 13l-4 4-3-3M7 20l-3-3M17 20l3-3",
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  /** 16 small · 20 medium · 24 large · 32+ hero. */
  size?: number;
  strokeWidth?: number;
}

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.75,
  ...rest
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      // Icons in RepX are always paired with a label or sit inside a control that
      // has one, so they are decorative to a screen reader by default. A caller
      // that genuinely needs an announced icon passes aria-label, which overrides
      // this.
      aria-hidden={rest["aria-label"] ? undefined : true}
      focusable="false"
      style={{ display: "block", flexShrink: 0, ...rest.style }}
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Exercise slug → icon. Keeps the mapping in one place rather than letting the
 *  server's emoji field leak into a UI that no longer uses emoji. */
export const EXERCISE_ICONS: Record<string, IconName> = {
  "push-up": "activity",
  squat: "dumbbell",
  "pull-up": "trending-up",
  "sit-up": "rotate",
  "jumping-jack": "sparkle",
  burpee: "zap",
  plank: "clock",
};

export function exerciseIcon(slug: string): IconName {
  return EXERCISE_ICONS[slug] ?? "dumbbell";
}
