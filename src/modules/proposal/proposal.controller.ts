import { Controller, Get, Post, Put, Patch, Delete, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiBody } from '@nestjs/swagger';
import { ProposalService } from './proposal.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../common/guards/permissions.guard';
import { PERMISSIONS } from '../../common/constants/permissions';
import {
  CreateSKUProposalHeaderDto,
  AddProductDto,
  BulkAddProductsDto,
  UpdateSKUProposalDto,
  BulkSKUAllocateDto,
  BulkProposalSizingDto,
  CreateProposalSizingHeaderDto,
  UpdateProposalHeaderDto,
  SaveFullProposalDto,
  UpdateSizingHeaderDto,
} from './dto/proposal.dto';
import { ApiErrorResponses, ApiGenericPaginatedResponse, ApiSuccessResponse, ApiMessageResponse } from '../../common/decorators/api-response.decorator';

@ApiTags('proposals')
@ApiBearerAuth()
@ApiErrorResponses()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('proposals')
export class ProposalController {
  constructor(private proposalService: ProposalService) {}

  // ─── HEADERS ──────────────────────────────────────────────────────────

  @Get()
  @RequirePermissions(PERMISSIONS.PROPOSAL.READ)
  @ApiOperation({ summary: 'List SKU proposal headers with pagination' })
  @ApiGenericPaginatedResponse()
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
    return this.proposalService.findAll({ page, pageSize, status, allocateHeaderId });
  }

  @Get('statistics')
  @RequirePermissions(PERMISSIONS.PROPOSAL.READ)
  @ApiOperation({ summary: 'Get proposal statistics' })
  @ApiSuccessResponse()
  @ApiQuery({ name: 'budgetId', required: false })
  async getStatistics(@Query('budgetId') budgetId?: string) {
    return this.proposalService.getStatistics(budgetId);
  }

  @Get('historical')
  @RequirePermissions(PERMISSIONS.PROPOSAL.READ)
  @ApiOperation({ summary: 'Get historical (previous year) proposal for a brand + season' })
  @ApiSuccessResponse()
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
    return this.proposalService.findHistorical({
      fiscalYear: Number(fiscalYear),
      seasonGroupName,
      seasonName,
      brandId,
    });
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PROPOSAL.READ)
  @ApiOperation({ summary: 'Get SKU proposal header with nested data' })
  @ApiSuccessResponse()
  async findOne(@Param('id') id: string) {
    return this.proposalService.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PROPOSAL.WRITE)
  @ApiOperation({ summary: 'Create new SKU proposal header' })
  @ApiSuccessResponse('Proposal created')
  @ApiBody({ type: CreateSKUProposalHeaderDto })
  async create(@Body() dto: CreateSKUProposalHeaderDto, @Request() req: any) {
    return this.proposalService.create(dto, req.user.sub);
  }

  @Put(':id')
  @RequirePermissions(PERMISSIONS.PROPOSAL.WRITE)
  @ApiOperation({ summary: 'Update SKU proposal header' })
  @ApiSuccessResponse('Proposal updated')
  async updateHeader(@Param('id') id: string, @Body() dto: UpdateProposalHeaderDto, @Request() req: any) {
    return this.proposalService.updateHeader(id, dto, req.user.sub);
  }

  @Put(':id/save-full')
  @RequirePermissions(PERMISSIONS.PROPOSAL.WRITE)
  @ApiOperation({ summary: 'Save all products + store allocations' })
  @ApiSuccessResponse('Proposal saved')
  async saveFullProposal(@Param('id') id: string, @Body() dto: SaveFullProposalDto, @Request() req: any) {
    return this.proposalService.saveFullProposal(id, dto, req.user.sub);
  }

  @Post(':id/copy')
  @RequirePermissions(PERMISSIONS.PROPOSAL.WRITE)
  @ApiOperation({ summary: 'Copy proposal to a new version' })
  @ApiSuccessResponse('Proposal copied')
  async copyProposal(@Param('id') id: string, @Request() req: any) {
    return this.proposalService.copyProposal(id, req.user.sub);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.PROPOSAL.WRITE)
  @ApiOperation({ summary: 'Delete SKU proposal header and all related data' })
  @ApiMessageResponse('Deleted')
  async remove(@Param('id') id: string, @Request() req: any) {
    await this.proposalService.remove(id, req.user.sub);
    return { message: 'Deleted' };
  }

  // ─── SUBMIT / APPROVE ────────────────────────────────────────────────

  @Post(':id/submit')
  @RequirePermissions(PERMISSIONS.PROPOSAL.SUBMIT)
  @ApiOperation({ summary: 'Submit proposal for approval (DRAFT → SUBMITTED)' })
  @ApiMessageResponse('Proposal submitted')
  async submit(@Param('id') id: string, @Request() req: any) {
    return this.proposalService.submit(id, req.user.sub);
  }

  @Post(':id/approve/:level')
  @RequirePermissions(PERMISSIONS.PROPOSAL.APPROVE)
  @ApiOperation({ summary: 'Approve or reject proposal by level' })
  @ApiSuccessResponse()
  async approveByLevel(
    @Param('id') id: string,
    @Param('level') level: string,
    @Body('action') action: string,
    @Body('comment') comment: string,
    @Request() req: any,
  ) {
    return this.proposalService.approveByLevel(id, level, action, comment, req.user.sub);
  }

  // ─── SKU PROPOSAL ITEMS ──────────────────────────────────────────────

  @Post(':id/products')
  @RequirePermissions(PERMISSIONS.PROPOSAL.WRITE)
  @ApiOperation({ summary: 'Add a product to proposal' })
  @ApiSuccessResponse('Product added')
  @ApiBody({ type: AddProductDto })
  async addProduct(@Param('id') id: string, @Body() dto: AddProductDto, @Request() req: any) {
    return this.proposalService.addProduct(id, dto, req.user.sub);
  }

  @Post(':id/products/bulk')
  @RequirePermissions(PERMISSIONS.PROPOSAL.WRITE)
  @ApiOperation({ summary: 'Bulk add products to proposal' })
  @ApiSuccessResponse('Products added')
  @ApiBody({ type: BulkAddProductsDto })
  async bulkAddProducts(@Param('id') id: string, @Body() dto: BulkAddProductsDto, @Request() req: any) {
    return this.proposalService.bulkAddProducts(id, dto, req.user.sub);
  }

  @Patch('items/:proposalId')
  @RequirePermissions(PERMISSIONS.PROPOSAL.WRITE)
  @ApiOperation({ summary: 'Update a SKU proposal item' })
  @ApiSuccessResponse('Proposal item updated')
  @ApiBody({ type: UpdateSKUProposalDto })
  async updateProposal(@Param('proposalId') proposalId: string, @Body() dto: UpdateSKUProposalDto) {
    return this.proposalService.updateProposal(proposalId, dto);
  }

  @Delete('items/:proposalId')
  @RequirePermissions(PERMISSIONS.PROPOSAL.WRITE)
  @ApiOperation({ summary: 'Remove a SKU proposal item' })
  @ApiMessageResponse('Deleted')
  async removeProposal(@Param('proposalId') proposalId: string) {
    return this.proposalService.removeProposal(proposalId);
  }

  // ─── ALLOCATIONS ─────────────────────────────────────────────────────

  @Post('allocations')
  @RequirePermissions(PERMISSIONS.PROPOSAL.WRITE)
  @ApiOperation({ summary: 'Create store allocations' })
  @ApiSuccessResponse('Allocations created')
  @ApiBody({ type: BulkSKUAllocateDto })
  async createAllocations(@Body() dto: BulkSKUAllocateDto) {
    return this.proposalService.createAllocations(dto);
  }

  @Get('items/:skuProposalId/allocations')
  @RequirePermissions(PERMISSIONS.PROPOSAL.READ)
  @ApiOperation({ summary: 'Get store allocations for a SKU proposal' })
  @ApiSuccessResponse()
  async getStoreAllocations(@Param('skuProposalId') skuProposalId: string) {
    return this.proposalService.getStoreAllocations(skuProposalId);
  }

  @Patch('allocations/:allocationId')
  @RequirePermissions(PERMISSIONS.PROPOSAL.WRITE)
  @ApiOperation({ summary: 'Update allocation quantity' })
  @ApiSuccessResponse('Allocation updated')
  async updateAllocation(@Param('allocationId') allocationId: string, @Body('quantity') quantity: number) {
    return this.proposalService.updateAllocation(allocationId, quantity);
  }

  @Delete('allocations/:allocationId')
  @RequirePermissions(PERMISSIONS.PROPOSAL.WRITE)
  @ApiOperation({ summary: 'Delete an allocation' })
  @ApiMessageResponse('Deleted')
  async deleteAllocation(@Param('allocationId') allocationId: string) {
    return this.proposalService.deleteAllocation(allocationId);
  }

  // ─── SIZING HEADERS ──────────────────────────────────────────────────

  @Post('sizing-headers')
  @RequirePermissions(PERMISSIONS.PROPOSAL.WRITE)
  @ApiOperation({ summary: 'Create Proposal Sizing Header with sizings' })
  @ApiSuccessResponse('Sizing header created')
  @ApiBody({ type: CreateProposalSizingHeaderDto })
  async createSizingHeader(@Body() dto: CreateProposalSizingHeaderDto, @Request() req: any) {
    return this.proposalService.createSizingHeader(dto, req.user.sub);
  }

  @Get(':headerId/sizing-headers')
  @RequirePermissions(PERMISSIONS.PROPOSAL.READ)
  @ApiOperation({ summary: 'List Sizing Headers for a SKU Proposal Header' })
  @ApiSuccessResponse()
  async getSizingHeadersByProposalHeader(@Param('headerId') headerId: string) {
    return this.proposalService.getSizingHeadersByProposalHeader(headerId);
  }

  @Get('sizing-headers/:headerId')
  @RequirePermissions(PERMISSIONS.PROPOSAL.READ)
  @ApiOperation({ summary: 'Get Sizing Header detail' })
  @ApiSuccessResponse()
  async getSizingHeader(@Param('headerId') headerId: string) {
    return this.proposalService.getSizingHeader(headerId);
  }

  @Patch('sizing-headers/:headerId')
  @RequirePermissions(PERMISSIONS.PROPOSAL.WRITE)
  @ApiOperation({ summary: 'Update Sizing Header (set final, etc.)' })
  @ApiSuccessResponse('Sizing header updated')
  async updateSizingHeader(@Param('headerId') headerId: string, @Body() dto: UpdateSizingHeaderDto, @Request() req: any) {
    return this.proposalService.updateSizingHeader(headerId, dto, req.user.sub);
  }

  @Delete('sizing-headers/:headerId')
  @RequirePermissions(PERMISSIONS.PROPOSAL.WRITE)
  @ApiOperation({ summary: 'Delete Sizing Header and all sizings' })
  @ApiMessageResponse('Deleted')
  async deleteSizingHeader(@Param('headerId') headerId: string) {
    return this.proposalService.deleteSizingHeader(headerId);
  }

  // ─── SIZINGS (individual rows) ───────────────────────────────────────

  @Post('sizings')
  @RequirePermissions(PERMISSIONS.PROPOSAL.WRITE)
  @ApiOperation({ summary: 'Add sizings to a Sizing Header' })
  @ApiSuccessResponse('Sizings created')
  @ApiBody({ type: BulkProposalSizingDto })
  async createSizings(@Body() dto: BulkProposalSizingDto) {
    return this.proposalService.createSizings(dto);
  }

  @Get('sizing-headers/:headerId/sizings')
  @RequirePermissions(PERMISSIONS.PROPOSAL.READ)
  @ApiOperation({ summary: 'List sizings for a Sizing Header' })
  @ApiSuccessResponse()
  async getSizings(@Param('headerId') headerId: string) {
    return this.proposalService.getSizings(headerId);
  }

  @Patch('sizings/:sizingId')
  @RequirePermissions(PERMISSIONS.PROPOSAL.WRITE)
  @ApiOperation({ summary: 'Update sizing quantity' })
  @ApiSuccessResponse('Sizing updated')
  async updateSizing(@Param('sizingId') sizingId: string, @Body('proposalQuantity') quantity: number) {
    return this.proposalService.updateSizing(sizingId, quantity);
  }

  @Delete('sizings/:sizingId')
  @RequirePermissions(PERMISSIONS.PROPOSAL.WRITE)
  @ApiOperation({ summary: 'Delete a sizing' })
  @ApiMessageResponse('Deleted')
  async deleteSizing(@Param('sizingId') sizingId: string) {
    return this.proposalService.deleteSizing(sizingId);
  }
}
