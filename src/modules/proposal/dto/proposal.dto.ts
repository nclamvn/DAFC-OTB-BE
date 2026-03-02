import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsNumber, Min, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

// ─── SKU Proposal Item ──────────────────────────────────────────────────────

export class SKUProposalItemDto {
  @ApiProperty({ description: 'Product ID' })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ example: 'VIP', description: 'Customer target (VIP, Regular, Outlet)' })
  @IsString()
  @IsNotEmpty()
  customerTarget: string;

  @ApiProperty({ example: 500000, description: 'Unit cost' })
  @IsNumber()
  @Min(0)
  unitCost: number;

  @ApiProperty({ example: 1200000, description: 'Suggested retail price' })
  @IsNumber()
  @Min(0)
  srp: number;
}

// ─── SKU Allocate (per store) ────────────────────────────────────────────────

export class SKUAllocateDto {
  @ApiProperty({ description: 'SKU Proposal ID' })
  @IsString()
  @IsNotEmpty()
  skuProposalId: string;

  @ApiProperty({ description: 'Store ID' })
  @IsString()
  @IsNotEmpty()
  storeId: string;

  @ApiProperty({ example: 10, description: 'Quantity to allocate' })
  @IsNumber()
  @Min(0)
  quantity: number;
}

// ─── Proposal Sizing Item (dùng trong header) ───────────────────────────────

export class ProposalSizingItemDto {
  @ApiProperty({ description: 'SKU Proposal ID (which SKU this sizing belongs to)' })
  @IsString()
  @IsNotEmpty()
  skuProposalId: string;

  @ApiProperty({ description: 'Subcategory Size ID' })
  @IsString()
  @IsNotEmpty()
  subcategorySizeId: string;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @IsOptional()
  actualSalesmixPct?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @IsOptional()
  actualStPct?: number;

  @ApiProperty({ example: 10, description: 'Proposed quantity for this size' })
  @IsInt()
  @Min(0)
  proposalQuantity: number;
}

// ─── Proposal Sizing (standalone, thuộc 1 header cụ thể) ────────────────────

export class ProposalSizingDto {
  @ApiProperty({ description: 'Proposal Sizing Header ID' })
  @IsString()
  @IsNotEmpty()
  proposalSizingHeaderId: string;

  @ApiProperty({ description: 'SKU Proposal ID (which SKU this sizing belongs to)' })
  @IsString()
  @IsNotEmpty()
  skuProposalId: string;

  @ApiProperty({ description: 'Subcategory Size ID' })
  @IsString()
  @IsNotEmpty()
  subcategorySizeId: string;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @IsOptional()
  actualSalesmixPct?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @IsOptional()
  actualStPct?: number;

  @ApiProperty({ example: 10, description: 'Proposed quantity for this size' })
  @IsInt()
  @Min(0)
  proposalQuantity: number;
}

// ─── Create SKU Proposal Header ──────────────────────────────────────────────

export class CreateSKUProposalHeaderDto {
  @ApiProperty({ description: 'Allocate Header ID (links proposal to a brand allocation)' })
  @IsString()
  @IsNotEmpty()
  allocateHeaderId: string;

  @ApiProperty({ type: [SKUProposalItemDto], description: 'SKU proposal items' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SKUProposalItemDto)
  proposals: SKUProposalItemDto[];
}

// ─── Add Product to Existing Header ──────────────────────────────────────────

export class AddProductDto {
  @ApiProperty({ description: 'Product ID' })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ example: 'VIP' })
  @IsString()
  @IsNotEmpty()
  customerTarget: string;

  @ApiProperty({ example: 500000 })
  @IsNumber()
  @Min(0)
  unitCost: number;

  @ApiProperty({ example: 1200000 })
  @IsNumber()
  @Min(0)
  srp: number;
}

// ─── Bulk Add Products ───────────────────────────────────────────────────────

export class BulkAddProductsDto {
  @ApiProperty({ type: [AddProductDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddProductDto)
  products: AddProductDto[];
}

// ─── Update SKU Proposal Item ────────────────────────────────────────────────

export class UpdateSKUProposalDto {
  @ApiPropertyOptional({ example: 'VIP' })
  @IsString()
  @IsOptional()
  customerTarget?: string;

  @ApiPropertyOptional({ example: 500000 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  unitCost?: number;

  @ApiPropertyOptional({ example: 1200000 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  srp?: number;
}

// ─── Bulk SKU Allocate ───────────────────────────────────────────────────────

export class BulkSKUAllocateDto {
  @ApiProperty({ type: [SKUAllocateDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SKUAllocateDto)
  allocations: SKUAllocateDto[];
}

// ─── Create Proposal Sizing Header ──────────────────────────────────────────

export class CreateProposalSizingHeaderDto {
  @ApiProperty({ description: 'SKU Proposal Header ID (the proposal header this sizing choice belongs to)' })
  @IsString()
  @IsNotEmpty()
  skuProposalHeaderId: string;

  @ApiProperty({ type: [ProposalSizingItemDto], description: 'Sizing rows per SKU × size' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProposalSizingItemDto)
  sizings: ProposalSizingItemDto[];
}

// ─── Bulk Proposal Sizing ────────────────────────────────────────────────────

export class BulkProposalSizingDto {
  @ApiProperty({ type: [ProposalSizingDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProposalSizingDto)
  sizings: ProposalSizingDto[];
}
