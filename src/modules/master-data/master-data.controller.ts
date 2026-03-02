import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { MasterDataService } from './master-data.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('master-data')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('master')
export class MasterDataController {
  constructor(private masterDataService: MasterDataService) {}

  @Get('group-brands')
  @ApiOperation({ summary: 'Get all group brands with their brands' })
  async getGroupBrands() {
    return { success: true, data: await this.masterDataService.getGroupBrands() };
  }

  @Get('brands')
  @ApiOperation({ summary: 'Get all active brands' })
  @ApiQuery({ name: 'groupBrandId', required: false })
  async getBrands(
    @Query('groupBrandId') groupBrandId?: string,
  ) {
    return { success: true, data: await this.masterDataService.getBrands(groupBrandId) };
  }

  @Get('stores')
  @ApiOperation({ summary: 'Get all active stores' })
  async getStores() {
    return { success: true, data: await this.masterDataService.getStores() };
  }

  @Get('season-types')
  @ApiOperation({ summary: 'Get all season types' })
  async getSeasonTypes() {
    return { success: true, data: await this.masterDataService.getSeasonTypes() };
  }

  @Get('season-groups')
  @ApiOperation({ summary: 'Get season groups with seasons (SS, FW)' })
  @ApiQuery({ name: 'year', required: false, type: Number })
  async getSeasonGroups(@Query('year') year?: string) {
    return { success: true, data: await this.masterDataService.getSeasonGroups(year ? +year : undefined) };
  }

  @Get('seasons')
  @ApiOperation({ summary: 'Get all seasons, optionally filter by season group' })
  @ApiQuery({ name: 'seasonGroupId', required: false })
  async getSeasons(@Query('seasonGroupId') seasonGroupId?: string) {
    return { success: true, data: await this.masterDataService.getSeasons(seasonGroupId) };
  }

  @Get('genders')
  @ApiOperation({ summary: 'Get all genders' })
  async getGenders() {
    return { success: true, data: await this.masterDataService.getGenders() };
  }

  @Get('sub-categories')
  @ApiOperation({ summary: 'Get all active sub-categories with parent category and gender' })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'genderId', required: false })
  async getSubCategories(
    @Query('categoryId') categoryId?: string,
    @Query('genderId') genderId?: string,
  ) {
    return { success: true, data: await this.masterDataService.getSubCategories(categoryId, genderId) };
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get full category hierarchy: Gender → Category → SubCategory → Sizes' })
  @ApiQuery({ name: 'genderId', required: false })
  async getCategories(
    @Query('genderId') genderId?: string,
  ) {
    return { success: true, data: await this.masterDataService.getCategories(genderId) };
  }

  @Get('approval-statuses')
  @ApiOperation({ summary: 'Get all approval statuses' })
  async getApprovalStatuses() {
    return { success: true, data: await this.masterDataService.getApprovalStatuses() };
  }

  @Get('subcategory-sizes/:subCategoryId')
  @ApiOperation({ summary: 'Get sizes for a subcategory' })
  async getSubcategorySizes(@Param('subCategoryId') subCategoryId: string) {
    return { success: true, data: await this.masterDataService.getSubcategorySizes(subCategoryId) };
  }

  @Get('fiscal-years')
  @ApiOperation({ summary: 'Get distinct fiscal years from budgets (for Year filter dropdown)' })
  async getFiscalYears() {
    return { success: true, data: await this.masterDataService.getFiscalYears() };
  }

  @Get('planning-filters')
  @ApiOperation({ summary: 'Get all filter options for Planning page in one request (groupBrands, brands, seasonGroups, stores, fiscalYears)' })
  @ApiQuery({ name: 'year', required: false, type: Number })
  async getPlanningFilterOptions(@Query('year') year?: string) {
    return { success: true, data: await this.masterDataService.getPlanningFilterOptions(year ? +year : undefined) };
  }

  @Get('proposal-filters')
  @ApiOperation({ summary: 'Get all filter options for Proposal page (genders, categories, seasonGroups, stores)' })
  @ApiQuery({ name: 'year', required: false, type: Number })
  async getProposalFilterOptions(@Query('year') year?: string) {
    return { success: true, data: await this.masterDataService.getProposalFilterOptions(year ? +year : undefined) };
  }

  @Get('sku-catalog')
  @ApiOperation({ summary: 'Get SKU catalog with filters (alias for /master/products)' })
  @ApiQuery({ name: 'brandId', required: false })
  @ApiQuery({ name: 'subCategoryId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  async getSkuCatalog(
    @Query('brandId') brandId?: string,
    @Query('subCategoryId') subCategoryId?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    const result = await this.masterDataService.getProducts({ brandId, subCategoryId, search, page, pageSize });
    return { success: true, ...result };
  }

  @Get('products')
  @ApiOperation({ summary: 'Search product catalog with filters and pagination' })
  @ApiQuery({ name: 'brandId', required: false })
  @ApiQuery({ name: 'subCategoryId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  async getProducts(
    @Query('brandId') brandId?: string,
    @Query('subCategoryId') subCategoryId?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    const result = await this.masterDataService.getProducts({
      brandId, subCategoryId, search, page, pageSize,
    });
    return { success: true, ...result };
  }
}
