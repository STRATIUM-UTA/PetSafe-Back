import { PartialType } from '@nestjs/mapped-types';
import { CreateAdoptionTagDto } from './create-adoption-tag.dto.js';

export class UpdateAdoptionTagDto extends PartialType(CreateAdoptionTagDto) {}
