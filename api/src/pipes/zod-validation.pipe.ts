import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import type { ZodType } from 'zod';
import { ZodError } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodType<unknown>) {}

  transform(value: unknown) {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        // Format Zod errors into a more readable structure
        const formattedErrors = error.issues.map(err => {
          const errorObj: Record<string, unknown> = {
            field: err.path.join('.'),
            message: err.message,
            code: err.code
          };          
          if ('received' in err && err.received !== undefined) {
            errorObj.received = err.received;
          }          
          return errorObj;
        });
        
        throw new BadRequestException({
          message: 'Validation failed',
          errors: formattedErrors
        });
      }
      throw error;
    }
  }
}