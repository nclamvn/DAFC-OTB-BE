import {
  Controller,
  Post,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../common/guards/permissions.guard';
import { DataRetentionService } from './data-retention.service';

@ApiTags('Data Retention')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('data-retention')
export class DataRetentionController {
  constructor(private readonly dataRetentionService: DataRetentionService) {}

  @Get('policy')
  @ApiOperation({ summary: 'Get current data retention policy configuration' })
  @ApiResponse({ status: 200, description: 'Returns retention policy settings' })
  getPolicy() {
    const policy = this.dataRetentionService.getRetentionPolicy();
    return { success: true, data: policy };
  }

  @Post('cleanup')
  @RequirePermissions('*') // admin only — requires wildcard permission
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger manual data cleanup based on retention policy (admin only)' })
  @ApiResponse({ status: 200, description: 'Cleanup completed successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin permissions required' })
  async triggerCleanup() {
    const result = await this.dataRetentionService.cleanup();
    return { success: true, data: result };
  }
}
