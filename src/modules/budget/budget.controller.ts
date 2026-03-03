import { Controller, Get, Post, Put, Patch, Delete, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiBody } from '@nestjs/swagger';
import { BudgetService } from './budget.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../common/guards/permissions.guard';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CreateBudgetDto, UpdateBudgetDto, CreateAllocateDto, UpdateAllocateDto, ApprovalDecisionDto } from './dto/budget.dto';
import { ApiErrorResponses, ApiGenericPaginatedResponse, ApiSuccessResponse, ApiMessageResponse } from '../../common/decorators/api-response.decorator';

@ApiTags('budgets')
@ApiBearerAuth()
@ApiErrorResponses()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('budgets')
export class BudgetController {
  constructor(private budgetService: BudgetService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.BUDGET.READ)
  @ApiOperation({ summary: 'List budgets with filters and pagination' })
  @ApiGenericPaginatedResponse()
  @ApiQuery({ name: 'fiscalYear', required: false, type: Number, example: 2025 })
  @ApiQuery({ name: 'status', required: false, enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  async findAll(
    @Query('fiscalYear') fiscalYear?: number,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.budgetService.findAll({
      fiscalYear: fiscalYear ? Number(fiscalYear) : undefined,
      status,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Get('statistics')
  @RequirePermissions(PERMISSIONS.BUDGET.READ)
  @ApiOperation({ summary: 'Get budget statistics' })
  @ApiSuccessResponse()
  @ApiQuery({ name: 'fiscalYear', required: false, type: Number })
  async getStatistics(@Query('fiscalYear') fiscalYear?: number) {
    return this.budgetService.getStatistics(fiscalYear ? Number(fiscalYear) : undefined);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.BUDGET.READ)
  @ApiOperation({ summary: 'Get budget by ID with allocations' })
  @ApiSuccessResponse()
  async findOne(@Param('id') id: string) {
    return this.budgetService.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.BUDGET.WRITE)
  @ApiOperation({ summary: 'Create new budget' })
  @ApiSuccessResponse('Budget created')
  @ApiBody({ type: CreateBudgetDto })
  async create(@Body() dto: CreateBudgetDto, @Request() req: any) {
    return this.budgetService.create(dto, req.user.sub);
  }

  @Put(':id')
  @RequirePermissions(PERMISSIONS.BUDGET.WRITE)
  @ApiOperation({ summary: 'Update draft budget' })
  @ApiSuccessResponse('Budget updated')
  @ApiBody({ type: UpdateBudgetDto })
  async update(@Param('id') id: string, @Body() dto: UpdateBudgetDto, @Request() req: any) {
    return this.budgetService.update(id, dto, req.user.sub);
  }

  @Post(':id/allocations')
  @RequirePermissions(PERMISSIONS.BUDGET.WRITE)
  @ApiOperation({ summary: 'Create new allocation version for a budget' })
  @ApiSuccessResponse('Allocation created')
  @ApiBody({ type: CreateAllocateDto })
  async createAllocation(@Param('id') id: string, @Body() dto: CreateAllocateDto, @Request() req: any) {
    return this.budgetService.createAllocateHeader(id, dto.brandId, dto.allocations, req.user.sub, dto.isFinalVersion);
  }

  @Put('allocations/:headerId')
  @RequirePermissions(PERMISSIONS.BUDGET.WRITE)
  @ApiOperation({ summary: 'Update allocation header details' })
  @ApiSuccessResponse('Allocation updated')
  @ApiBody({ type: UpdateAllocateDto })
  async updateAllocation(
    @Param('headerId') headerId: string,
    @Body() dto: UpdateAllocateDto,
    @Request() req: any,
  ) {
    return this.budgetService.updateAllocateHeader(headerId, dto, req.user.sub);
  }

  @Patch('allocations/:headerId/set-final')
  @RequirePermissions(PERMISSIONS.BUDGET.WRITE)
  @ApiOperation({ summary: 'Mark allocation version as final (unsets all others for same brand+budget)' })
  @ApiSuccessResponse('Final version set')
  async setFinalVersion(@Param('headerId') headerId: string) {
    return this.budgetService.setFinalVersion(headerId);
  }

  @Post(':id/submit')
  @RequirePermissions(PERMISSIONS.BUDGET.SUBMIT)
  @ApiOperation({ summary: 'Submit budget for approval (DRAFT → SUBMITTED)' })
  @ApiMessageResponse('Budget submitted')
  async submit(@Param('id') id: string, @Request() req: any) {
    return this.budgetService.submit(id, req.user.sub);
  }

  @Post(':id/approve')
  @RequirePermissions(PERMISSIONS.BUDGET.APPROVE)
  @ApiOperation({ summary: 'Approve budget (SUBMITTED → APPROVED)' })
  @ApiMessageResponse('Budget approved')
  async approve(@Param('id') id: string, @Request() req: any) {
    return this.budgetService.approve(id, req.user.sub);
  }

  @Post(':id/approve/:level')
  @RequirePermissions(PERMISSIONS.BUDGET.APPROVE)
  @ApiOperation({ summary: 'Approve or reject budget by level (action: APPROVED | REJECTED)' })
  @ApiSuccessResponse()
  async approveByLevel(
    @Param('id') id: string,
    @Param('level') level: string,
    @Body('action') action: string,
    @Body('comment') comment: string,
    @Request() req: any,
  ) {
    return this.budgetService.approveByLevel(id, level, action, comment, req.user.sub);
  }

  @Post(':id/reject')
  @RequirePermissions(PERMISSIONS.BUDGET.APPROVE)
  @ApiOperation({ summary: 'Reject budget (SUBMITTED → REJECTED)' })
  @ApiMessageResponse('Budget rejected')
  async reject(@Param('id') id: string, @Request() req: any) {
    return this.budgetService.reject(id, req.user.sub);
  }

  @Patch(':id/archive')
  @RequirePermissions(PERMISSIONS.BUDGET.WRITE)
  @ApiOperation({ summary: 'Archive approved budget (APPROVED → ARCHIVED)' })
  @ApiMessageResponse('Budget archived')
  async archive(@Param('id') id: string) {
    return this.budgetService.archive(id);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.BUDGET.WRITE)
  @ApiOperation({ summary: 'Delete draft budget' })
  @ApiMessageResponse('Budget deleted')
  async remove(@Param('id') id: string, @Request() req: any) {
    await this.budgetService.remove(id, req.user.sub);
    return { message: 'Budget deleted' };
  }
}
