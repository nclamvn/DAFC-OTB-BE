import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsArray, IsOptional, ValidateNested, IsNotEmpty, Min, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

// ─── Planning Season Type Detail ─────────────────────────────────────────────

export class PlanningSeasonTypeDto {
  @ApiProperty({ description: 'Season Type ID' })
  @IsString()
  @IsNotEmpty()
  seasonTypeId: string;

  @ApiProperty({ description: 'Store ID' })
  @IsString()
  @IsNotEmpty()
  storeId: string;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @IsOptional()
  actualBuyPct?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @IsOptional()
  actualSalesPct?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @IsOptional()
  actualStPct?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @IsOptional()
  actualMoc?: number;

  @ApiProperty({ example: 0.3, description: 'Proposed buy percentage' })
  @IsNumber()
  @Min(0)
  proposedBuyPct: number;

  @ApiProperty({ example: 5000000000, description: 'OTB proposed amount (VND)' })
  @IsNumber()
  @Min(0)
  otbProposedAmount: number;

  @ApiPropertyOptional({ example: 0.05 })
  @IsNumber()
  @IsOptional()
  pctVarVsLast?: number;
}

// ─── Planning Gender Detail ──────────────────────────────────────────────────

export class PlanningGenderDto {
  @ApiProperty({ description: 'Gender ID' })
  @IsString()
  @IsNotEmpty()
  genderId: string;

  @ApiProperty({ description: 'Store ID' })
  @IsString()
  @IsNotEmpty()
  storeId: string;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @IsOptional()
  actualBuyPct?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @IsOptional()
  actualSalesPct?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @IsOptional()
  actualStPct?: number;

  @ApiProperty({ example: 0.3 })
  @IsNumber()
  @Min(0)
  proposedBuyPct: number;

  @ApiProperty({ example: 5000000000 })
  @IsNumber()
  @Min(0)
  otbProposedAmount: number;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @IsOptional()
  pctVarVsLast?: number;
}

// ─── Planning Category Detail ────────────────────────────────────────────────

export class PlanningCategoryDto {
  @ApiProperty({ description: 'SubCategory ID' })
  @IsString()
  @IsNotEmpty()
  subcategoryId: string;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @IsOptional()
  actualBuyPct?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @IsOptional()
  actualSalesPct?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @IsOptional()
  actualStPct?: number;

  @ApiProperty({ example: 0.3 })
  @IsNumber()
  @Min(0)
  proposedBuyPct: number;

  @ApiProperty({ example: 5000000000 })
  @IsNumber()
  @Min(0)
  otbProposedAmount: number;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @IsOptional()
  varLastyearPct?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @IsOptional()
  otbActualAmount?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @IsOptional()
  otbActualBuyPct?: number;
}

// ─── Create Planning DTO ─────────────────────────────────────────────────────

export class CreatePlanningDto {
  @ApiProperty({ description: 'AllocateHeader ID this planning version is based on' })
  @IsString()
  @IsNotEmpty()
  allocateHeaderId: string;

  @ApiPropertyOptional({ type: [PlanningSeasonTypeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanningSeasonTypeDto)
  @IsOptional()
  seasonTypes?: PlanningSeasonTypeDto[];

  @ApiPropertyOptional({ type: [PlanningGenderDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanningGenderDto)
  @IsOptional()
  genders?: PlanningGenderDto[];

  @ApiPropertyOptional({ type: [PlanningCategoryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanningCategoryDto)
  @IsOptional()
  categories?: PlanningCategoryDto[];
}

// ─── Update Planning DTO ─────────────────────────────────────────────────────

export class UpdatePlanningDto extends CreatePlanningDto {}
