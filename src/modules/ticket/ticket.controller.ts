import { Controller, Get, Post, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../common/guards/permissions.guard';
import { TicketService } from './ticket.service';
import { CreateTicketDto, ValidateTicketDto } from './dto/ticket.dto';
import { PERMISSIONS } from '../../common/constants/permissions';
import { ApiErrorResponses, ApiGenericPaginatedResponse, ApiSuccessResponse } from '../../common/decorators/api-response.decorator';

@ApiTags('tickets')
@ApiBearerAuth()
@ApiErrorResponses()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('tickets')
export class TicketController {
  constructor(private ticketService: TicketService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.TICKET.READ)
  @ApiOperation({ summary: 'List tickets with filters and pagination' })
  @ApiGenericPaginatedResponse()
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
    return this.ticketService.findAll({
      status, budgetId, seasonGroupId, seasonId, page, pageSize,
    });
  }

  @Get('statistics')
  @RequirePermissions(PERMISSIONS.TICKET.READ)
  @ApiOperation({ summary: 'Get ticket statistics' })
  @ApiSuccessResponse()
  async getStatistics() {
    return this.ticketService.getStatistics();
  }

  // Validate endpoint — MUST be before :id to avoid route conflict
  @Post('validate')
  @RequirePermissions(PERMISSIONS.TICKET.WRITE)
  @ApiOperation({ summary: 'Validate budget readiness for ticket creation' })
  @ApiSuccessResponse()
  async validate(@Body() body: ValidateTicketDto) {
    return this.ticketService.validateBudgetReadiness(body.budgetId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.TICKET.READ)
  @ApiOperation({ summary: 'Get ticket details with snapshot and approval history' })
  @ApiSuccessResponse()
  async findOne(@Param('id') id: string) {
    return this.ticketService.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.TICKET.WRITE)
  @ApiOperation({ summary: 'Create a new ticket with validation and snapshot' })
  @ApiSuccessResponse('Ticket created')
  async create(@Body() body: CreateTicketDto, @Request() req: any) {
    return this.ticketService.create(body, req.user.sub);
  }

  @Post(':id/approve')
  @RequirePermissions(PERMISSIONS.TICKET.APPROVE)
  @ApiOperation({ summary: 'Process approval decision on a ticket' })
  @ApiSuccessResponse()
  async processApproval(
    @Param('id') id: string,
    @Body() body: {
      approvalWorkflowLevelId: string;
      isApproved: boolean;
      comment?: string;
    },
    @Request() req: any,
  ) {
    return this.ticketService.processApproval(id, body, req.user.sub);
  }

  @Get(':id/history')
  @RequirePermissions(PERMISSIONS.TICKET.READ)
  @ApiOperation({ summary: 'Get approval history for a ticket' })
  @ApiSuccessResponse()
  async getApprovalHistory(@Param('id') id: string) {
    return this.ticketService.getApprovalHistory(id);
  }
}
