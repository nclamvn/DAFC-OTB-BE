import { Controller, Get, Post, Put, Patch, Delete, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiBody } from '@nestjs/swagger';
import { PlanningService } from './planning.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../common/guards/permissions.guard';
import { CreatePlanningDto, UpdatePlanningDto, UpdatePlanningDetailDto } from './dto/planning.dto';
import { PERMISSIONS } from '../../common/constants/permissions';
import { ApiErrorResponses, ApiGenericPaginatedResponse, ApiSuccessResponse, ApiMessageResponse } from '../../common/decorators/api-response.decorator';

@ApiTags('planning')
@ApiBearerAuth()
@ApiErrorResponses()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('planning')
export class PlanningController {
  constructor(private planningService: PlanningService) {}

  // ─── LIST ──────────────────────────────────────────────────────────────────

  @Get()
  @RequirePermissions(PERMISSIONS.PLANNING.READ)
  @ApiOperation({ summary: 'List planning headers with filters and pagination' })
  @ApiGenericPaginatedResponse()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status (DRAFT, SUBMITTED, APPROVED, REJECTED)' })
  @ApiQuery({ name: 'budgetId', required: false, description: 'Filter by budget ID (reserved for future FK)' })
  @ApiQuery({ name: 'brandId', required: false, description: 'Filter by brand ID (via allocate_header.brand_id)' })
  @ApiQuery({ name: 'allocateHeaderId', required: false, description: 'Filter by allocate header ID' })
  async findAll(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('status') status?: string,
    @Query('budgetId') budgetId?: string,
    @Query('brandId') brandId?: string,
    @Query('allocateHeaderId') allocateHeaderId?: string,
  ) {
    return this.planningService.findAll({ page, pageSize, status, budgetId, brandId, allocateHeaderId });
  }

  // ─── FILTER OPTIONS FOR PLANNING DETAIL (Category tab) ───────────────────

  @Get('filter-options/categories')
  @RequirePermissions(PERMISSIONS.PLANNING.READ)
  @ApiOperation({ summary: 'Get Gender → Category → SubCategory hierarchy for Planning Detail filter dropdowns' })
  @ApiSuccessResponse()
  @ApiQuery({ name: 'genderId', required: false, description: 'Filter by gender ID (cascading)' })
  @ApiQuery({ name: 'categoryId', required: false, description: 'Filter by category ID (cascading to sub-categories)' })
  async getCategoryFilterOptions(
    @Query('genderId') genderId?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.planningService.getCategoryFilterOptions(genderId, categoryId);
  }

  // ─── HISTORICAL (comparison data) ─────────────────────────────────────────

  @Get('historical')
  @RequirePermissions(PERMISSIONS.PLANNING.READ)
  @ApiOperation({ summary: 'Get historical planning data for year/season/brand comparison' })
  @ApiSuccessResponse()
  @ApiQuery({ name: 'fiscalYear', required: true, type: Number })
  @ApiQuery({ name: 'seasonGroupName', required: true, type: String })
  @ApiQuery({ name: 'seasonName', required: true, type: String })
  @ApiQuery({ name: 'brandId', required: true, type: String })
  async findHistorical(
    @Query('fiscalYear') fiscalYear: number,
    @Query('seasonGroupName') seasonGroupName: string,
    @Query('seasonName') seasonName: string,
    @Query('brandId') brandId: string,
  ) {
    return this.planningService.findHistorical({ fiscalYear: Number(fiscalYear), seasonGroupName, seasonName, brandId });
  }

