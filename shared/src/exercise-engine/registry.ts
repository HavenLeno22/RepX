/**
 * The exercise plugin registry.
 *
 * This is the ONLY place that knows the full set of exercises. Core systems
 * (matchmaking, match engine, ELO, UI) resolve exercises through this registry
 * and never branch on a specific slug. Adding an exercise = add a plugin file
 * and one line here. See docs/EXERCISE_ENGINE.md and docs/PROMPTS/new-exercise.md.
 */

import { burpeePlugin } from './plugins/burpee.plugin';
import { jumpingJackPlugin } from './plugins/jumping-jack.plugin';
import { plankPlugin } from './plugins/plank.plugin';
import { pullUpPlugin } from './plugins/pull-up.plugin';
import { pushUpPlugin } from './plugins/push-up.plugin';
import { sitUpPlugin } from './plugins/sit-up.plugin';
import { squatPlugin } from './plugins/squat.plugin';
import type { ExercisePlugin } from './types';

const PLUGINS: ExercisePlugin[] = [
  pushUpPlugin,
  squatPlugin,
  pullUpPlugin,
  sitUpPlugin,
  jumpingJackPlugin,
  burpeePlugin,
  plankPlugin,
];

const REGISTRY = new Map<string, ExercisePlugin>(PLUGINS.map((p) => [p.slug, p]));

export function listExercises(): ExercisePlugin[] {
  return [...PLUGINS];
}

export function getExercise(slug: string): ExercisePlugin | undefined {
  return REGISTRY.get(slug);
}

export function isValidExerciseSlug(slug: string): boolean {
  return REGISTRY.has(slug);
}

/** Serializable exercise metadata safe to send to clients. */
export interface ExerciseInfo {
  slug: string;
  displayName: string;
  description: string;
  icon: string;
  version: string;
  scoring: 'reps' | 'hold';
  cameraHint: string;
}

export function toExerciseInfo(plugin: ExercisePlugin): ExerciseInfo {
  return {
    slug: plugin.slug,
    displayName: plugin.displayName,
    description: plugin.description,
    icon: plugin.icon,
    version: plugin.version,
    scoring: plugin.scoring,
    cameraHint: plugin.cameraHint,
  };
}
