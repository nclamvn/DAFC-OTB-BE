// ============================================================================
// Database Seed — Base data for DAFC OTB Planning System
// Run: npx prisma db seed   or   npm run prisma:seed
// ============================================================================

import { PrismaClient } from '../src/generated/prisma';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ─── HELPERS ──────────────────────────────────────────────────────────────────
async function findOrCreate<T>(
  findFn: () => Promise<T | null>,
  createFn: () => Promise<T>,
): Promise<T> {
  const existing = await findFn();
  if (existing) return existing;
  return createFn();
}

async function findOrCreateCategory(name: string, gender_id: bigint) {
  const existing = await prisma.category.findFirst({ where: { name, gender_id } });
  if (existing) return existing;
  return prisma.category.create({ data: { name, gender_id } });
}

async function findOrCreateSubCategory(name: string, category_id: bigint) {
  const existing = await prisma.subCategory.findFirst({ where: { name, category_id } });
  if (existing) return existing;
  return prisma.subCategory.create({ data: { name, category_id } });
}

async function findOrCreateSubcategorySize(name: string, sub_category_id: bigint) {
  const existing = await prisma.subcategorySize.findFirst({ where: { name, sub_category_id } });
  if (existing) return existing;
  return prisma.subcategorySize.create({ data: { name, sub_category_id } });
}

