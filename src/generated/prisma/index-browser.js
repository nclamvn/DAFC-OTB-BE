
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable',
  Snapshot: 'Snapshot'
});

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  name: 'name',
  password_hash: 'password_hash',
  role_id: 'role_id',
  is_active: 'is_active',
  created_at: 'created_at',
  updated_at: 'updated_at',
  store_access: 'store_access',
  brand_access: 'brand_access'
};

exports.Prisma.RoleScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  permissions: 'permissions',
  created_by: 'created_by',
  created_at: 'created_at',
  updated_at: 'updated_at',
  updated_by: 'updated_by'
};

exports.Prisma.GroupBrandScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  is_active: 'is_active',
  created_by: 'created_by',
  created_at: 'created_at',
  updated_at: 'updated_at',
  updated_by: 'updated_by'
};

exports.Prisma.BrandScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  group_brand_id: 'group_brand_id',
  is_active: 'is_active',
  created_by: 'created_by',
  created_at: 'created_at',
  updated_at: 'updated_at',
  updated_by: 'updated_by'
};

exports.Prisma.StoreScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  region: 'region',
  location: 'location',
  is_active: 'is_active',
  created_by: 'created_by',
  created_at: 'created_at',
  updated_at: 'updated_at',
  updated_by: 'updated_by'
};

exports.Prisma.SeasonTypeScalarFieldEnum = {
  id: 'id',
  name: 'name',
  is_active: 'is_active',
  created_by: 'created_by',
  created_at: 'created_at',
  updated_at: 'updated_at',
  updated_by: 'updated_by'
};

exports.Prisma.SeasonGroupScalarFieldEnum = {
  id: 'id',
  name: 'name',
  year: 'year',
  is_active: 'is_active',
  created_by: 'created_by',
  created_at: 'created_at',
  updated_at: 'updated_at',
  updated_by: 'updated_by'
};

exports.Prisma.SeasonScalarFieldEnum = {
  id: 'id',
  name: 'name',
  season_group_id: 'season_group_id',
  is_active: 'is_active',
  created_by: 'created_by',
  created_at: 'created_at',
  updated_at: 'updated_at',
  updated_by: 'updated_by'
};

exports.Prisma.GenderScalarFieldEnum = {
  id: 'id',
  name: 'name',
  is_active: 'is_active',
  created_by: 'created_by',
  created_at: 'created_at',
  updated_at: 'updated_at',
  updated_by: 'updated_by'
};

exports.Prisma.CategoryScalarFieldEnum = {
  id: 'id',
  name: 'name',
  gender_id: 'gender_id',
  is_active: 'is_active',
  created_by: 'created_by',
  created_at: 'created_at',
  updated_at: 'updated_at',
  updated_by: 'updated_by'
};

exports.Prisma.SubCategoryScalarFieldEnum = {
  id: 'id',
  name: 'name',
  category_id: 'category_id',
  is_active: 'is_active',
  created_by: 'created_by',
  created_at: 'created_at',
  updated_at: 'updated_at',
  updated_by: 'updated_by'
};

exports.Prisma.SubcategorySizeScalarFieldEnum = {
  id: 'id',
  name: 'name',
  sub_category_id: 'sub_category_id',
  created_by: 'created_by',
  created_at: 'created_at',
  updated_at: 'updated_at',
  updated_by: 'updated_by'
};

exports.Prisma.ProductScalarFieldEnum = {
  id: 'id',
  sku_code: 'sku_code',
  product_name: 'product_name',
  sub_category_id: 'sub_category_id',
  brand_id: 'brand_id',
  family: 'family',
  theme: 'theme',
  color: 'color',
  composition: 'composition',
  srp: 'srp',
  image_url: 'image_url',
  is_active: 'is_active',
  created_by: 'created_by',
  created_at: 'created_at',
  updated_at: 'updated_at',
  updated_by: 'updated_by'
};

exports.Prisma.BudgetScalarFieldEnum = {
  id: 'id',
  name: 'name',
  amount: 'amount',
  description: 'description',
  status: 'status',
  fiscal_year: 'fiscal_year',
  created_by: 'created_by',
  created_at: 'created_at',
  updated_at: 'updated_at',
  updated_by: 'updated_by'
};

