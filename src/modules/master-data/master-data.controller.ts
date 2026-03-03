import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { MasterDataService } from './master-data.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiErrorResponses, ApiGenericPaginatedResponse, ApiSuccessResponse } from '../../common/decorators/api-response.decorator';

@ApiTags('master-data')
@ApiBearerAuth()
@ApiErrorResponses()
@UseGuards(JwtAuthGuard)
@Controller('master')
export class MasterDataController {
  constructor(private masterDataService: MasterDataService) {}

  @Get('group-brands')
  @ApiOperation({ summary: 'Get all group brands with their brands' })
  @ApiSuccessResponse()
  async getGroupBrands() {
    return this.masterDataService.getGroupBrands();
  }

  @Get('brands')
  @ApiOperation({ summary: 'Get all active brands' })
  @ApiSuccessResponse()
  @ApiQuery({ name: 'groupBrandId', required: false })
  async getBrands(
    @Query('groupBrandId') groupBrandId?: string,
  ) {
    return this.masterDataService.getBrands(groupBrandId);
  }

  @Get('stores')
  @ApiOperation({ summary: 'Get all active stores' })
  @ApiSuccessResponse()
  async getStores() {
    return this.masterDataService.getStores();
  }

  @Get('season-types')
  @ApiOperation({ summary: 'Get all season types' })
  @ApiSuccessResponse()
  async getSeasonTypes() {
    return this.masterDataService.getSeasonTypes();
  }

  @Get('season-groups')
  @ApiOperation({ summary: 'Get season groups with seasons (SS, FW)' })
  @ApiSuccessResponse()
  @ApiQuery({ name: 'year', required: false, type: Number })
  async getSeasonGroups(@Query('year') year?: string) {
    return this.masterDataService.getSeasonGroups(year ? +year : undefined);
  }

  @Get('seasons')
  @ApiOperation({ summary: 'Get all seasons, optionally filter by season group' })
  @ApiSuccessResponse()
  @ApiQuery({ name: 'seasonGroupId', required: false })
  async getSeasons(@Query('seasonGroupId') seasonGroupId?: string) {
    return this.masterDataService.getSeasons(seasonGroupId);
  }

  @Get('genders')
  @ApiOperation({ summary: 'Get all genders' })
  @ApiSuccessResponse()
  async getGenders() {
    return this.masterDataService.getGenders();
  }

  @Get('sub-categories')
  @ApiOperation({ summary: 'Get all active sub-categories with parent category and gender' })
  @ApiSuccessResponse()
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'genderId', required: false })
  async getSubCategories(
    @Query('categoryId') categoryId?: string,
    @Query('genderId') genderId?: string,
  ) {
    return this.masterDataService.getSubCategories(categoryId, genderId);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get full category hierarchy: Gender → Category → SubCategory → Sizes' })
  @ApiSuccessResponse()
  @ApiQuery({ name: 'genderId', required: false })
  async getCategories(
    @Query('genderId') genderId?: string,
  ) {
    return this.masterDataService.getCategories(genderId);
  }

  @Get('approval-statuses')
  @ApiOperation({ summary: 'Get all approval statuses' })
  @ApiSuccessResponse()
  async getApprovalStatuses() {
    return this.masterDataService.getApprovalStatuses();
  }

  @Get('subcategory-sizes/:subCategoryId')
  @ApiOperation({ summary: 'Get sizes for a subcategory' })
  @ApiSuccessResponse()
  async getSubcategorySizes(@Param('subCategoryId') subCategoryId: string) {
    return this.masterDataService.getSubcategorySizes(subCategoryId);
  }

  @Get('fiscal-years')
  @ApiOperation({ summary: 'Get distinct fiscal years from budgets (for Year filter dropdown)' })
  @ApiSuccessResponse()
  async getFiscalYears() {
    return this.masterDataService.getFiscalYears();
  }

  @Get('planning-filters')
  @ApiOperation({ summary: 'Get all filter options for Planning page in one request (groupBrands, brands, seasonGroups, stores, fiscalYears)' })
  @ApiSuccessResponse()
  @ApiQuery({ name: 'year', required: false, type: Number })
  async getPlanningFilterOptions(@Query('year') year?: string) {
    return this.masterDataService.getPlanningFilterOptions(year ? +year : undefined);
  }

  @Get('proposal-filters')
  @ApiOperation({ summary: 'Get all filter options for Proposal page (genders, categories, seasonGroups, stores)' })
  @ApiSuccessResponse()
  @ApiQuery({ name: 'year', required: false, type: Number })
  async getProposalFilterOptions(@Query('year') year?: string) {
    return this.masterDataService.getProposalFilterOptions(year ? +year : undefined);
  }

  @Get('sku-catalog')
  @ApiOperation({ summary: 'Get SKU catalog with filters (alias for /master/products)' })
  @ApiGenericPaginatedResponse()
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
    return this.masterDataService.getProducts({ brandId, subCategoryId, search, page, pageSize });
  }

  @Get('products')
  @ApiOperation({ summary: 'Search product catalog with filters and pagination' })
  @ApiGenericPaginatedResponse()
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
    return this.masterDataService.getProducts({
      brandId, subCategoryId, search, page, pageSize,
    });
  }
}