async function main() {
  console.log('Seeding database...');

  // ─── ROLES ────────────────────────────────────────────────────────────
  const roleDefs = [
    {
      name: 'admin',
      description: 'System Administrator',
      permissions: JSON.stringify(['*']),
    },
    {
      name: 'buyer',
      description: 'Buyer — creates proposals, manages SKU selection',
      permissions: JSON.stringify([
        'budget:read', 'planning:read',
        'proposal:read', 'proposal:write', 'proposal:submit', 'master:read',
      ]),
    },
    {
      name: 'merchandiser',
      description: 'Merchandiser — creates budgets and planning',
      permissions: JSON.stringify([
        'budget:read', 'budget:write', 'budget:submit',
        'planning:read', 'planning:write', 'planning:submit',
        'proposal:read', 'master:read',
      ]),
    },
    {
      name: 'merch_manager',
      description: 'Merchandising Manager — Level 1 Approver',
      permissions: JSON.stringify([
        'budget:read', 'budget:write', 'budget:submit', 'budget:approve_l1',
        'planning:read', 'planning:write', 'planning:approve_l1',
        'proposal:read', 'proposal:approve_l1', 'master:read',
      ]),
    },
    {
      name: 'finance_director',
      description: 'Finance Director — Level 2 Approver',
      permissions: JSON.stringify([
        'budget:read', 'budget:approve_l2',
        'planning:read', 'planning:approve_l2',
        'proposal:read', 'proposal:approve_l2', 'master:read',
      ]),
    },
  ];

  const roles = await Promise.all(
    roleDefs.map(def =>
      findOrCreate(
        () => prisma.role.findFirst({ where: { name: def.name } }),
        () => prisma.role.create({ data: def }),
      ),
    ),
  );

  const [adminRole, buyerRole, merchRole, merchMgrRole, finDirRole] = roles;
  console.log(`  ${roles.length} roles created`);

  // ─── GROUP BRANDS ─────────────────────────────────────────────────────
  const groupBrands = await Promise.all([
    findOrCreate(
      () => prisma.groupBrand.findFirst({ where: { code: 'LUXURY' } }),
      () => prisma.groupBrand.create({ data: { code: 'LUXURY', name: 'Luxury Brands' } }),
    ),
    findOrCreate(
      () => prisma.groupBrand.findFirst({ where: { code: 'PREMIUM' } }),
      () => prisma.groupBrand.create({ data: { code: 'PREMIUM', name: 'Premium Brands' } }),
    ),
  ]);
  const [luxuryGroup, premiumGroup] = groupBrands;
  console.log(`  ${groupBrands.length} group brands created`);

  // ─── BRANDS ───────────────────────────────────────────────────────────
  const brands = await Promise.all([
    findOrCreate(
      () => prisma.brand.findFirst({ where: { code: 'FER' } }),
      () => prisma.brand.create({ data: { code: 'FER', name: 'Ferragamo', group_brand_id: luxuryGroup.id } }),
    ),
    findOrCreate(
      () => prisma.brand.findFirst({ where: { code: 'BUR' } }),
      () => prisma.brand.create({ data: { code: 'BUR', name: 'Burberry', group_brand_id: luxuryGroup.id } }),
    ),
    findOrCreate(
      () => prisma.brand.findFirst({ where: { code: 'GUC' } }),
      () => prisma.brand.create({ data: { code: 'GUC', name: 'Gucci', group_brand_id: premiumGroup.id } }),
    ),
    findOrCreate(
      () => prisma.brand.findFirst({ where: { code: 'PRA' } }),
      () => prisma.brand.create({ data: { code: 'PRA', name: 'Prada', group_brand_id: premiumGroup.id } }),
    ),
  ]);
  const [brandFER, brandBUR, brandGUC, brandPRA] = brands;
  console.log(`  ${brands.length} brands created`);

  // ─── STORES ───────────────────────────────────────────────────────────
  const stores = await Promise.all([
    findOrCreate(
      () => prisma.store.findFirst({ where: { code: 'REX' } }),
      () => prisma.store.create({ data: { code: 'REX', name: 'REX', region: 'HCMC' } }),
    ),
    findOrCreate(
      () => prisma.store.findFirst({ where: { code: 'TTP' } }),
      () => prisma.store.create({ data: { code: 'TTP', name: 'TTP', region: 'HCMC' } }),
    ),
  ]);
  const [storeREX, storeTTP] = stores;
  console.log(`  ${stores.length} stores created`);

  // ─── SEASON TYPES ────────────────────────────────────────────────────
  const seasonTypes = await Promise.all([
    findOrCreate(
      () => prisma.seasonType.findFirst({ where: { name: 'Carry Over' } }),
      () => prisma.seasonType.create({ data: { name: 'Carry Over' } }),
    ),
    findOrCreate(
      () => prisma.seasonType.findFirst({ where: { name: 'Seasonal' } }),
      () => prisma.seasonType.create({ data: { name: 'Seasonal' } }),
    ),
  ]);
  console.log(`  ${seasonTypes.length} season types created`);

  // ─── SEASON GROUPS ────────────────────────────────────────────────────
  const seasonGroups = await Promise.all([
    findOrCreate(
      () => prisma.seasonGroup.findFirst({ where: { name: 'SS' } }),
      () => prisma.seasonGroup.create({ data: { name: 'SS' } }),
    ),
    findOrCreate(
      () => prisma.seasonGroup.findFirst({ where: { name: 'FW' } }),
      () => prisma.seasonGroup.create({ data: { name: 'FW' } }),
    ),
  ]);
  const [sgSS, sgFW] = seasonGroups;
  console.log(`  ${seasonGroups.length} season groups created`);

  // ─── SEASONS ──────────────────────────────────────────────────────────
  const seasonDefs = [
    { name: 'SS24', season_group_id: sgSS.id },
    { name: 'FW24', season_group_id: sgFW.id },
    { name: 'SS25', season_group_id: sgSS.id },
    { name: 'FW25', season_group_id: sgFW.id },
    { name: 'SS26', season_group_id: sgSS.id },
    { name: 'FW26', season_group_id: sgFW.id },
  ];

  const seasons = await Promise.all(
    seasonDefs.map(def =>
      findOrCreate(
        () => prisma.season.findFirst({ where: { name: def.name, season_group_id: def.season_group_id } }),
        () => prisma.season.create({ data: def }),
      ),
    ),
  );
  console.log(`  ${seasons.length} seasons created`);

  // ─── GENDERS ──────────────────────────────────────────────────────────
  const genders = await Promise.all([
    findOrCreate(
      () => prisma.gender.findFirst({ where: { name: 'Female' } }),
      () => prisma.gender.create({ data: { name: 'Female' } }),
    ),
    findOrCreate(
      () => prisma.gender.findFirst({ where: { name: 'Male' } }),
      () => prisma.gender.create({ data: { name: 'Male' } }),
    ),
  ]);
  const [female, male] = genders;
  console.log(`  ${genders.length} genders created`);

  // ─── CATEGORIES + SUB-CATEGORIES ──────────────────────────────────────
  const womenRtw      = await findOrCreateCategory("WOMEN'S RTW",           female.id);
  const womenHardAcc  = await findOrCreateCategory('WOMEN HARD ACCESSORIES', female.id);
  const womenOthers   = await findOrCreateCategory('OTHERS',                 female.id);
  const menRtw        = await findOrCreateCategory("MEN'S RTW",              male.id);
  const menAcc        = await findOrCreateCategory('MEN ACCESSORIES',        male.id);

  const subCategories = await Promise.all([
    // Women RTW
    findOrCreateSubCategory('W Outerwear', womenRtw.id),
    findOrCreateSubCategory('W Tailoring', womenRtw.id),
    findOrCreateSubCategory('W Dresses',   womenRtw.id),
    findOrCreateSubCategory('W Tops',      womenRtw.id),
    findOrCreateSubCategory('W Body',      womenRtw.id),
    findOrCreateSubCategory('W Bottoms',   womenRtw.id),
    // Women Hard Accessories
    findOrCreateSubCategory('W Bags', womenHardAcc.id),
    findOrCreateSubCategory('W SLG',  womenHardAcc.id),
    // Women Others
    findOrCreateSubCategory("Women's Shoes", womenOthers.id),
    // Men RTW
    findOrCreateSubCategory('M Outerwear', menRtw.id),
    findOrCreateSubCategory('M Tops',      menRtw.id),
    findOrCreateSubCategory('M Bottoms',   menRtw.id),
    // Men Accessories
    findOrCreateSubCategory('M Bags', menAcc.id),
    findOrCreateSubCategory('M SLG',  menAcc.id),
  ]);
  console.log(`  5 categories + ${subCategories.length} sub-categories created`);

  // ─── SUBCATEGORY SIZES ────────────────────────────────────────────────
  const sizeNames = ['XS', 'S', 'M', 'L', 'XL'];
  const bagSizes  = ['S', 'M', 'L'];

  for (const sub of subCategories) {
    const isBagOrSlg = sub.name.includes('Bags') || sub.name.includes('SLG');
    const sizes = isBagOrSlg ? bagSizes : sizeNames;
    for (const sizeName of sizes) {
      await findOrCreateSubcategorySize(sizeName, sub.id);
    }
  }
  console.log('  Subcategory sizes created');

  // ─── APPROVAL STATUSES ────────────────────────────────────────────────
  const statuses = ['PENDING', 'APPROVED', 'REJECTED', 'IN_REVIEW'];
  for (const s of statuses) {
    await findOrCreate(
      () => prisma.approvalStatus.findFirst({ where: { name: s } }),
      () => prisma.approvalStatus.create({ data: { name: s } }),
    );
  }
  console.log(`  ${statuses.length} approval statuses created`);

  // ─── PRODUCTS ─────────────────────────────────────────────────────────
  const subCatMap = Object.fromEntries(subCategories.map(s => [s.name, s.id]));

  const productDefs = [
    { sku_code: '8116333', product_name: 'FITZROVIA DK SHT',  sub_category_id: subCatMap['W Outerwear'], theme: 'AUGUST (08)',     color: 'WINE RED',         composition: '100% COTTON',           srp: 87900000 },
    { sku_code: '8113543', product_name: 'FLORISTON S',        sub_category_id: subCatMap['W Outerwear'], theme: 'AUGUST (08)',     color: 'MAHOGANY',         composition: '100% POLYAMIDE (NYLON)', srp: 65900000 },
    { sku_code: '8115960', product_name: 'OLDHAM CHK',         sub_category_id: subCatMap['W Outerwear'], theme: 'AUGUST (08)',     color: 'POPPY IP CHECK',   composition: '100% COTTON',           srp: 71900000 },
    { sku_code: '8116500', product_name: 'KENSINGTON TRENCH',  sub_category_id: subCatMap['W Outerwear'], theme: 'SEPTEMBER (09)', color: 'HONEY',            composition: '100% COTTON',           srp: 95000000 },
    { sku_code: '8116501', product_name: 'CHELSEA COAT',       sub_category_id: subCatMap['W Outerwear'], theme: 'SEPTEMBER (09)', color: 'BLACK',            composition: '80% WOOL 20% CASHMERE', srp: 120000000 },
    { sku_code: '8114202', product_name: 'GILLIAN WCHK',       sub_category_id: subCatMap['W Tops'],      theme: 'SEPTEMBER (09)', color: 'TRUFFLE IP CHECK', composition: '70% WOOL 30% CASHMERE', srp: 49900000 },
    { sku_code: '8115254', product_name: 'GEORGETTE WCHK',     sub_category_id: subCatMap['W Tops'],      theme: 'SEPTEMBER (09)', color: 'TRUFFLE IP CHECK', composition: '70% WOOL 30% CASHMERE', srp: 58900000 },
    { sku_code: '8115640', product_name: 'SCARLETT EKD',       sub_category_id: subCatMap['W Tops'],      theme: 'SEPTEMBER (09)', color: 'CAMEL',            composition: '70% WOOL 30% CASHMERE', srp: 44900000 },
    { sku_code: '8115700', product_name: 'VICTORIA BLOUSE',    sub_category_id: subCatMap['W Tops'],      theme: 'OCTOBER (10)',   color: 'IVORY',            composition: '100% SILK',             srp: 38000000 },
    { sku_code: '8115701', product_name: 'EMMA SHIRT',         sub_category_id: subCatMap['W Tops'],      theme: 'OCTOBER (10)',   color: 'WHITE',            composition: '100% COTTON',           srp: 28000000 },
    { sku_code: '9201001', product_name: 'HERITAGE TOTE',      sub_category_id: subCatMap['M Bags'],      theme: 'OCTOBER (10)',   color: 'BLACK',            composition: '100% LEATHER',          srp: 65000000 },
    { sku_code: '9201002', product_name: 'MESSENGER BAG',      sub_category_id: subCatMap['M Bags'],      theme: 'OCTOBER (10)',   color: 'TAN',              composition: '100% LEATHER',          srp: 55000000 },
    { sku_code: '9201003', product_name: 'BACKPACK CLASSIC',   sub_category_id: subCatMap['M Bags'],      theme: 'NOVEMBER (11)',  color: 'NAVY',             composition: '100% NYLON',            srp: 42000000 },
    { sku_code: '9101001', product_name: 'LOLA BAG',           sub_category_id: subCatMap['W Bags'],      theme: 'AUGUST (08)',    color: 'BURGUNDY',         composition: '100% LEATHER',          srp: 78000000 },
    { sku_code: '9101002', product_name: 'TB BAG SMALL',       sub_category_id: subCatMap['W Bags'],      theme: 'SEPTEMBER (09)', color: 'BLACK',            composition: '100% LEATHER',          srp: 95000000 },
  ];

  for (const prod of productDefs) {
    await findOrCreate(
      () => prisma.product.findFirst({ where: { sku_code: prod.sku_code } }),
      () => prisma.product.create({ data: prod }),
    );
  }
  console.log(`  ${productDefs.length} products created`);

  // ─── DEFAULT USERS ────────────────────────────────────────────────────
  const password = await bcrypt.hash('dafc@2026', 12);

  const userDefs = [
    { email: 'admin@dafc.com',   name: 'System Admin',      role_id: adminRole.id },
    { email: 'buyer@dafc.com',   name: 'Nguyen Van Buyer',  role_id: buyerRole.id },
    { email: 'merch@dafc.com',   name: 'Tran Thi Merch',    role_id: merchRole.id },
    { email: 'manager@dafc.com', name: 'Le Van Manager',    role_id: merchMgrRole.id },
    { email: 'finance@dafc.com', name: 'Pham Director',     role_id: finDirRole.id },
  ];

  const users = await Promise.all(
    userDefs.map(def =>
      findOrCreate(
        () => prisma.user.findFirst({ where: { email: def.email } }),
        () => prisma.user.create({ data: { ...def, password_hash: password } }),
      ),
    ),
  );
  console.log(`  ${users.length} users created (password: dafc@2026)`);

  const [adminUser, , , managerUser, financeUser] = users;

  // ─── APPROVAL WORKFLOWS ───────────────────────────────────────────────
  for (const gb of groupBrands) {
    const existingWorkflow = await prisma.approvalWorkflow.findFirst({
      where: { group_brand_id: gb.id },
    });
    if (!existingWorkflow) {
      const workflow = await prisma.approvalWorkflow.create({
        data: {
          group_brand_id: gb.id,
          workflow_name: `${gb.name} Standard Approval`,
          approval_workflow_levels: {
            create: [
              { level_order: 1, level_name: 'Merchandising Manager Review', approver_user_id: managerUser.id, is_required: true },
              { level_order: 2, level_name: 'Finance Director Approval',    approver_user_id: financeUser.id, is_required: true },
            ],
          },
        },
      });
      console.log(`  Workflow created for ${gb.name}: ${workflow.id}`);
    } else {
      console.log(`  Workflow already exists for ${gb.name}: ${existingWorkflow.id}`);
    }
  }

  // ─── SAMPLE BUDGET ────────────────────────────────────────────────────
  const existingBudget = await prisma.budget.findFirst({
    where: { name: 'FY2025 Burberry Budget' },
  });
  if (!existingBudget) {
    const sampleBudget = await prisma.budget.create({
      data: {
        name: 'FY2025 Burberry Budget',
        amount: 50000000000,
        description: 'Annual budget for Burberry FY2025',
        fiscal_year: 2025,
        created_by: adminUser.id,
        allocate_headers: {
          create: {
            version: 1,
            brand_id: brandBUR.id,
            created_by: adminUser.id,
            budget_allocates: {
              create: [
                { store_id: storeREX.id, season_group_id: sgSS.id, season_id: seasons[2].id, budget_amount: 15000000000 },
                { store_id: storeTTP.id, season_group_id: sgSS.id, season_id: seasons[2].id, budget_amount: 10000000000 },
                { store_id: storeREX.id, season_group_id: sgFW.id, season_id: seasons[3].id, budget_amount: 15000000000 },
                { store_id: storeTTP.id, season_group_id: sgFW.id, season_id: seasons[3].id, budget_amount: 10000000000 },
              ],
            },
          },
        },
      },
    });
    console.log(`  Sample budget created: ${sampleBudget.name}`);
  } else {
    console.log(`  Sample budget already exists: ${existingBudget.name}`);
  }

  console.log('\nSeed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
