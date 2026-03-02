import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateTicketDto {
  @ApiProperty({ description: 'Budget ID' })
  @IsString()
  @IsNotEmpty()
  budgetId: string;

  @ApiProperty({ description: 'Season Group ID' })
  @IsString()
  @IsNotEmpty()
  seasonGroupId: string;

  @ApiProperty({ description: 'Season ID' })
  @IsString()
  @IsNotEmpty()
  seasonId: string;
}

export class ValidateTicketDto {
  @ApiProperty({ description: 'Budget ID' })
  @IsString()
  @IsNotEmpty()
  budgetId: string;

  @ApiPropertyOptional({ description: 'Season Group ID' })
  @IsString()
  @IsOptional()
  seasonGroupId?: string;

  @ApiPropertyOptional({ description: 'Season ID' })
  @IsString()
  @IsOptional()
  seasonId?: string;
}
