import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface SkuRecommendationItem {
  productId: number | bigint;
  skuCode: string;
  productName: string;
  subCategory: string;
  color?: string;
  theme?: string;
  srp: number;
  recommendedQty: number;
  overallScore: number;
  reasoning: string;
}

export interface RecommendationResult {
  subCategoryId: string;
  budgetAmount: number;
  totalRecommendedValue: number;
  recommendations: SkuRecommendationItem[];
  warnings: string[];
}

@Injectable()
export class SkuRecommenderService {
  private readonly logger = new Logger(SkuRecommenderService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Generate SKU recommendations for a subcategory within a budget.
   */
  async generateRecommendations(input: {
    subCategoryId: string;
    brandId?: string;
    budgetAmount: number;
    maxResults?: number;
  }): Promise<RecommendationResult> {
    const warnings: string[] = [];
    const maxResults = input.maxResults || 20;

    // Get eligible products
    const where: any = {
      is_active: true,
      sub_category_id: +input.subCategoryId,
    };
    if (input.brandId) where.sub_category = { category: { brand_id: +input.brandId } };

    const products = await this.prisma.product.findMany({
      where,
      include: {
        sub_category: {
          include: { category: { include: { gender: true, brand: true } } },
        },
      },
      orderBy: { sku_code: 'asc' },
    });

    if (products.length === 0) {
      warnings.push('No eligible products found for this subcategory.');
      return {
        subCategoryId: input.subCategoryId,
        budgetAmount: input.budgetAmount,
        totalRecommendedValue: 0,
        recommendations: [],
        warnings,
      };
    }

    this.logger.log(`Found ${products.length} eligible products`);

    // Score products based on available attributes
    const scored: SkuRecommendationItem[] = products.map(product => {
      const srp = Number(product.unit_price);
      let score = 50; // base score
      const reasons: string[] = [];

      // Bonus for having complete data
      if (product.color) { score += 5; reasons.push('Has color info'); }
      if (product.theme) { score += 5; reasons.push('Has theme info'); }
      if (product.composition) { score += 5; reasons.push('Has composition'); }
      if (product.image_url) { score += 3; reasons.push('Has image'); }

      // Price fit score
      const avgPrice = input.budgetAmount / Math.min(products.length, maxResults);
      const priceRatio = srp / avgPrice;
      if (priceRatio >= 0.3 && priceRatio <= 2.0) {
        score += 15;
        reasons.push('Good price fit');
      } else if (priceRatio > 2.0) {
        score -= 10;
        reasons.push('Price may be high for budget');
      }

      return {
        productId: product.id,
        skuCode: product.sku_code,
        productName: product.product_name,
        subCategory: product.sub_category.name,
        color: product.color || undefined,
        theme: product.theme || undefined,
        srp,
        recommendedQty: 0,
        overallScore: Math.min(100, Math.max(0, score)),
        reasoning: reasons.join('. ') + '.',
      };
    });

    // Sort by score and take top results
    scored.sort((a, b) => b.overallScore - a.overallScore);
    const selected = scored.slice(0, maxResults);

    // Assign quantities proportional to score
    this.assignQuantities(selected, input.budgetAmount);

    const totalRecommendedValue = selected.reduce(
      (sum, s) => sum + s.recommendedQty * s.srp, 0,
    );

    return {
      subCategoryId: input.subCategoryId,
      budgetAmount: input.budgetAmount,
      totalRecommendedValue,
      recommendations: selected,
      warnings,
    };
  }

  /**
   * Get recommendations (cached from last generation).
   */
  async getRecommendations(subCategoryId: string) {
    // Since there's no persistence table in the schema, return empty
    return [];
  }

  /**
   * Update recommendation status.
   */
  async updateRecommendationStatus(recommendationId: string, status: 'selected' | 'rejected') {
    return { id: recommendationId, status };
  }

  /**
   * Add selected recommendations to a SKU proposal header.
   */
  async addSelectedToProposal(productIds: string[], headerId: string): Promise<number> {
    const header = await this.prisma.sKUProposalHeader.findUnique({ where: { id: +headerId } });
    if (!header) return 0;

    let added = 0;
    for (const productId of productIds) {
      const product = await this.prisma.product.findUnique({ where: { id: +productId } });
      if (!product) continue;

      // Check duplicate
      const existing = await this.prisma.sKUProposal.findFirst({
        where: { sku_proposal_header_id: +headerId, product_id: +productId },
      });
      if (existing) continue;

      await this.prisma.sKUProposal.create({
        data: {
          sku_proposal_header_id: +headerId,
          product_id: +productId,
          customer_target: 'Regular',
          unit_cost: 0,
          srp: product.unit_price,
        },
      });
      added++;
    }

    return added;
  }

  // ── helpers ────────────────────────────────────────────────────────────

  private assignQuantities(items: SkuRecommendationItem[], budgetAmount: number): void {
    if (items.length === 0) return;

    const totalScore = items.reduce((sum, s) => sum + s.overallScore, 0);
    if (totalScore === 0) return;

    for (const item of items) {
      const share = item.overallScore / totalScore;
      const budget = budgetAmount * share;
      if (item.srp > 0) {
        item.recommendedQty = Math.max(1, Math.round(budget / item.srp));
      } else {
        item.recommendedQty = 1;
      }
    }
  }
}