exports.Prisma.AllocateHeaderScalarFieldEnum = {
  id: 'id',
  budget_id: 'budget_id',
  brand_id: 'brand_id',
  version: 'version',
  is_final_version: 'is_final_version',
  is_snapshot: 'is_snapshot',
  ticket_id: 'ticket_id',
  created_by: 'created_by',
  created_at: 'created_at',
  updated_at: 'updated_at',
  updated_by: 'updated_by'
};

exports.Prisma.BudgetAllocateScalarFieldEnum = {
  id: 'id',
  allocate_header_id: 'allocate_header_id',
  store_id: 'store_id',
  season_group_id: 'season_group_id',
  season_id: 'season_id',
  budget_amount: 'budget_amount',
  created_by: 'created_by',
  created_at: 'created_at',
  updated_at: 'updated_at',
  updated_by: 'updated_by'
};

exports.Prisma.PlanningHeaderScalarFieldEnum = {
  id: 'id',
  allocate_header_id: 'allocate_header_id',
  version: 'version',
  status: 'status',
  is_final_version: 'is_final_version',
  created_by: 'created_by',
  created_at: 'created_at',
  updated_at: 'updated_at',
  updated_by: 'updated_by'
};

exports.Prisma.PlanningCollectionScalarFieldEnum = {
  id: 'id',
  season_type_id: 'season_type_id',
  store_id: 'store_id',
  planning_header_id: 'planning_header_id',
  actual_buy_pct: 'actual_buy_pct',
  actual_sales_pct: 'actual_sales_pct',
  actual_st_pct: 'actual_st_pct',
  actual_moc: 'actual_moc',
  proposed_buy_pct: 'proposed_buy_pct',
  otb_proposed_amount: 'otb_proposed_amount',
  pct_var_vs_last: 'pct_var_vs_last',
  created_by: 'created_by',
  created_at: 'created_at',
  updated_at: 'updated_at',
  updated_by: 'updated_by'
};

exports.Prisma.PlanningGenderScalarFieldEnum = {
  id: 'id',
  gender_id: 'gender_id',
  store_id: 'store_id',
  planning_header_id: 'planning_header_id',
  actual_buy_pct: 'actual_buy_pct',
  actual_sales_pct: 'actual_sales_pct',
  actual_st_pct: 'actual_st_pct',
  proposed_buy_pct: 'proposed_buy_pct',
  otb_proposed_amount: 'otb_proposed_amount',
  pct_var_vs_last: 'pct_var_vs_last',
  created_by: 'created_by',
  created_at: 'created_at',
  updated_at: 'updated_at',
  updated_by: 'updated_by'
};

exports.Prisma.PlanningCategoryScalarFieldEnum = {
  id: 'id',
  subcategory_id: 'subcategory_id',
  planning_header_id: 'planning_header_id',
  actual_buy_pct: 'actual_buy_pct',
  actual_sales_pct: 'actual_sales_pct',
  actual_st_pct: 'actual_st_pct',
  proposed_buy_pct: 'proposed_buy_pct',
  otb_proposed_amount: 'otb_proposed_amount',
  var_lastyear_pct: 'var_lastyear_pct',
  otb_actual_amount: 'otb_actual_amount',
  otb_actual_buy_pct: 'otb_actual_buy_pct',
  created_by: 'created_by',
  created_at: 'created_at',
  updated_at: 'updated_at',
  updated_by: 'updated_by'
};

exports.Prisma.SKUProposalHeaderScalarFieldEnum = {
  id: 'id',
  allocate_header_id: 'allocate_header_id',
  version: 'version',
  status: 'status',
  is_final_version: 'is_final_version',
  created_by: 'created_by',
  created_at: 'created_at',
  updated_at: 'updated_at',
  updated_by: 'updated_by'
};

exports.Prisma.SKUProposalScalarFieldEnum = {
  id: 'id',
  sku_proposal_header_id: 'sku_proposal_header_id',
  product_id: 'product_id',
  customer_target: 'customer_target',
  unit_cost: 'unit_cost',
  srp: 'srp',
  created_by: 'created_by',
  created_at: 'created_at',
  updated_at: 'updated_at',
  updated_by: 'updated_by'
};

exports.Prisma.SKUAllocateScalarFieldEnum = {
  id: 'id',
  sku_proposal_id: 'sku_proposal_id',
  store_id: 'store_id',
  quantity: 'quantity',
  created_by: 'created_by',
  created_at: 'created_at',
  updated_at: 'updated_at',
  updated_by: 'updated_by'
};

