import { Module } from '@nestjs/common';
import { MetadataController } from '../../../presentation/controllers/metadata/metadata.controller.js';

@Module({
  controllers: [MetadataController],
  providers: [],
})
export class MetadataModule {}
