import { IsString, IsEnum, IsArray, IsOptional, IsNumber, IsBoolean, Min, Max, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ImportTargetEnum {
  PRODUCTS = 'products',
  OTB_BUDGET = 'otb_budget',
  WSSI = 'wssi',
  SIZE_PROFILES = 'size_profiles',
  FORECASTS = 'forecasts',
  CLEARANCE = 'clearance',
  KPI_TARGETS = 'kpi_targets',
  SUPPLIERS = 'suppliers',
  CATEGORIES = 'categories',
}

export enum ImportMode {
  INSERT = 'insert',
  UPSERT = 'upsert',
  UPDATE_ONLY = 'update_only',
}

export enum DuplicateHandling {
  SKIP = 'skip',
  OVERWRITE = 'overwrite',
  MERGE = 'merge',
}

export class ImportBatchDto {
  @ApiProperty({ enum: ImportTargetEnum })
  @IsEnum(ImportTargetEnum)
  target: ImportTargetEnum;

  @ApiPropertyOptional({ enum: ImportMode, default: ImportMode.UPSERT })
  @IsOptional()
  @IsEnum(ImportMode)
  mode?: ImportMode = ImportMode.UPSERT;

  @ApiPropertyOptional({ enum: DuplicateHandling, default: DuplicateHandling.SKIP })
  @IsOptional()
  @IsEnum(DuplicateHandling)
  duplicateHandling?: DuplicateHandling = DuplicateHandling.SKIP;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  matchKey?: string[] = [];

  @ApiProperty({ type: [Object] })
  @IsArray()
  @ArrayMaxSize(1000, { message: 'Maximum 1000 rows per batch' })
  rows: Record<string, unknown>[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  batchIndex?: number = 0;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  totalBatches?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sessionId?: string;
}

export class ImportQueryDto {
  @ApiProperty({ enum: ImportTargetEnum })
  @IsEnum(ImportTargetEnum)
  target: ImportTargetEnum;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  pageSize?: number = 50;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: '_importedAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = '_importedAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class ImportStatsQueryDto {
  @ApiProperty({ enum: ImportTargetEnum })
  @IsEnum(ImportTargetEnum)
  target: ImportTargetEnum;
}

export class ImportDeleteDto {
  @ApiProperty({ enum: ImportTargetEnum })
  @IsEnum(ImportTargetEnum)
  target: ImportTargetEnum;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  clearAll?: boolean;
}
