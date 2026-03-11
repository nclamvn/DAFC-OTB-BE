import { Controller, Get, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get notifications for the current user' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getNotifications(@Request() req: any, @Query('limit') limit?: number) {
    const data = await this.notificationService.getNotifications(
      req.user.sub,
      limit ? Number(limit) : 20,
    );
    return { success: true, data };
  }
}
