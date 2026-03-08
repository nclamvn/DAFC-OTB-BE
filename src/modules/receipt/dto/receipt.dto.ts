import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class ReceiptRowDto {
  @ApiProperty({ description: 'order_confirmation row ID' })
  @IsString()
  @IsNotEmpty()
  order_confirmation_id: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber() received_units?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() actual_unit_price?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() actual_total_price?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() receipt_currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() receipt_comment?: string;
}

export class SaveReceiptDto {
  @ApiProperty({ description: 'Ticket ID' })
  @IsString()
  @IsNotEmpty()
  ticketId: string;

  @ApiProperty({ type: [ReceiptRowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiptRowDto)
  rows: ReceiptRowDto[];
}

export class UpdateReceiptRowDto extends ReceiptRowDto {
  @ApiPropertyOptional() @IsOptional() @IsString() id?: string;
}

export class UpdateReceiptDto {
  @ApiProperty({ type: [UpdateReceiptRowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateReceiptRowDto)
  rows: UpdateReceiptRowDto[];
}
