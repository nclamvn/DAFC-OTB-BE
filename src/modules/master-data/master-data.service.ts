import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MasterDataService {
  constructor(private prisma: PrismaService) {}

  // ─── GROUP BRANDS ────────────────────────────────────────────────────────
  async getGroupBrands() {
    const result = await this.prisma.groupBrand.findMany({
      where: { is_active: true },
      include: {
        brands: {
          where: { is_active: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
    // Deduplicate brands by name (DB collation is case-insensitive → duplicates)
    // Prefer title-case version (e.g. "Ferragamo" over "FERRAGAMO")
    result.forEach(gb => {
      const map = new Map<string, (typeof gb.brands)[0]>();
      for (const b of gb.brands) {
        const key = b.name.toLowerCase();
        const prev = map.get(key);
        if (!prev || (prev.name === prev.name.toUpperCase() && b.name !== b.name.toUpperCase())) {
          map.set(key, b);
        }
      }
      gb.brands = Array.from(map.values());
    });
    return result;
  }

  // ─── BRANDS ──────────────────────────────────────────────────────────────
  async getBrands(groupBrandId?: string) {
    const where: Prisma.BrandWhereInput = {
      is_active: true,
    };
    if (groupBrandId) where.group_brand_id = +groupBrandId;

    const brands = await this.prisma.brand.findMany({
      where,
      include: { group_brand: true },
      orderBy: { name: 'asc' },
    });
    // Deduplicate by name (DB collation is case-insensitive → duplicates)
    // Prefer title-case version (e.g. "Ferragamo" over "FERRAGAMO")
    const map = new Map<string, (typeof brands)[0]>();
    for (const b of brands) {
      const key = b.name.toLowerCase();
      const prev = map.get(key);
      if (!prev || (prev.name === prev.name.toUpperCase() && b.name !== b.name.toUpperCase())) {
        map.set(key, b);
      }
    }
    return Array.from(map.values());
  }

  // ─── STORES ──────────────────────────────────────────────────────────────
  async getStores() {
    return this.prisma.store.findMany({
      where: { is_active: true },
      orderBy: { code: 'asc' },
    });
  }

  // ─── SEASON TYPES ───────────────────────────────────────────────────────
  async getSeasonTypes() {
    return this.prisma.seasonType.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' },
    });
  }

  // ─── SEASON GROUPS & SEASONS ─────────────────────────────────────────────
  async getSeasonGroups() {
    return this.prisma.seasonGroup.findMany({
      where: { is_active: true },
      include: {
        seasons: {
          where: { is_active: true },
          orderBy: [{ no: 'asc' }, { id: 'asc' }],
        },
      },
      orderBy: { id: 'asc' },
    });
  }

  async getSeasons(seasonGroupId?: string) {
    const where: Prisma.SeasonWhereInput = { is_active: true };
    if (seasonGroupId) where.season_group_id = +seasonGroupId;

    return this.prisma.season.findMany({
      where,
      include: { season_group: true },
      orderBy: [{ no: 'asc' }, { id: 'asc' }],
    });
  }

  // ─── GENDERS ─────────────────────────────────────────────────────────────
  async getGenders() {
    return this.prisma.gender.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' },
    });
  }

  // ─── CATEGORIES (Full Hierarchy) ─────────────────────────────────────────
  async getCategories(genderId?: string, brandId?: string) {
    const where: Prisma.GenderWhereInput = { is_active: true };
    if (genderId) where.id = +genderId;

    const catWhere: Prisma.CategoryWhereInput = { is_active: true };
    if (brandId) catWhere.brand_id = +brandId;

    return this.prisma.gender.findMany({
      where,
      include: {
        categories: {
          where: catWhere,
          include: {
            sub_categories: {
              where: { is_active: true },
              include: {
                subcategory_sizes: {
                  orderBy: { name: 'asc' },
                },
              },
              orderBy: { name: 'asc' },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  // ─── SUB-CATEGORIES ──────────────────────────────────────────────────────
  async getSubCategories(categoryId?: string, genderId?: string) {
    const where: any = { is_active: true };
    if (categoryId) where.category_id = categoryId;
    else if (genderId) where.category = { gender_id: genderId };

    return this.prisma.subCategory.findMany({
      where,
      include: {
        category: { include: { gender: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  // ─── SUBCATEGORY SIZES ───────────────────────────────────────────────────
  async getSubcategorySizes(subCategoryId: string) {
    return this.prisma.subcategorySize.findMany({
      where: { sub_category_id: +subCategoryId },
      orderBy: { name: 'asc' },
    });
  }

  // ─── APPROVAL STATUSES ──────────────────────────────────────────────────
  async getApprovalStatuses() {
    return this.prisma.approvalStatus.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' },
    });
  }

  // ─── FISCAL YEARS ────────────────────────────────────────────────────────
  async getFiscalYears() {
    const rows = await this.prisma.budget.findMany({
      distinct: ['fiscal_year'],
      select: { fiscal_year: true },
      orderBy: { fiscal_year: 'desc' },
    });
    return rows.map(r => r.fiscal_year);
  }

  // ─── PLANNING FILTER OPTIONS (gộp 1 call) ────────────────────────────────
  async getPlanningFilterOptions() {
    const [groupBrands, seasonGroups, stores, fiscalYears] = await Promise.all([
      this.getGroupBrands(),
      this.getSeasonGroups(),
      this.getStores(),
      this.getFiscalYears(),
    ]);

    // Flatten brands từ groupBrands
    const brands = groupBrands.flatMap(gb =>
      (gb.brands || []).map(b => ({ ...b, group_brand: { id: gb.id, code: gb.code, name: gb.name } }))
    );

    return { groupBrands, brands, seasonGroups, stores, fiscalYears };
  }

  // ─── PROPOSAL FILTER OPTIONS ─────────────────────────────────────────────
  async getProposalFilterOptions() {
    const [genders, seasonGroups, stores] = await Promise.all([
      this.getGenders(),
      this.getSeasonGroups(),
      this.getStores(),
    ]);

    const categories = await this.prisma.category.findMany({
      where: { is_active: true },
      include: {
        gender: true,
        sub_categories: {
          where: { is_active: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    return { genders, categories, seasonGroups, stores };
  }

  // ─── PRODUCTS (SKU CATALOG) ──────────────────────────────────────────────
  async getProducts(filters?: {
    brandId?: string;
    subCategoryId?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 50;

    const where: Prisma.ProductWhereInput = { is_active: true };
    if (filters?.brandId) where.sub_category = { category: { brand_id: BigInt(filters.brandId) } };
    if (filters?.subCategoryId) where.sub_category_id = BigInt(filters.subCategoryId);
    if (filters?.search) {
      where.OR = [
        { sku_code: { contains: filters.search } },
        { product_name: { contains: filters.search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          sub_category: {
            include: {
              category: {
                include: { gender: true, brand: true },
              },
            },
          },
        },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        orderBy: { sku_code: 'asc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data,
      meta: {
        page: Number(page),
        pageSize: Number(pageSize),
        total,
        totalPages: Math.ceil(total / Number(pageSize)),
      },
    };
  }

  // ─── PRODUCT RECOMMEND (SKU recommendations per season/year) ───────────
  // Table has no PK and nullable columns — use Prisma findMany with filters
  async getProductRecommends(filters?: {
    year?: number;
    seasonName?: string;
    brandName?: string;
    subCategory?: string;
  }) {
    const where: any = { is_active: true };
    if (filters?.year) where.year = Number(filters.year);
    if (filters?.seasonName) {
      // Find season by name and filter by season_id
      const season = await this.prisma.season.findFirst({ where: { name: filters.seasonName } });
      if (season) where.season_id = season.id;
    }
    if (filters?.subCategory) {
      const subCat = await this.prisma.subCategory.findFirst({ where: { name: filters.subCategory } });
      if (subCat) where.sub_category_id = subCat.id;
    }

    const data = await this.prisma.productRecommend.findMany({
      where,
      orderBy: { sku_code: 'asc' },
      include: {
        product: {
          include: {
            sub_category: {
              include: {
                category: {
                  include: { gender: true },
                },
              },
            },
          },
        },
        season: true,
        sub_category: true,
      },
    });

    return data;
  }

  // ─── CURRENCIES ──────────────────────────────────────────────────────────
  async getCurrencies() {
    return this.prisma.currency.findMany({
      where: { is_active: true },
      orderBy: { currency_code: 'asc' },
    });
  }

  async getCurrencyById(id: string) {
    return this.prisma.currency.findUnique({ where: { id: BigInt(id) } });
  }

  async createCurrency(data: {
    currencyCode: string;
    currencyName: string;
    symbol?: string;
    exchangeRateToVnd?: number;
  }) {
    return this.prisma.currency.create({
      data: {
        currency_code: data.currencyCode,
        currency_name: data.currencyName,
        symbol: data.symbol,
        exchange_rate_to_vnd: data.exchangeRateToVnd ?? 1,
      },
    });
  }

  async updateCurrency(id: string, data: {
    currencyName?: string;
    symbol?: string;
    exchangeRateToVnd?: number;
    isActive?: boolean;
  }) {
    return this.prisma.currency.update({
      where: { id: BigInt(id) },
      data: {
        ...(data.currencyName !== undefined && { currency_name: data.currencyName }),
        ...(data.symbol !== undefined && { symbol: data.symbol }),
        ...(data.exchangeRateToVnd !== undefined && { exchange_rate_to_vnd: data.exchangeRateToVnd }),
        ...(data.isActive !== undefined && { is_active: data.isActive }),
      },
    });
  }
}
