import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../common/guards/permissions.guard';
import { ImportService } from './import.service';
import {
  ImportTargetEnum,
  ImportBatchDto,
  ImportQueryDto,
  ImportStatsQueryDto,
  ImportDeleteDto,
} from './dto/import.dto';

@ApiTags('Import')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('batch')
  @RequirePermissions('import:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Batch import records' })
  @ApiResponse({ status: 200, description: 'Batch processed successfully' })
  async processBatch(@Body() dto: ImportBatchDto) {
    if (!dto.rows || dto.rows.length === 0) {
      throw new BadRequestException('No data to import (rows is empty)');
    }
    const result = await this.importService.processBatch(dto);
    return { success: true, ...result };
  }

  @Get('data')
  @ApiOperation({ summary: 'Query imported data with pagination' })
  @ApiQuery({ name: 'target', enum: ImportTargetEnum, required: true })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  async queryData(@Query() dto: ImportQueryDto) {
    const result = await this.importService.queryData(dto);
    return { success: true, ...result };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get import statistics for a target' })
  @ApiQuery({ name: 'target', enum: ImportTargetEnum, required: true })
  async getStats(@Query() dto: ImportStatsQueryDto) {
    const stats = await this.importService.getStats(dto.target);
    return { success: true, stats };
  }

  @Get('all-stats')
  @ApiOperation({ summary: 'Get statistics for all targets' })
  async getAllStats() {
    const stats = await this.importService.getAllTargetStats();
    return { success: true, stats };
  }

  @Get('wssi/analytics')
  @ApiOperation({ summary: 'Get WSSI sell-through analytics' })
  @ApiResponse({
    status: 200,
    description: 'Sell-through analytics computed from WSSI imported data',
  })
  async getWssiAnalytics() {
    const analytics = await this.importService.getWssiAnalytics();
    return { success: true, data: analytics };
  }

  @Post('apply')
  @RequirePermissions('import:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apply imported data to transactional tables (ETL)' })
  @ApiQuery({ name: 'target', enum: ImportTargetEnum, required: true })
  @ApiQuery({ name: 'sessionId', required: false, type: String })
  async applyImportedData(
    @Query('target') target: ImportTargetEnum,
    @Query('sessionId') sessionId?: string,
  ) {
    const result = await this.importService.applyImportedData(target, sessionId);
    return { success: true, ...result };
  }

  @Delete('data')
  @RequirePermissions('import:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete imported data by session or clear all' })
  async deleteData(@Body() dto: ImportDeleteDto) {
    if (!dto.sessionId && !dto.clearAll) {
      throw new BadRequestException('Need sessionId or clearAll=true');
    }

    let deletedCount: number;
    let message: string;

    if (dto.clearAll) {
      deletedCount = await this.importService.clearAll(dto.target);
      message = `Cleared all ${deletedCount} records for ${dto.target}`;
    } else {
      deletedCount = await this.importService.deleteSession(dto.target, dto.sessionId!);
      message = `Deleted ${deletedCount} records from session ${dto.sessionId}`;
    }

    return { success: true, deletedCount, message };
  }

  @Delete('session/:sessionId')
  @RequirePermissions('import:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a specific import session' })
  @ApiParam({ name: 'sessionId', type: String })
  @ApiQuery({ name: 'target', enum: ImportTargetEnum, required: true })
  async deleteSession(
    @Param('sessionId') sessionId: string,
    @Query('target') target: ImportTargetEnum,
  ) {
    const deletedCount = await this.importService.deleteSession(target, sessionId);
    return { success: true, deletedCount, message: `Deleted ${deletedCount} records from session ${sessionId}` };
  }

  @Delete('clear/:target')
  @RequirePermissions('import:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear all data for a target' })
  @ApiParam({ name: 'target', enum: ImportTargetEnum })
  async clearTarget(@Param('target') target: ImportTargetEnum) {
    const deletedCount = await this.importService.clearAll(target);
    return { success: true, deletedCount, message: `Cleared all ${deletedCount} records for ${target}` };
  }
}
