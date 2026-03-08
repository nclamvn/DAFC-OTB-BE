import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class OrderRowDto {
  @ApiPropertyOptional() @IsOptional() @IsString() image_url?: string;
  @ApiProperty() @IsString() @IsNotEmpty() sku: string;
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() collection_name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() color?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() division?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() product_type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() department?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() carry_forward?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() composition?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() theme?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() style_name?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() total_units?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() size?: string;
  // Editable fields
  @ApiPropertyOptional() @IsOptional() @IsString() brand_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() color_code?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() fsr?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() wholesale_sgd?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() rrp_sgd?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() regional_rrp?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() total_price_sgd?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() mod?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ves?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() in_catalogue?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() gruppo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() tipology?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sku_type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() gca?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() window?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() heel?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dimension?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() finish?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() delivery?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() price_mod_single?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() price_mod_single_retail?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() amount?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() amount_retail?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() product_status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() size2?: string;
}

export class SaveOrderDto {
  @ApiProperty({ description: 'Ticket ID' })
  @IsString()
  @IsNotEmpty()
  ticketId: string;

  @ApiProperty({ type: [OrderRowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderRowDto)
  rows: OrderRowDto[];
}

export class UpdateOrderRowDto extends OrderRowDto {
  @ApiPropertyOptional() @IsOptional() @IsString() id?: string;
}

export class UpdateOrderDto {
  @ApiProperty({ type: [UpdateOrderRowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateOrderRowDto)
  rows: UpdateOrderRowDto[];
}
