import { Controller, Get, Post, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../common/guards/permissions.guard';
import { TicketService } from './ticket.service';
import { CreateTicketDto, ValidateTicketDto } from './dto/ticket.dto';

@ApiTags('tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('tickets')
export class TicketController {
  constructor(private ticketService: TicketService) {}

  @Get()
  @RequirePermissions('ticket:read')
  @ApiOperation({ summary: 'List tickets with filters and pagination' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'budgetId', required: false })
  @ApiQuery({ name: 'seasonGroupId', required: false })
  @ApiQuery({ name: 'seasonId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  async findAll(
    @Query('status') status?: string,
    @Query('budgetId') budgetId?: string,
    @Query('seasonGroupId') seasonGroupId?: string,
    @Query('seasonId') seasonId?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    const result = await this.ticketService.findAll({
      status, budgetId, seasonGroupId, seasonId, page, pageSize,
    });
    return { success: true, ...result };
  }

  @Get('statistics')
  @RequirePermissions('ticket:read')
  @ApiOperation({ summary: 'Get ticket statistics' })
  async getStatistics() {
    return { success: true, data: await this.ticketService.getStatistics() };
  }

  // Validate endpoint — MUST be before :id to avoid route conflict
  @Post('validate')
  @RequirePermissions('ticket:write')
  @ApiOperation({ summary: 'Validate budget readiness for ticket creation' })
  async validate(@Body() body: ValidateTicketDto) {
    const result = await this.ticketService.validateBudgetReadiness(
      body.budgetId,
    );
    return { success: true, data: result };
  }

  @Get(':id')
  @RequirePermissions('ticket:read')
  @ApiOperation({ summary: 'Get ticket details with snapshot and approval history' })
  async findOne(@Param('id') id: string) {
    return { success: true, data: await this.ticketService.findOne(id) };
  }

  @Post()
  @RequirePermissions('ticket:write')
  @ApiOperation({ summary: 'Create a new ticket with validation and snapshot' })
  async create(@Body() body: CreateTicketDto, @Request() req: any) {
    return { success: true, data: await this.ticketService.create(body, req.user.sub) };
  }

  @Post(':id/approve')
  @RequirePermissions('ticket:approve')
  @ApiOperation({ summary: 'Process approval decision on a ticket' })
  async processApproval(
    @Param('id') id: string,
    @Body() body: {
      approvalWorkflowLevelId: string;
      isApproved: boolean;
      comment?: string;
    },
    @Request() req: any,
  ) {
    return { success: true, data: await this.ticketService.processApproval(id, body, req.user.sub) };
  }

  @Get(':id/history')
  @RequirePermissions('ticket:read')
  @ApiOperation({ summary: 'Get approval history for a ticket' })
  async getApprovalHistory(@Param('id') id: string) {
    return { success: true, data: await this.ticketService.getApprovalHistory(id) };
  }
}
