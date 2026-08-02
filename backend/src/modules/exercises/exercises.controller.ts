import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { getExercise, listExercises, toExerciseInfo, type ExerciseInfo } from '@repx/shared';

/**
 * Exposes the exercise catalog.
 *
 * The catalog is derived from the plugin registry rather than stored separately,
 * so the list of exercises a client can play is by construction the list the
 * server can actually validate. See docs/EXERCISE_ENGINE.md.
 */
@Controller('exercises')
export class ExercisesController {
  @Get()
  list(): ExerciseInfo[] {
    return listExercises().map(toExerciseInfo);
  }

  @Get(':slug')
  get(@Param('slug') slug: string): ExerciseInfo {
    const plugin = getExercise(slug);
    if (!plugin) throw new NotFoundException(`Unknown exercise: ${slug}`);
    return toExerciseInfo(plugin);
  }
}
