import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * Validates a request body against a zod schema from @repx/shared.
 *
 * The same schema the frontend uses to type its request is what guards the
 * boundary here — one definition, no drift. See docs/SECURITY.md.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(result.error.errors[0]?.message ?? 'Invalid request');
    }
    return result.data;
  }
}