  // ─── GET ONE ───────────────────────────────────────────────────────────────

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PLANNING.READ)
  @ApiOperation({ summary: 'Get planning header with all details (collections, genders, categories)' })
  @ApiSuccessResponse()
  async findOne(@Param('id') id: string) {
    return this.planningService.findOne(id);
  }

  // ─── CREATE ────────────────────────────────────────────────────────────────

  @Post()
  @RequirePermissions(PERMISSIONS.PLANNING.WRITE)
  @ApiOperation({ summary: 'Create new planning header with details' })
  @ApiSuccessResponse('Planning created')
  @ApiBody({ type: CreatePlanningDto })
  async create(@Body() dto: CreatePlanningDto, @Request() req: any) {
    return this.planningService.create(dto, req.user.sub);
  }

  // ─── COPY FROM EXISTING ────────────────────────────────────────────────────

  @Post(':id/copy')
  @RequirePermissions(PERMISSIONS.PLANNING.WRITE)
  @ApiOperation({ summary: 'Create new version by copying an existing one' })
  @ApiSuccessResponse('Version copied')
  async createFromVersion(@Param('id') id: string, @Request() req: any) {
    return this.planningService.createFromVersion(id, req.user.sub);
  }

  // ─── UPDATE ────────────────────────────────────────────────────────────────

  @Put(':id')
  @RequirePermissions(PERMISSIONS.PLANNING.WRITE)
  @ApiOperation({ summary: 'Update planning header details' })
  @ApiSuccessResponse('Planning updated')
  @ApiBody({ type: UpdatePlanningDto })
  async update(@Param('id') id: string, @Body() dto: UpdatePlanningDto, @Request() req: any) {
    return this.planningService.update(id, dto, req.user.sub);
  }

  // ─── SUBMIT ────────────────────────────────────────────────────────────────

  @Post(':id/submit')
  @RequirePermissions(PERMISSIONS.PLANNING.SUBMIT)
  @ApiOperation({ summary: 'Submit planning for approval (DRAFT → SUBMITTED)' })
  @ApiMessageResponse('Planning submitted')
  async submit(@Param('id') id: string, @Request() req: any) {
    return this.planningService.submit(id, req.user.sub);
  }

  // ─── APPROVE BY LEVEL (used by approvalHelper) ────────────────────────────

  @Post(':id/approve/:level')
  @RequirePermissions(PERMISSIONS.PLANNING.APPROVE)
  @ApiOperation({ summary: 'Approve or reject planning by level (action: APPROVED | REJECTED)' })
  @ApiSuccessResponse()
  async approveByLevel(
    @Param('id') id: string,
    @Param('level') level: string,
    @Body('action') action: string,
    @Body('comment') comment: string,
    @Request() req: any,
  ) {
    return this.planningService.approveByLevel(id, level, action, comment, req.user.sub);
  }

  // ─── FINALIZE ──────────────────────────────────────────────────────────────

  @Post(':id/final')
  @RequirePermissions(PERMISSIONS.PLANNING.WRITE)
  @ApiOperation({ summary: 'Mark planning version as final' })
  @ApiMessageResponse('Planning finalized')
  async finalize(@Param('id') id: string, @Request() req: any) {
    return this.planningService.finalize(id, req.user.sub);
  }

  // ─── UPDATE DETAIL ─────────────────────────────────────────────────────────

  @Patch(':id/details/:detailId')
  @RequirePermissions(PERMISSIONS.PLANNING.WRITE)
  @ApiOperation({ summary: 'Update a single planning detail row' })
  @ApiSuccessResponse('Detail updated')
  async updateDetail(
    @Param('id') id: string,
    @Param('detailId') detailId: string,
    @Body() dto: UpdatePlanningDetailDto,
    @Request() req: any,
  ) {
    return this.planningService.updateDetail(id, detailId, dto, req.user.sub);
  }

  // ─── DELETE ────────────────────────────────────────────────────────────────

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.PLANNING.WRITE)
  @ApiOperation({ summary: 'Delete planning header' })
  @ApiMessageResponse('Planning deleted')
  async remove(@Param('id') id: string, @Request() req: any) {
    await this.planningService.remove(id, req.user.sub);
    return { message: 'Planning header deleted' };
  }
}
