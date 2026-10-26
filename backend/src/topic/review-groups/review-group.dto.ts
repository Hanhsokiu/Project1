import { PipeTransform } from '@nestjs/common';
import { z } from 'zod';
import { groupError } from './review-group.errors';
export class ReviewGroupPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: z.ZodType<T, z.ZodTypeDef, unknown>) {}
  transform(input: unknown): T {
    const result = this.schema.safeParse(input);
    if (!result.success)
      groupError(
        400,
        'COMMON_003',
        result.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; '),
      );
    return result.data;
  }
}
