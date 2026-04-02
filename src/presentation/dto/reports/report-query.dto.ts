import { IsDateString, IsNotEmpty, IsOptional } from 'class-validator';

export class ReportAppointmentsQueryDto {
  @IsNotEmpty()
  @IsDateString({}, { message: 'from debe ser YYYY-MM-DD.' })
  from!: string;

  @IsNotEmpty()
  @IsDateString({}, { message: 'to debe ser YYYY-MM-DD.' })
  to!: string;
}

export class ReportQueueQueryDto {
  @IsOptional()
  @IsDateString({}, { message: 'date debe ser YYYY-MM-DD.' })
  date?: string;
}

export class ReportSummaryQueryDto {
  @IsNotEmpty()
  @IsDateString({}, { message: 'from debe ser YYYY-MM-DD.' })
  from!: string;

  @IsNotEmpty()
  @IsDateString({}, { message: 'to debe ser YYYY-MM-DD.' })
  to!: string;
}