exports.Prisma.ProposalSizingHeaderScalarFieldEnum = {
  id: 'id',
  sku_proposal_header_id: 'sku_proposal_header_id',
  version: 'version',
  is_final_version: 'is_final_version',
  created_by: 'created_by',
  created_at: 'created_at',
  updated_at: 'updated_at',
  updated_by: 'updated_by'
};

exports.Prisma.ProposalSizingScalarFieldEnum = {
  id: 'id',
  proposal_sizing_header_id: 'proposal_sizing_header_id',
  sku_proposal_id: 'sku_proposal_id',
  subcategory_size_id: 'subcategory_size_id',
  actual_salesmix_pct: 'actual_salesmix_pct',
  actual_st_pct: 'actual_st_pct',
  proposal_quantity: 'proposal_quantity',
  created_by: 'created_by',
  created_at: 'created_at',
  updated_at: 'updated_at',
  updated_by: 'updated_by'
};

exports.Prisma.ApprovalStatusScalarFieldEnum = {
  id: 'id',
  name: 'name',
  is_active: 'is_active',
  created_by: 'created_by',
  created_at: 'created_at',
  updated_at: 'updated_at',
  updated_by: 'updated_by'
};

exports.Prisma.TicketScalarFieldEnum = {
  id: 'id',
  budget_id: 'budget_id',
  season_group_id: 'season_group_id',
  season_id: 'season_id',
  status: 'status',
  created_by: 'created_by',
  created_at: 'created_at',
  updated_at: 'updated_at',
  updated_by: 'updated_by'
};

exports.Prisma.ApprovalWorkflowScalarFieldEnum = {
  id: 'id',
  group_brand_id: 'group_brand_id',
  workflow_name: 'workflow_name',
  created_by: 'created_by',
  created_at: 'created_at',
  updated_at: 'updated_at',
  updated_by: 'updated_by'
};

exports.Prisma.ApprovalWorkflowLevelScalarFieldEnum = {
  id: 'id',
  approval_workflow_id: 'approval_workflow_id',
  level_order: 'level_order',
  level_name: 'level_name',
  approver_user_id: 'approver_user_id',
  is_required: 'is_required',
  created_by: 'created_by',
  created_at: 'created_at',
  updated_at: 'updated_at',
  updated_by: 'updated_by'
};

exports.Prisma.TicketApprovalLogScalarFieldEnum = {
  id: 'id',
  ticket_id: 'ticket_id',
  approval_workflow_level_id: 'approval_workflow_level_id',
  approver_user_id: 'approver_user_id',
  is_approved: 'is_approved',
  comment: 'comment',
  approved_at: 'approved_at',
  created_by: 'created_by',
  created_at: 'created_at',
  updated_at: 'updated_at',
  updated_by: 'updated_by'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};


exports.Prisma.ModelName = {
  User: 'User',
  Role: 'Role',
  GroupBrand: 'GroupBrand',
  Brand: 'Brand',
  Store: 'Store',
  SeasonType: 'SeasonType',
  SeasonGroup: 'SeasonGroup',
  Season: 'Season',
  Gender: 'Gender',
  Category: 'Category',
  SubCategory: 'SubCategory',
  SubcategorySize: 'SubcategorySize',
  Product: 'Product',
  Budget: 'Budget',
  AllocateHeader: 'AllocateHeader',
  BudgetAllocate: 'BudgetAllocate',
  PlanningHeader: 'PlanningHeader',
  PlanningCollection: 'PlanningCollection',
  PlanningGender: 'PlanningGender',
  PlanningCategory: 'PlanningCategory',
  SKUProposalHeader: 'SKUProposalHeader',
  SKUProposal: 'SKUProposal',
  SKUAllocate: 'SKUAllocate',
  ProposalSizingHeader: 'ProposalSizingHeader',
  ProposalSizing: 'ProposalSizing',
  ApprovalStatus: 'ApprovalStatus',
  Ticket: 'Ticket',
  ApprovalWorkflow: 'ApprovalWorkflow',
  ApprovalWorkflowLevel: 'ApprovalWorkflowLevel',
  TicketApprovalLog: 'TicketApprovalLog'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
