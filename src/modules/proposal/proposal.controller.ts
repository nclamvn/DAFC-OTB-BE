import { Controller, Get, Post, Put, Patch, Delete, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiBody } from '@nestjs/swagger';
import { ProposalService } from './proposal.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../common/guards/permissions.guard';
import {
  CreateSKUProposalHeaderDto,
  AddProductDto,
  BulkAddProductsDto,
  UpdateSKUProposalDto,
  BulkSKUAllocateDto,
  BulkProposalSizingDto,
  CreateProposalSizingHeaderDto,
} from './dto/proposal.dto';

/** Consistent success response wrapper */
const ok = (data: any) => ({ success: true, data });

@ApiTags('proposals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('proposals')
export class ProposalController {
  constructor(private proposalService: ProposalService) {}

  // ─── HEADERS ──────────────────────────────────────────────────────────

  @Get()
  @RequirePermissions('proposal:read')
  @ApiOperation({ summary: 'List SKU proposal headers with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, description: 'DRAFT | SUBMITTED | APPROVED | REJECTED' })
  @ApiQuery({ name: 'allocateHeaderId', required: false, description: 'Filter by allocate header ID' })
  async findAll(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('status') status?: string,
    @Query('allocateHeaderId') allocateHeaderId?: string,
  ) {
    return { success: true, ...(await this.proposalService.findAll({ page, pageSize, status, allocateHeaderId })) };
  }

  @Get('statistics')
  @RequirePermissions('proposal:read')
  @ApiOperation({ summary: 'Get proposal statistics' })
  @ApiQuery({ name: 'budgetId', required: false })
  async getStatistics(@Query('budgetId') budgetId?: string) {
    return ok(await this.proposalService.getStatistics(budgetId));
  }

  @Get('historical')
  @RequirePermissions('proposal:read')
  @ApiOperation({ summary: 'Get historical (previous year) proposal for a brand + season' })
  @ApiQuery({ name: 'fiscalYear', required: true, type: Number })
  @ApiQuery({ name: 'seasonGroupName', required: true })
  @ApiQuery({ name: 'seasonName', required: true })
  @ApiQuery({ name: 'brandId', required: true })
  async findHistorical(
    @Query('fiscalYear') fiscalYear: number,
    @Query('seasonGroupName') seasonGroupName: string,
    @Query('seasonName') seasonName: string,
    @Query('brandId') brandId: string,
  ) {
    const result = await this.proposalService.findHistorical({
      fiscalYear: Number(fiscalYear),
      seasonGroupName,
      seasonName,
      brandId,
    });
    return ok(result);
  }

  @Get(':id')
  @RequirePermissions('proposal:read')
  @ApiOperation({ summary: 'Get SKU proposal header with nested data' })
  async findOne(@Param('id') id: string) {
    return ok(await this.proposalService.findOne(id));
  }

  @Post()
  @RequirePermissions('proposal:write')
  @ApiOperation({ summary: 'Create new SKU proposal header' })
  @ApiBody({ type: CreateSKUProposalHeaderDto })
  async create(@Body() dto: CreateSKUProposalHeaderDto, @Request() req: any) {
    return ok(await this.proposalService.create(dto, req.user.sub));
  }

  @Put(':id')
  @RequirePermissions('proposal:write')
  @ApiOperation({ summary: 'Update SKU proposal header' })
  async updateHeader(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
    return ok(await this.proposalService.updateHeader(id, dto, req.user.sub));
  }

  @Put(':id/save-full')
  @RequirePermissions('proposal:write')
  @ApiOperation({ summary: 'Save all products + store allocations' })
  async saveFullProposal(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
    return ok(await this.proposalService.saveFullProposal(id, dto, req.user.sub));
  }

  @Post(':id/copy')
  @RequirePermissions('proposal:write')
  @ApiOperation({ summary: 'Copy proposal to a new version' })
  async copyProposal(@Param('id') id: string, @Request() req: any) {
    return ok(await this.proposalService.copyProposal(id, req.user.sub));
  }

  @Delete(':id')
  @RequirePermissions('proposal:write')
  @ApiOperation({ summary: 'Delete SKU proposal header and all related data' })
  async remove(@Param('id') id: string) {
    await this.proposalService.remove(id);
    return { success: true, message: 'Deleted' };
  }

  // ─── SUBMIT / APPROVE ────────────────────────────────────────────────

  @Post(':id/submit')
  @RequirePermissions('proposal:submit')
  @ApiOperation({ summary: 'Submit proposal for approval (DRAFT → SUBMITTED)' })
  async submit(@Param('id') id: string, @Request() req: any) {
    return ok(await this.proposalService.submit(id, req.user.sub));
  }

  @Post(':id/approve/:level')
  @RequirePermissions('proposal:approve')
  @ApiOperation({ summary: 'Approve or reject proposal by level' })
  async approveByLevel(
    @Param('id') id: string,
    @Param('level') level: string,
    @Body('action') action: string,
    @Body('comment') comment: string,
    @Request() req: any,
  ) {
    return ok(await this.proposalService.approveByLevel(id, level, action, comment, req.user.sub));
  }

  // ─── SKU PROPOSAL ITEMS ──────────────────────────────────────────────

  @Post(':id/products')
  @RequirePermissions('proposal:write')
  @ApiOperation({ summary: 'Add a product to proposal' })
  @ApiBody({ type: AddProductDto })
  async addProduct(@Param('id') id: string, @Body() dto: AddProductDto, @Request() req: any) {
    return ok(await this.proposalService.addProduct(id, dto, req.user.sub));
  }

  @Post(':id/products/bulk')
  @RequirePermissions('proposal:write')
  @ApiOperation({ summary: 'Bulk add products to proposal' })
  @ApiBody({ type: BulkAddProductsDto })
  async bulkAddProducts(@Param('id') id: string, @Body() dto: BulkAddProductsDto, @Request() req: any) {
    return ok(await this.proposalService.bulkAddProducts(id, dto, req.user.sub));
  }

  @Patch('items/:proposalId')
  @RequirePermissions('proposal:write')
  @ApiOperation({ summary: 'Update a SKU proposal item' })
  @ApiBody({ type: UpdateSKUProposalDto })
  async updateProposal(@Param('proposalId') proposalId: string, @Body() dto: UpdateSKUProposalDto) {
    return ok(await this.proposalService.updateProposal(proposalId, dto));
  }

  @Delete('items/:proposalId')
  @RequirePermissions('proposal:write')
  @ApiOperation({ summary: 'Remove a SKU proposal item' })
  async removeProposal(@Param('proposalId') proposalId: string) {
    return ok(await this.proposalService.removeProposal(proposalId));
  }

  // ─── ALLOCATIONS ─────────────────────────────────────────────────────

  @Post('allocations')
  @RequirePermissions('proposal:write')
  @ApiOperation({ summary: 'Create store allocations' })
  @ApiBody({ type: BulkSKUAllocateDto })
  async createAllocations(@Body() dto: BulkSKUAllocateDto) {
    return ok(await this.proposalService.createAllocations(dto));
  }

  @Get('items/:skuProposalId/allocations')
  @RequirePermissions('proposal:read')
  @ApiOperation({ summary: 'Get store allocations for a SKU proposal' })
  async getStoreAllocations(@Param('skuProposalId') skuProposalId: string) {
    return ok(await this.proposalService.getStoreAllocations(skuProposalId));
  }

  @Patch('allocations/:allocationId')
  @RequirePermissions('proposal:write')
  @ApiOperation({ summary: 'Update allocation quantity' })
  async updateAllocation(@Param('allocationId') allocationId: string, @Body('quantity') quantity: number) {
    return ok(await this.proposalService.updateAllocation(allocationId, quantity));
  }

  @Delete('allocations/:allocationId')
  @RequirePermissions('proposal:write')
  @ApiOperation({ summary: 'Delete an allocation' })
  async deleteAllocation(@Param('allocationId') allocationId: string) {
    return ok(await this.proposalService.deleteAllocation(allocationId));
  }

  // ─── SIZING HEADERS ──────────────────────────────────────────────────

  @Post('sizing-headers')
  @RequirePermissions('proposal:write')
  @ApiOperation({ summary: 'Create Proposal Sizing Header with sizings' })
  @ApiBody({ type: CreateProposalSizingHeaderDto })
  async createSizingHeader(@Body() dto: CreateProposalSizingHeaderDto, @Request() req: any) {
    return ok(await this.proposalService.createSizingHeader(dto, req.user.sub));
  }

  @Get(':headerId/sizing-headers')
  @RequirePermissions('proposal:read')
  @ApiOperation({ summary: 'List Sizing Headers for a SKU Proposal Header' })
  async getSizingHeadersByProposalHeader(@Param('headerId') headerId: string) {
    return ok(await this.proposalService.getSizingHeadersByProposalHeader(headerId));
  }

  @Get('sizing-headers/:headerId')
  @RequirePermissions('proposal:read')
  @ApiOperation({ summary: 'Get Sizing Header detail' })
  async getSizingHeader(@Param('headerId') headerId: string) {
    return ok(await this.proposalService.getSizingHeader(headerId));
  }

  @Patch('sizing-headers/:headerId')
  @RequirePermissions('proposal:write')
  @ApiOperation({ summary: 'Update Sizing Header (set final, etc.)' })
  async updateSizingHeader(@Param('headerId') headerId: string, @Body() dto: any, @Request() req: any) {
    return ok(await this.proposalService.updateSizingHeader(headerId, dto, req.user.sub));
  }

  @Delete('sizing-headers/:headerId')
  @RequirePermissions('proposal:write')
  @ApiOperation({ summary: 'Delete Sizing Header and all sizings' })
  async deleteSizingHeader(@Param('headerId') headerId: string) {
    return ok(await this.proposalService.deleteSizingHeader(headerId));
  }

  // ─── SIZINGS (individual rows) ───────────────────────────────────────

  @Post('sizings')
  @RequirePermissions('proposal:write')
  @ApiOperation({ summary: 'Add sizings to a Sizing Header' })
  @ApiBody({ type: BulkProposalSizingDto })
  async createSizings(@Body() dto: BulkProposalSizingDto) {
    return ok(await this.proposalService.createSizings(dto));
  }

  @Get('sizing-headers/:headerId/sizings')
  @RequirePermissions('proposal:read')
  @ApiOperation({ summary: 'List sizings for a Sizing Header' })
  async getSizings(@Param('headerId') headerId: string) {
    return ok(await this.proposalService.getSizings(headerId));
  }

  @Patch('sizings/:sizingId')
  @RequirePermissions('proposal:write')
  @ApiOperation({ summary: 'Update sizing quantity' })
  async updateSizing(@Param('sizingId') sizingId: string, @Body('proposalQuantity') quantity: number) {
    return ok(await this.proposalService.updateSizing(sizingId, quantity));
  }

  @Delete('sizings/:sizingId')
  @RequirePermissions('proposal:write')
  @ApiOperation({ summary: 'Delete a sizing' })
  async deleteSizing(@Param('sizingId') sizingId: string) {
    return ok(await this.proposalService.deleteSizing(sizingId));
  }
}
