import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiErrorResponses, ApiSuccessResponse } from '../../common/decorators/api-response.decorator';
import { AiService } from './ai.service';
import { BudgetAlertsService } from './budget-alerts.service';
import { OtbAllocationService } from './otb-allocation.service';
import { RiskScoringService } from './risk-scoring.service';
import { SkuRecommenderService } from './sku-recommender.service';
import {
  CalculateSizeCurveDto,
  CompareSizeCurveDto,
  GetAlertsQueryDto,
  GenerateAllocationDto,
  CompareAllocationDto,
  GenerateSkuRecommendationsDto,
  AddRecommendationsToProposalDto,
} from './dto/ai.dto';

@ApiTags('AI')
@ApiBearerAuth()
@ApiErrorResponses()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly budgetAlertsService: BudgetAlertsService,
    private readonly otbAllocationService: OtbAllocationService,
    private readonly riskScoringService: RiskScoringService,
    private readonly skuRecommenderService: SkuRecommenderService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════
  // SIZE CURVE OPTIMIZER
  // ═══════════════════════════════════════════════════════════════════════

  @Post('size-curve/calculate')
  @ApiOperation({ summary: 'Calculate recommended size curve for a subcategory' })
  @ApiSuccessResponse()
  @ApiBody({ type: CalculateSizeCurveDto })
  async calculateSizeCurve(@Body() dto: CalculateSizeCurveDto) {
    return this.aiService.calculateSizeCurve(
      dto.subCategoryId,
      dto.storeId,
      dto.totalOrderQty,
    );
  }

  @Post('size-curve/compare')
  @ApiOperation({ summary: 'Compare user sizing vs AI recommendation' })
  @ApiSuccessResponse()
  @ApiBody({ type: CompareSizeCurveDto })
  async compareSizeCurve(@Body() dto: CompareSizeCurveDto) {
    return this.aiService.compareSizeCurve(
      dto.subCategoryId,
      dto.storeId,
      dto.userSizing,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // BUDGET ALERTS
  // ═══════════════════════════════════════════════════════════════════════

  @Get('alerts')
  @ApiOperation({ summary: 'Get budget alerts' })
  @ApiSuccessResponse()
  async getAlerts(@Query() query: GetAlertsQueryDto) {
    return this.budgetAlertsService.getAlerts({
      budgetId: query.budgetId,
      unreadOnly: query.unreadOnly === 'true',
    });
  }

  @Post('alerts/check')
  @ApiOperation({ summary: 'Manually trigger budget alert check' })
  @ApiSuccessResponse()
  async triggerAlertCheck() {
    const data = await this.budgetAlertsService.checkAllBudgets();
    return { data, message: 'Budget alert check completed' };
  }

  @Patch('alerts/:id/read')
  @ApiOperation({ summary: 'Mark alert as read' })
  @ApiSuccessResponse()
  async markAlertRead(@Param('id') id: string) {
    return this.budgetAlertsService.markAsRead(id);
  }

  @Patch('alerts/:id/dismiss')
  @ApiOperation({ summary: 'Dismiss an alert' })
  @ApiSuccessResponse()
  async dismissAlert(@Param('id') id: string) {
    return this.budgetAlertsService.dismissAlert(id);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // OTB ALLOCATION
  // ═══════════════════════════════════════════════════════════════════════

  @Post('allocation/generate')
  @ApiOperation({ summary: 'Generate OTB allocation recommendations' })
  @ApiSuccessResponse()
  @ApiBody({ type: GenerateAllocationDto })
  async generateAllocation(@Body() dto: GenerateAllocationDto) {
    return this.otbAllocationService.generateAllocation(dto);
  }

  @Post('allocation/compare')
  @ApiOperation({ summary: 'Compare user allocation vs AI recommendation' })
  @ApiSuccessResponse()
  @ApiBody({ type: CompareAllocationDto })
  async compareAllocation(@Body() dto: CompareAllocationDto) {
    return this.otbAllocationService.compareAllocation(
      dto.userAllocation,
      dto.budgetAmount,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RISK SCORING
  // ═══════════════════════════════════════════════════════════════════════

  @Post('risk/assess/:headerId')
  @ApiOperation({ summary: 'Calculate risk score for a SKU Proposal Header' })
  @ApiSuccessResponse()
  async assessRisk(@Param('headerId') headerId: string) {
    return this.riskScoringService.assessProposal(headerId);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SKU RECOMMENDER
  // ═══════════════════════════════════════════════════════════════════════

  @Post('sku-recommend/generate')
  @ApiOperation({ summary: 'Generate SKU recommendations for a subcategory' })
  @ApiSuccessResponse()
  @ApiBody({ type: GenerateSkuRecommendationsDto })
  async generateSkuRecommendations(@Body() dto: GenerateSkuRecommendationsDto) {
    return this.skuRecommenderService.generateRecommendations(dto);
  }

  @Post('sku-recommend/add-to-proposal')
  @ApiOperation({ summary: 'Add recommended products to a SKU Proposal Header' })
  @ApiSuccessResponse()
  @ApiBody({ type: AddRecommendationsToProposalDto })
  async addToProposal(@Body() dto: AddRecommendationsToProposalDto) {
    const count = await this.skuRecommenderService.addSelectedToProposal(dto.productIds, dto.headerId);
    return { data: { addedCount: count }, message: `${count} products added to proposal` };
  }
}
