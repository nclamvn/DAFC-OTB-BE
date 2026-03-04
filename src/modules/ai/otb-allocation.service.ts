import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface DimensionRecommendation {
  dimensionType: 'seasonType' | 'gender' | 'category';
  dimensionValue: string;
  dimensionId: number | bigint;
  recommendedPct: number;
  recommendedAmt: number;
  confidence: number;
  reasoning: string;
}

export interface AllocationResult {
  budgetAmount: number;
  seasonTypes: DimensionRecommendation[];
  genders: DimensionRecommendation[];
  categories: DimensionRecommendation[];
  overallConfidence: number;
  warnings: string[];
}

@Injectable()
export class OtbAllocationService {
  private readonly logger = new Logger(OtbAllocationService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Generate OTB allocation recommendations based on available master data.
   */
  async generateAllocation(input: {
    budgetAmount: number;
    storeId?: string;
  }): Promise<AllocationResult> {
    const warnings: string[] = [];

    const seasonTypes = await this.recommendSeasonTypes(input.budgetAmount);
    const genders = await this.recommendGenders(input.budgetAmount);
    const categories = await this.recommendCategories(input.budgetAmount);

    this.normalize(seasonTypes);
    this.normalize(genders);
    this.normalize(categories);

    const all = [...seasonTypes, ...genders, ...categories];
    const overallConfidence = all.length > 0
      ? all.reduce((s, r) => s + r.confidence, 0) / all.length
      : 0;

    if (all.length === 0) {
      warnings.push('No master data available for recommendations.');
    }

    return {
      budgetAmount: input.budgetAmount,
      seasonTypes,
      genders,
      categories,
      overallConfidence,
      warnings,
    };
  }

  async compareAllocation(
    userAllocation: Array<{ dimensionType: string; dimensionValue: string; pct: number }>,
    budgetAmount: number,
  ) {
    const recommendation = await this.generateAllocation({ budgetAmount });

    const allRecs = [
      ...recommendation.seasonTypes,
      ...recommendation.genders,
      ...recommendation.categories,
    ];

    const comparisons = userAllocation.map(user => {
      const ai = allRecs.find(
        r => r.dimensionType === user.dimensionType && r.dimensionValue === user.dimensionValue,
      );
      const deviation = ai ? Math.abs(user.pct - ai.recommendedPct) : 0;

      return {
        dimensionType: user.dimensionType,
        dimensionValue: user.dimensionValue,
        userPct: user.pct,
        aiPct: ai ? ai.recommendedPct : null,
        deviation,
        status: deviation <= 5 ? 'aligned' : deviation <= 15 ? 'minor_deviation' : 'significant_deviation',
      };
    });

    const avgDev = comparisons.reduce((s, c) => s + c.deviation, 0) / (comparisons.length || 1);
    const alignmentScore = Math.max(0, 100 - avgDev * 2);

    return {
      comparisons,
      alignmentScore,
      overallStatus: avgDev <= 5 ? 'good' : avgDev <= 15 ? 'review_recommended' : 'high_risk',
      suggestion: avgDev > 15
        ? 'Significant deviation from AI recommendations. Review allocation.'
        : avgDev > 5
          ? 'Minor deviations detected. Consider reviewing flagged categories.'
          : 'Allocation aligns well with AI recommendations.',
    };
  }

  // ── private helpers ────────────────────────────────────────────────────

  private async recommendSeasonTypes(budgetAmount: number): Promise<DimensionRecommendation[]> {
    const seasonTypes = await this.prisma.seasonType.findMany({
      where: { is_active: true },
    });

    if (seasonTypes.length === 0) return [];

    const equalPct = 100 / seasonTypes.length;
    return seasonTypes.map(c => ({
      dimensionType: 'seasonType' as const,
      dimensionValue: c.name,
      dimensionId: c.id,
      recommendedPct: Math.round(equalPct * 10) / 10,
      recommendedAmt: Math.round(budgetAmount * (equalPct / 100)),
      confidence: 0.5,
      reasoning: `Equal distribution across ${seasonTypes.length} season types. Adjust based on seasonal strategy.`,
    }));
  }

  private async recommendGenders(budgetAmount: number): Promise<DimensionRecommendation[]> {
    const genders = await this.prisma.gender.findMany({
      where: { is_active: true },
      include: { _count: { select: { categories: true } } },
    });

    if (genders.length === 0) return [];

    // Weight by number of categories
    const totalCats = genders.reduce((sum, g) => sum + g._count.categories, 0);

    return genders.map(g => {
      const pct = totalCats > 0
        ? (g._count.categories / totalCats) * 100
        : 100 / genders.length;

      return {
        dimensionType: 'gender' as const,
        dimensionValue: g.name,
        dimensionId: g.id,
        recommendedPct: Math.round(pct * 10) / 10,
        recommendedAmt: Math.round(budgetAmount * (pct / 100)),
        confidence: 0.6,
        reasoning: `Based on category distribution: ${g._count.categories} categories under ${g.name}.`,
      };
    });
  }

  private async recommendCategories(budgetAmount: number): Promise<DimensionRecommendation[]> {
    const categories = await this.prisma.category.findMany({
      where: { is_active: true },
      include: {
        gender: true,
        sub_categories: { where: { is_active: true } },
      },
    });

    if (categories.length === 0) return [];

    // Weight by subcategory count
    const totalSubs = categories.reduce((sum, c) => sum + c.sub_categories.length, 0);

    return categories.map(c => {
      const pct = totalSubs > 0
        ? (c.sub_categories.length / totalSubs) * 100
        : 100 / categories.length;

      return {
        dimensionType: 'category' as const,
        dimensionValue: `${c.gender.name} - ${c.name}`,
        dimensionId: c.id,
        recommendedPct: Math.round(pct * 10) / 10,
        recommendedAmt: Math.round(budgetAmount * (pct / 100)),
        confidence: 0.5,
        reasoning: `Based on subcategory breadth: ${c.sub_categories.length} subcategories.`,
      };
    });
  }

  private normalize(recs: DimensionRecommendation[]) {
    const total = recs.reduce((s, r) => s + r.recommendedPct, 0);
    if (total === 0 || recs.length === 0) return;

    if (Math.abs(total - 100) > 0.1) {
      const factor = 100 / total;
      recs.forEach(r => {
        r.recommendedPct = Math.round(r.recommendedPct * factor * 100) / 100;
        r.recommendedAmt = Math.round(r.recommendedAmt * factor * 100) / 100;
      });
    }

    const newTotal = recs.reduce((s, r) => s + r.recommendedPct, 0);
    if (Math.abs(newTotal - 100) > 0.01 && recs.length > 0) {
      const largest = recs.reduce((a, b) => (a.recommendedPct > b.recommendedPct ? a : b));
      largest.recommendedPct = Math.round((largest.recommendedPct + 100 - newTotal) * 100) / 100;
    }
  }
}
