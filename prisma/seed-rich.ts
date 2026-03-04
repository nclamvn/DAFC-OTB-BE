// ============================================================================
// DAFC OTB Planning — Rich Data Seed
// Populates tables with realistic luxury fashion retail data
// Run AFTER base seed: npx ts-node prisma/seed-rich.ts
// ============================================================================

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function d(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n);
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randDec(min: number, max: number, decimals = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function daysAgo(n: number): Date {
  const dt = new Date();
  dt.setDate(dt.getDate() - n);
  return dt;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('');
  console.log('==========================================================');
  console.log('  DAFC OTB — Rich Data Seeder');
  console.log('  Populating tables with luxury fashion retail data');
  console.log('==========================================================');
  console.log('');

  // ─── 0. READ EXISTING IDS ──────────────────────────────────────────────

  console.log('Reading existing records...');

  const storeREX = await prisma.store.findUniqueOrThrow({ where: { code: 'REX' } });
  const storeTTP = await prisma.store.findUniqueOrThrow({ where: { code: 'TTP' } });

  const brandFER = await prisma.brand.findUniqueOrThrow({ where: { code: 'FER' } });
  const brandBUR = await prisma.brand.findUniqueOrThrow({ where: { code: 'BUR' } });
  const brandGUC = await prisma.brand.findUniqueOrThrow({ where: { code: 'GUC' } });
  const brandPRA = await prisma.brand.findUniqueOrThrow({ where: { code: 'PRA' } });

  const groupLuxury = await prisma.groupBrand.findUniqueOrThrow({ where: { code: 'LUXURY' } });
  const groupPremium = await prisma.groupBrand.findUniqueOrThrow({ where: { code: 'PREMIUM' } });

  const stCarryOver = await prisma.seasonType.findFirstOrThrow({ where: { name: 'Carry Over' } });
  const stSeasonal = await prisma.seasonType.findFirstOrThrow({ where: { name: 'Seasonal' } });

  const sgSS = await prisma.seasonGroup.findUniqueOrThrow({ where: { name: 'SS' } });
  const sgFW = await prisma.seasonGroup.findUniqueOrThrow({ where: { name: 'FW' } });

  const seasonSS26 = await prisma.season.findUniqueOrThrow({ where: { name: 'SS26' } });
  const seasonFW26 = await prisma.season.findUniqueOrThrow({ where: { name: 'FW26' } });
  const seasonSS25 = await prisma.season.findUniqueOrThrow({ where: { name: 'SS25' } });
  const seasonFW25 = await prisma.season.findUniqueOrThrow({ where: { name: 'FW25' } });

  const genderF = await prisma.gender.findUniqueOrThrow({ where: { name: 'Female' } });
  const genderM = await prisma.gender.findUniqueOrThrow({ where: { name: 'Male' } });

  const subW_outerwear = await prisma.subCategory.findFirstOrThrow({ where: { id: 'w_outerwear' } });
  const subW_tops = await prisma.subCategory.findFirstOrThrow({ where: { id: 'w_tops' } });
  const subW_dresses = await prisma.subCategory.findFirstOrThrow({ where: { id: 'w_dresses' } });
  const subW_bags = await prisma.subCategory.findFirstOrThrow({ where: { id: 'w_bags' } });
  const subW_slg = await prisma.subCategory.findFirstOrThrow({ where: { id: 'w_slg' } });
  const subW_shoes = await prisma.subCategory.findFirstOrThrow({ where: { id: 'w_shoes' } });
  const subM_outerwear = await prisma.subCategory.findFirstOrThrow({ where: { id: 'm_outerwear' } });
  const subM_tops = await prisma.subCategory.findFirstOrThrow({ where: { id: 'm_tops' } });
  const subM_bags = await prisma.subCategory.findFirstOrThrow({ where: { id: 'm_bags' } });
  const subM_slg = await prisma.subCategory.findFirstOrThrow({ where: { id: 'm_slg' } });

  const userMerch = await prisma.user.findUniqueOrThrow({ where: { email: 'merch@dafc.com' } });
  const userBuyer = await prisma.user.findUniqueOrThrow({ where: { email: 'buyer@dafc.com' } });
  const userManager = await prisma.user.findUniqueOrThrow({ where: { email: 'manager@dafc.com' } });
  const userFinance = await prisma.user.findUniqueOrThrow({ where: { email: 'finance@dafc.com' } });

  console.log('  All existing records loaded\n');

  // ======================================================================
  // 1. ADDITIONAL PRODUCTS (~35 new)
  // ======================================================================

  console.log('Creating additional products...');

  const newProducts = [
    // Ferragamo Women's RTW
    { sku_code: 'FER-W-OW-001', product_name: 'GANCINI BELTED COAT', sub_category_id: 'w_outerwear', theme: 'SEPTEMBER (09)', color: 'CAMEL', composition: '80% WOOL 20% CASHMERE', srp: 89000000 },
    { sku_code: 'FER-W-OW-002', product_name: 'DOUBLE-BREASTED TRENCH', sub_category_id: 'w_outerwear', theme: 'OCTOBER (10)', color: 'HONEY', composition: '100% COTTON', srp: 75000000 },
    { sku_code: 'FER-W-OW-003', product_name: 'CAPE PONCHO CASHMERE', sub_category_id: 'w_outerwear', theme: 'NOVEMBER (11)', color: 'IVORY', composition: '80% WOOL 20% CASHMERE', srp: 95000000 },
    { sku_code: 'FER-W-TP-001', product_name: 'SILK BOW BLOUSE', sub_category_id: 'w_tops', theme: 'AUGUST (08)', color: 'DUSTY PINK', composition: '100% SILK', srp: 32000000 },
    { sku_code: 'FER-W-TP-002', product_name: 'GANCINI KNIT TOP', sub_category_id: 'w_tops', theme: 'SEPTEMBER (09)', color: 'BLACK', composition: '80% WOOL 20% CASHMERE', srp: 28500000 },
    { sku_code: 'FER-W-TP-003', product_name: 'PRINTED POPLIN SHIRT', sub_category_id: 'w_tops', theme: 'OCTOBER (10)', color: 'FOREST GREEN', composition: '100% COTTON', srp: 24000000 },
    { sku_code: 'FER-W-DR-001', product_name: 'WRAP DRESS CREPE', sub_category_id: 'w_dresses', theme: 'SEPTEMBER (09)', color: 'WINE RED', composition: '100% SILK', srp: 52000000 },
    { sku_code: 'FER-W-DR-002', product_name: 'MIDI DRESS PLISSE', sub_category_id: 'w_dresses', theme: 'OCTOBER (10)', color: 'EMERALD', composition: '100% POLYAMIDE', srp: 48000000 },
    { sku_code: 'FER-W-DR-003', product_name: 'COCKTAIL DRESS SATIN', sub_category_id: 'w_dresses', theme: 'NOVEMBER (11)', color: 'BURGUNDY', composition: '100% SILK', srp: 65000000 },
    // Ferragamo Women's Bags
    { sku_code: 'FER-W-BG-001', product_name: 'VARA BOW TOTE', sub_category_id: 'w_bags', theme: 'AUGUST (08)', color: 'BLACK', composition: '100% LEATHER', srp: 85000000 },
    { sku_code: 'FER-W-BG-002', product_name: 'TRIFOLIO CROSSBODY', sub_category_id: 'w_bags', theme: 'SEPTEMBER (09)', color: 'DUSTY PINK', composition: '100% LEATHER', srp: 62000000 },
    { sku_code: 'FER-W-BG-003', product_name: 'GANCINI CLUTCH', sub_category_id: 'w_bags', theme: 'OCTOBER (10)', color: 'WINE RED', composition: '100% LEATHER', srp: 45000000 },
    { sku_code: 'FER-W-BG-004', product_name: 'STUDIO TOP HANDLE', sub_category_id: 'w_bags', theme: 'NOVEMBER (11)', color: 'HONEY', composition: '100% LEATHER', srp: 98000000 },
    { sku_code: 'FER-W-BG-005', product_name: 'WANDA MINI BAG', sub_category_id: 'w_bags', theme: 'DECEMBER (12)', color: 'IVORY', composition: 'CANVAS/LEATHER', srp: 42000000 },
    // Ferragamo Women's SLG
    { sku_code: 'FER-W-SL-001', product_name: 'VARA BOW WALLET', sub_category_id: 'w_slg', theme: 'AUGUST (08)', color: 'BLACK', composition: '100% LEATHER', srp: 18000000 },
    { sku_code: 'FER-W-SL-002', product_name: 'GANCINI CARD HOLDER', sub_category_id: 'w_slg', theme: 'SEPTEMBER (09)', color: 'DUSTY PINK', composition: '100% LEATHER', srp: 12000000 },
    { sku_code: 'FER-W-SL-003', product_name: 'ZIP AROUND WALLET', sub_category_id: 'w_slg', theme: 'OCTOBER (10)', color: 'BURGUNDY', composition: '100% LEATHER', srp: 22000000 },
    // Ferragamo Women's Shoes
    { sku_code: 'FER-W-SH-001', product_name: 'VARA BOW PUMP', sub_category_id: 'w_shoes', theme: 'AUGUST (08)', color: 'BLACK', composition: '100% LEATHER', srp: 28000000 },
    { sku_code: 'FER-W-SH-002', product_name: 'VARINA BALLET FLAT', sub_category_id: 'w_shoes', theme: 'SEPTEMBER (09)', color: 'HONEY', composition: '100% LEATHER', srp: 25000000 },
    { sku_code: 'FER-W-SH-003', product_name: 'GANCINI SANDAL', sub_category_id: 'w_shoes', theme: 'OCTOBER (10)', color: 'TAN', composition: '100% LEATHER', srp: 32000000 },
    { sku_code: 'FER-W-SH-004', product_name: 'PLATFORM LOAFER', sub_category_id: 'w_shoes', theme: 'NOVEMBER (11)', color: 'WINE RED', composition: '100% LEATHER', srp: 38000000 },
    // Ferragamo Men's
    { sku_code: 'FER-M-OW-001', product_name: 'GANCINI BOMBER JACKET', sub_category_id: 'm_outerwear', theme: 'SEPTEMBER (09)', color: 'NAVY', composition: '100% NYLON', srp: 55000000 },
    { sku_code: 'FER-M-OW-002', product_name: 'WOOL OVERCOAT', sub_category_id: 'm_outerwear', theme: 'OCTOBER (10)', color: 'GREY', composition: '80% WOOL 20% CASHMERE', srp: 78000000 },
    { sku_code: 'FER-M-TP-001', product_name: 'GANCINI POLO', sub_category_id: 'm_tops', theme: 'AUGUST (08)', color: 'BLACK', composition: '100% COTTON', srp: 22000000 },
    { sku_code: 'FER-M-TP-002', product_name: 'SILK DRESS SHIRT', sub_category_id: 'm_tops', theme: 'SEPTEMBER (09)', color: 'IVORY', composition: '100% SILK', srp: 32000000 },
    { sku_code: 'FER-M-BG-001', product_name: 'REVIVAL BRIEFCASE', sub_category_id: 'm_bags', theme: 'OCTOBER (10)', color: 'BLACK', composition: '100% LEATHER', srp: 72000000 },
    { sku_code: 'FER-M-BG-002', product_name: 'GANCINI BACKPACK', sub_category_id: 'm_bags', theme: 'NOVEMBER (11)', color: 'NAVY', composition: '100% NYLON', srp: 48000000 },
    { sku_code: 'FER-M-SL-001', product_name: 'GANCINI BIFOLD WALLET', sub_category_id: 'm_slg', theme: 'AUGUST (08)', color: 'BLACK', composition: '100% LEATHER', srp: 15000000 },
    { sku_code: 'FER-M-SL-002', product_name: 'CARD CASE EMBOSSED', sub_category_id: 'm_slg', theme: 'SEPTEMBER (09)', color: 'TAN', composition: '100% LEATHER', srp: 10000000 },
    // Burberry Women's
    { sku_code: 'BUR-W-OW-001', product_name: 'CHECK QUILTED JACKET', sub_category_id: 'w_outerwear', theme: 'OCTOBER (10)', color: 'CAMEL', composition: '100% POLYAMIDE', srp: 68000000 },
    { sku_code: 'BUR-W-BG-001', product_name: 'POCKET BAG MEDIUM', sub_category_id: 'w_bags', theme: 'SEPTEMBER (09)', color: 'TAN', composition: '100% LEATHER', srp: 78000000 },
    { sku_code: 'BUR-W-BG-002', product_name: 'NOTE CROSSBODY', sub_category_id: 'w_bags', theme: 'OCTOBER (10)', color: 'BLACK', composition: 'CANVAS/LEATHER', srp: 52000000 },
    { sku_code: 'BUR-W-SL-001', product_name: 'CHECK CONTINENTAL WALLET', sub_category_id: 'w_slg', theme: 'AUGUST (08)', color: 'TAN', composition: 'CANVAS/LEATHER', srp: 19000000 },
    // Burberry Men's
    { sku_code: 'BUR-M-OW-001', product_name: 'QUILTED THERMOREGULATED JACKET', sub_category_id: 'm_outerwear', theme: 'NOVEMBER (11)', color: 'BLACK', composition: '100% POLYAMIDE', srp: 62000000 },
    { sku_code: 'BUR-M-TP-001', product_name: 'CHECK COTTON POLO', sub_category_id: 'm_tops', theme: 'AUGUST (08)', color: 'NAVY', composition: '100% COTTON', srp: 18000000 },
    { sku_code: 'BUR-M-BG-001', product_name: 'CHECK MESSENGER BAG', sub_category_id: 'm_bags', theme: 'OCTOBER (10)', color: 'TAN', composition: 'CANVAS/LEATHER', srp: 48000000 },
  ];

  for (const prod of newProducts) {
    await prisma.product.upsert({
      where: { sku_code: prod.sku_code },
      update: {},
      create: prod,
    });
  }
  console.log(`  ${newProducts.length} additional products created\n`);

  // Reload all products for later use
  const allProducts = await prisma.product.findMany();
  const productMap = new Map(allProducts.map(p => [p.sku_code, p]));

  // ======================================================================
  // 2. BUDGETS (6 budgets with AllocateHeaders + BudgetAllocates)
  // ======================================================================

  console.log('Creating budgets...');

  const budgetDefs = [
    { name: 'FER SS Pre 2026', brandCode: 'FER', totalAmount: 5_000_000_000, fiscalYear: 2026, status: 'APPROVED' },
    { name: 'FER SS Main 2026', brandCode: 'FER', totalAmount: 8_500_000_000, fiscalYear: 2026, status: 'APPROVED' },
    { name: 'BUR FW Pre 2026', brandCode: 'BUR', totalAmount: 6_200_000_000, fiscalYear: 2026, status: 'APPROVED' },
    { name: 'GUC SS Pre 2026', brandCode: 'GUC', totalAmount: 12_000_000_000, fiscalYear: 2026, status: 'SUBMITTED' },
    { name: 'PRA FW Main 2026', brandCode: 'PRA', totalAmount: 7_800_000_000, fiscalYear: 2026, status: 'SUBMITTED' },
    { name: 'FER FW Pre 2026', brandCode: 'FER', totalAmount: 4_500_000_000, fiscalYear: 2026, status: 'APPROVED' },
  ];

  const brandMap: Record<string, string> = {
    FER: brandFER.id,
    BUR: brandBUR.id,
    GUC: brandGUC.id,
    PRA: brandPRA.id,
  };

  const budgets: Record<string, any> = {};
  const allocateHeaders: Record<string, any> = {};
  const budgetAllocates: Record<string, { rex: any; ttp: any }> = {};

  for (const bd of budgetDefs) {
    const budget = await prisma.budget.create({
      data: {
        name: bd.name,
        amount: d(bd.totalAmount),
        fiscal_year: bd.fiscalYear,
        status: bd.status,
        created_by: userMerch.id,
      },
    });
    budgets[bd.name] = budget;

    // Create AllocateHeader (version 1)
    const header = await prisma.allocateHeader.create({
      data: {
        budget_id: budget.id,
        brand_id: brandMap[bd.brandCode],
        version: 1,
        created_by: userMerch.id,
      },
    });
    allocateHeaders[bd.name] = header;

    // BudgetAllocates: REX 60%, TTP 40% for SS26 season
    const seasonGroupId = bd.name.includes('SS') ? sgSS.id : sgFW.id;
    const seasonId = bd.name.includes('SS') ? seasonSS26.id : seasonFW26.id;

    const rexAllocate = await prisma.budgetAllocate.create({
      data: {
        allocate_header_id: header.id,
        store_id: storeREX.id,
        season_group_id: seasonGroupId,
        season_id: seasonId,
        budget_amount: d(Math.round(bd.totalAmount * 0.60)),
      },
    });
    const ttpAllocate = await prisma.budgetAllocate.create({
      data: {
        allocate_header_id: header.id,
        store_id: storeTTP.id,
        season_group_id: seasonGroupId,
        season_id: seasonId,
        budget_amount: d(Math.round(bd.totalAmount * 0.40)),
      },
    });
    budgetAllocates[bd.name] = { rex: rexAllocate, ttp: ttpAllocate };
  }

  console.log(`  ${budgetDefs.length} budgets with allocate headers and budget allocates created\n`);

  // ======================================================================
  // 3. PLANNING HEADERS with Collections, Genders, Categories
  // ======================================================================

  console.log('Creating planning headers...');

  const approvedBudgetNames = [
    'FER SS Pre 2026', 'FER SS Main 2026',
    'BUR FW Pre 2026', 'FER FW Pre 2026',
  ];

  const planningHeaders: Record<string, any> = {};
  let planVersion = 1;

  for (const budgetName of approvedBudgetNames) {
    const allocates = budgetAllocates[budgetName];

    for (const storeEntry of [
      { key: 'REX', store: storeREX, allocate: allocates.rex },
      { key: 'TTP', store: storeTTP, allocate: allocates.ttp },
    ]) {
      const planKey = `${budgetName}-${storeEntry.key}`;
      const budgetAmt = parseFloat(storeEntry.allocate.budget_amount.toString());

      const ph = await prisma.planningHeader.create({
        data: {
          version: planVersion++,
          created_by: userMerch.id,
        },
      });
      planningHeaders[planKey] = ph;

      // PlanningCollections
      const collDetails = [
        { seasonTypeId: stCarryOver.id, pct: 0.40 },
        { seasonTypeId: stSeasonal.id, pct: 0.60 },
      ];
      for (const cd of collDetails) {
        await prisma.planningCollection.create({
          data: {
            season_type_id: cd.seasonTypeId,
            store_id: storeEntry.store.id,
            planning_header_id: ph.id,
            actual_buy_pct: d(cd.pct * 100),
            actual_sales_pct: d(cd.pct * 100 * 0.92),
            actual_st_pct: d(randDec(68, 88)),
            actual_moc: d(randDec(45, 62)),
            proposed_buy_pct: d(cd.pct * 100),
            otb_proposed_amount: d(Math.round(budgetAmt * cd.pct)),
            pct_var_vs_last: d(randDec(-5, 8)),
          },
        });
      }

      // PlanningGenders
      const genderDetails = [
        { genderId: genderF.id, pct: 0.60 },
        { genderId: genderM.id, pct: 0.40 },
      ];
      for (const gd of genderDetails) {
        await prisma.planningGender.create({
          data: {
            gender_id: gd.genderId,
            store_id: storeEntry.store.id,
            planning_header_id: ph.id,
            actual_buy_pct: d(gd.pct * 100),
            actual_sales_pct: d(gd.pct * 100 * 0.88),
            actual_st_pct: d(randDec(65, 85)),
            proposed_buy_pct: d(gd.pct * 100),
            otb_proposed_amount: d(Math.round(budgetAmt * gd.pct)),
            pct_var_vs_last: d(randDec(-3, 6)),
          },
        });
      }

      // PlanningCategories
      const catDetails = [
        { subcategoryId: subW_outerwear.id, pct: 0.10 },
        { subcategoryId: subW_tops.id, pct: 0.08 },
        { subcategoryId: subW_dresses.id, pct: 0.07 },
        { subcategoryId: subW_bags.id, pct: 0.12 },
        { subcategoryId: subW_slg.id, pct: 0.08 },
        { subcategoryId: subW_shoes.id, pct: 0.05 },
        { subcategoryId: subM_outerwear.id, pct: 0.09 },
        { subcategoryId: subM_tops.id, pct: 0.07 },
        { subcategoryId: subM_bags.id, pct: 0.10 },
        { subcategoryId: subM_slg.id, pct: 0.05 },
      ];
      // remaining 19% for other subcategories not explicitly listed
      for (const cat of catDetails) {
        const otbAmt = Math.round(budgetAmt * cat.pct);
        await prisma.planningCategory.create({
          data: {
            subcategory_id: cat.subcategoryId,
            planning_header_id: ph.id,
            actual_buy_pct: d(cat.pct * 100),
            actual_sales_pct: d(cat.pct * 100 * randDec(0.85, 0.95)),
            actual_st_pct: d(randDec(60, 88)),
            proposed_buy_pct: d(cat.pct * 100),
            otb_proposed_amount: d(otbAmt),
            var_lastyear_pct: d(randDec(-8, 12)),
            otb_actual_amount: d(Math.round(otbAmt * randDec(0.85, 1.05))),
            otb_actual_buy_pct: d(cat.pct * 100 * randDec(0.90, 1.08)),
          },
        });
      }
    }
  }

  const phCount = Object.keys(planningHeaders).length;
  console.log(`  ${phCount} planning headers with collections, genders, categories created\n`);

  // ======================================================================
  // 4. SKU PROPOSAL HEADERS WITH SKU PROPOSALS + ALLOCATES
  // ======================================================================

  console.log('Creating SKU proposal headers...');

  // Helper to look up a product and build SKUProposal data
  function buildProposal(skuCode: string, customerTarget: string, unitCostPct: number) {
    const product = productMap.get(skuCode);
    if (!product) throw new Error(`Product not found: ${skuCode}`);
    const srp = parseFloat(product.srp.toString());
    const unitCost = Math.round(srp * unitCostPct);
    return { productId: product.id, customerTarget, unitCost, srp };
  }

  // ── Proposal 1: FER SS Pre 2026 - REX Womenswear ──
  const header1 = await prisma.sKUProposalHeader.create({
    data: { version: 1, created_by: userBuyer.id },
  });

  const p1Items = [
    buildProposal('FER-W-OW-002', 'VIP', 0.45),
    buildProposal('FER-W-TP-001', 'New', 0.42),
    buildProposal('FER-W-TP-003', 'Existing', 0.43),
    buildProposal('FER-W-DR-001', 'VIP', 0.44),
    buildProposal('FER-W-BG-001', 'VIP', 0.47),
    buildProposal('FER-W-BG-002', 'Existing', 0.45),
    buildProposal('FER-W-BG-005', 'New', 0.42),
    buildProposal('FER-W-SL-001', 'New', 0.40),
    buildProposal('FER-W-SL-002', 'Existing', 0.40),
    buildProposal('FER-W-SH-001', 'VIP', 0.43),
    buildProposal('FER-W-SH-002', 'Existing', 0.44),
    buildProposal('8116500', 'VIP', 0.46),
  ];

  for (const item of p1Items) {
    const skuProposal = await prisma.sKUProposal.create({
      data: {
        sku_proposal_header_id: header1.id,
        product_id: item.productId,
        customer_target: item.customerTarget,
        unit_cost: d(item.unitCost),
        srp: d(item.srp),
      },
    });
    // Allocations: REX ~60%, TTP ~40%
    const totalQty = rand(5, 15);
    const rexQty = Math.ceil(totalQty * 0.6);
    const ttpQty = totalQty - rexQty;
    await prisma.sKUAllocate.createMany({
      data: [
        { sku_proposal_id: skuProposal.id, store_id: storeREX.id, quantity: d(rexQty) },
        { sku_proposal_id: skuProposal.id, store_id: storeTTP.id, quantity: d(ttpQty) },
      ],
    });
  }

  // ── Proposal 2: FER SS Pre 2026 - TTP Full Range ──
  const header2 = await prisma.sKUProposalHeader.create({
    data: { version: 1, created_by: userBuyer.id },
  });

  const p2Items = [
    buildProposal('FER-W-OW-002', 'Existing', 0.45),
    buildProposal('FER-W-TP-001', 'New', 0.42),
    buildProposal('FER-W-BG-001', 'VIP', 0.47),
    buildProposal('FER-W-SL-001', 'New', 0.40),
    buildProposal('FER-W-SH-001', 'Existing', 0.43),
    buildProposal('FER-M-TP-001', 'New', 0.42),
    buildProposal('FER-M-BG-001', 'VIP', 0.46),
    buildProposal('FER-M-SL-001', 'Existing', 0.40),
    buildProposal('FER-M-SL-002', 'New', 0.40),
    buildProposal('FER-W-DR-001', 'VIP', 0.44),
  ];

  for (const item of p2Items) {
    const skuProposal = await prisma.sKUProposal.create({
      data: {
        sku_proposal_header_id: header2.id,
        product_id: item.productId,
        customer_target: item.customerTarget,
        unit_cost: d(item.unitCost),
        srp: d(item.srp),
      },
    });
    const totalQty = rand(4, 12);
    const rexQty = Math.ceil(totalQty * 0.55);
    const ttpQty = totalQty - rexQty;
    await prisma.sKUAllocate.createMany({
      data: [
        { sku_proposal_id: skuProposal.id, store_id: storeREX.id, quantity: d(rexQty) },
        { sku_proposal_id: skuProposal.id, store_id: storeTTP.id, quantity: d(ttpQty) },
      ],
    });
  }

  // ── Proposal 3: BUR FW Pre 2026 - REX Collection ──
  const header3 = await prisma.sKUProposalHeader.create({
    data: { version: 1, created_by: userBuyer.id },
  });

  const p3Items = [
    buildProposal('BUR-W-OW-001', 'VIP', 0.45),
    buildProposal('8116500', 'VIP', 0.46),
    buildProposal('8116501', 'VIP', 0.48),
    buildProposal('BUR-W-BG-001', 'Existing', 0.46),
    buildProposal('BUR-W-BG-002', 'New', 0.44),
    buildProposal('BUR-W-SL-001', 'New', 0.40),
    buildProposal('BUR-M-OW-001', 'Existing', 0.46),
    buildProposal('BUR-M-BG-001', 'New', 0.44),
  ];

  for (const item of p3Items) {
    const skuProposal = await prisma.sKUProposal.create({
      data: {
        sku_proposal_header_id: header3.id,
        product_id: item.productId,
        customer_target: item.customerTarget,
        unit_cost: d(item.unitCost),
        srp: d(item.srp),
      },
    });
    const totalQty = rand(3, 10);
    const rexQty = Math.ceil(totalQty * 0.65);
    const ttpQty = totalQty - rexQty;
    await prisma.sKUAllocate.createMany({
      data: [
        { sku_proposal_id: skuProposal.id, store_id: storeREX.id, quantity: d(rexQty) },
        { sku_proposal_id: skuProposal.id, store_id: storeTTP.id, quantity: d(ttpQty) },
      ],
    });
  }

  // ── Proposal 4: FER SS Main 2026 - REX Premium (Draft) ──
  const header4 = await prisma.sKUProposalHeader.create({
    data: { version: 1, created_by: userBuyer.id },
  });

  const p4Items = [
    buildProposal('FER-W-OW-001', 'VIP', 0.46),
    buildProposal('FER-W-OW-002', 'VIP', 0.45),
    buildProposal('FER-W-OW-003', 'VIP', 0.47),
    buildProposal('FER-W-TP-001', 'New', 0.42),
    buildProposal('FER-W-TP-002', 'Existing', 0.43),
    buildProposal('FER-W-DR-001', 'VIP', 0.44),
    buildProposal('FER-W-DR-002', 'Existing', 0.44),
    buildProposal('FER-W-DR-003', 'VIP', 0.45),
    buildProposal('FER-W-BG-001', 'VIP', 0.47),
    buildProposal('FER-W-BG-004', 'VIP', 0.48),
    buildProposal('FER-W-SL-003', 'Existing', 0.40),
    buildProposal('FER-M-OW-001', 'Existing', 0.45),
    buildProposal('FER-M-OW-002', 'VIP', 0.47),
    buildProposal('FER-M-BG-001', 'VIP', 0.46),
    buildProposal('FER-M-BG-002', 'New', 0.44),
  ];

  for (const item of p4Items) {
    const skuProposal = await prisma.sKUProposal.create({
      data: {
        sku_proposal_header_id: header4.id,
        product_id: item.productId,
        customer_target: item.customerTarget,
        unit_cost: d(item.unitCost),
        srp: d(item.srp),
      },
    });
    const totalQty = rand(4, 12);
    const rexQty = Math.ceil(totalQty * 0.6);
    const ttpQty = totalQty - rexQty;
    await prisma.sKUAllocate.createMany({
      data: [
        { sku_proposal_id: skuProposal.id, store_id: storeREX.id, quantity: d(rexQty) },
        { sku_proposal_id: skuProposal.id, store_id: storeTTP.id, quantity: d(ttpQty) },
      ],
    });
  }

  console.log(`  4 SKU proposal headers created:`);
  console.log(`     H1: ${p1Items.length} products (FER SS Pre REX)`);
  console.log(`     H2: ${p2Items.length} products (FER SS Pre TTP)`);
  console.log(`     H3: ${p3Items.length} products (BUR FW Pre REX)`);
  console.log(`     H4: ${p4Items.length} products (FER SS Main REX)\n`);

  // ======================================================================
  // 5. APPROVAL WORKFLOWS + LEVELS
  // ======================================================================

  console.log('Creating approval workflows...');

  // Workflow for Luxury brands
  const luxuryWorkflow = await prisma.approvalWorkflow.create({
    data: {
      group_brand_id: groupLuxury.id,
      workflow_name: 'Luxury Standard Approval',
    },
  });

  const luxuryLevel1 = await prisma.approvalWorkflowLevel.create({
    data: {
      approval_workflow_id: luxuryWorkflow.id,
      level_order: 1,
      level_name: 'Manager Approval',
      approver_user_id: userManager.id,
      is_required: true,
    },
  });

  const luxuryLevel2 = await prisma.approvalWorkflowLevel.create({
    data: {
      approval_workflow_id: luxuryWorkflow.id,
      level_order: 2,
      level_name: 'Finance Director Approval',
      approver_user_id: userFinance.id,
      is_required: true,
    },
  });

  // Workflow for Premium brands
  const premiumWorkflow = await prisma.approvalWorkflow.create({
    data: {
      group_brand_id: groupPremium.id,
      workflow_name: 'Premium Standard Approval',
    },
  });

  const premiumLevel1 = await prisma.approvalWorkflowLevel.create({
    data: {
      approval_workflow_id: premiumWorkflow.id,
      level_order: 1,
      level_name: 'Manager Approval',
      approver_user_id: userManager.id,
      is_required: true,
    },
  });

  const premiumLevel2 = await prisma.approvalWorkflowLevel.create({
    data: {
      approval_workflow_id: premiumWorkflow.id,
      level_order: 2,
      level_name: 'Finance Director Approval',
      approver_user_id: userFinance.id,
      is_required: true,
    },
  });

  console.log('  2 approval workflows with levels created\n');

  // ======================================================================
  // 6. TICKETS + APPROVAL LOGS
  // ======================================================================

  console.log('Creating tickets and approval logs...');

  // Ticket for FER SS Pre REX (Approved)
  const ticket1 = await prisma.ticket.create({
    data: {
      budget_allocate_id: budgetAllocates['FER SS Pre 2026'].rex.id,
      status: 'APPROVED',
      created_by: userMerch.id,
    },
  });
  await prisma.ticketApprovalLog.create({
    data: {
      ticket_id: ticket1.id,
      approval_workflow_level_id: luxuryLevel1.id,
      approver_user_id: userManager.id,
      is_approved: true,
      comment: 'Budget allocation looks appropriate for the season.',
      approved_at: daysAgo(14),
    },
  });
  await prisma.ticketApprovalLog.create({
    data: {
      ticket_id: ticket1.id,
      approval_workflow_level_id: luxuryLevel2.id,
      approver_user_id: userFinance.id,
      is_approved: true,
      comment: 'Approved — within financial guidelines.',
      approved_at: daysAgo(10),
    },
  });

  // Ticket for FER SS Pre TTP (Approved)
  const ticket2 = await prisma.ticket.create({
    data: {
      budget_allocate_id: budgetAllocates['FER SS Pre 2026'].ttp.id,
      status: 'APPROVED',
      created_by: userMerch.id,
    },
  });
  await prisma.ticketApprovalLog.create({
    data: {
      ticket_id: ticket2.id,
      approval_workflow_level_id: luxuryLevel1.id,
      approver_user_id: userManager.id,
      is_approved: true,
      comment: 'TTP allocation approved.',
      approved_at: daysAgo(13),
    },
  });
  await prisma.ticketApprovalLog.create({
    data: {
      ticket_id: ticket2.id,
      approval_workflow_level_id: luxuryLevel2.id,
      approver_user_id: userFinance.id,
      is_approved: true,
      comment: 'Approved.',
      approved_at: daysAgo(9),
    },
  });

  // Ticket for BUR FW Pre REX (Pending L2)
  const ticket3 = await prisma.ticket.create({
    data: {
      budget_allocate_id: budgetAllocates['BUR FW Pre 2026'].rex.id,
      status: 'IN_REVIEW',
      created_by: userMerch.id,
    },
  });
  await prisma.ticketApprovalLog.create({
    data: {
      ticket_id: ticket3.id,
      approval_workflow_level_id: luxuryLevel1.id,
      approver_user_id: userManager.id,
      is_approved: true,
      comment: 'Burberry FW collection looks strong. Approved at L1.',
      approved_at: daysAgo(2),
    },
  });

  // Ticket for FER SS Main REX (Pending)
  const ticket4 = await prisma.ticket.create({
    data: {
      budget_allocate_id: budgetAllocates['FER SS Main 2026'].rex.id,
      status: 'PENDING',
      created_by: userMerch.id,
    },
  });

  // Ticket for FER FW Pre REX (Approved)
  const ticket5 = await prisma.ticket.create({
    data: {
      budget_allocate_id: budgetAllocates['FER FW Pre 2026'].rex.id,
      status: 'APPROVED',
      created_by: userMerch.id,
    },
  });
  await prisma.ticketApprovalLog.create({
    data: {
      ticket_id: ticket5.id,
      approval_workflow_level_id: luxuryLevel1.id,
      approver_user_id: userManager.id,
      is_approved: true,
      comment: 'FW Pre allocation approved.',
      approved_at: daysAgo(8),
    },
  });
  await prisma.ticketApprovalLog.create({
    data: {
      ticket_id: ticket5.id,
      approval_workflow_level_id: luxuryLevel2.id,
      approver_user_id: userFinance.id,
      is_approved: true,
      comment: 'Within budget. Approved.',
      approved_at: daysAgo(5),
    },
  });

  console.log('  5 tickets with approval logs created\n');

  // ======================================================================
  // SUMMARY
  // ======================================================================

  console.log('==========================================================');
  console.log('  SEED COMPLETE — Summary');
  console.log('==========================================================');
  console.log(`  Products:               ${allProducts.length} total (${newProducts.length} new)`);
  console.log(`  Budgets:                ${budgetDefs.length} (with allocate headers + allocates)`);
  console.log(`  Planning Headers:       ${phCount} (with collections, genders, categories)`);
  console.log(`  SKU Proposal Headers:   4 (with ${p1Items.length + p2Items.length + p3Items.length + p4Items.length} SKU proposals)`);
  console.log(`  Approval Workflows:     2 (with 4 levels)`);
  console.log(`  Tickets:                5 (with approval logs)`);
  console.log('==========================================================');
  console.log('');
}

main()
  .catch((e) => {
    console.error('Rich seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
