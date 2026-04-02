import { Controller, Get } from '@nestjs/common';
import * as Enums from '../../../domain/enums/index.js';

@Controller('metadata')
export class MetadataController {
  @Get('enums')
  getEnums() {
    // We convert TypeScript enums to plain arrays or key-value objects for easy consumption by the frontend.
    const result: Record<string, string[]> = {};

    for (const [enumName, enumObject] of Object.entries(Enums)) {
      // TypeScript enums with string values are objects where keys and values are the same or standard dictionary pairs.
      // We extract the values to send an array of options to the frontend.
      result[enumName] = Object.values(enumObject);
    }

    return result;
  }
}
