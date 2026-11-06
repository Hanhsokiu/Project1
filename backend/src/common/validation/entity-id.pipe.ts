import { z } from 'zod';
import { ZodValidationPipe } from './zod.pipe';

// Existing academic tables use VARCHAR IDs and contain imported non-UUID IDs.
// Keep those records readable alongside newly generated UUIDs.
export class EntityIdPipe extends ZodValidationPipe<string> {
  constructor() {
    super(z.string().trim().min(1).max(36));
  }
}
