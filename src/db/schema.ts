import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// Users table with Firebase Auth UID linkage
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID / ID
  username: text('username').notNull(),
  fullName: text('full_name').notNull(),
  email: text('email'),
  role: text('role').notNull().default('GENERAL_USER'),
  organizationId: text('organization_id').default('org_default'),
  organizationName: text('organization_name'),
  designation: text('designation'),
  phone: text('phone'),
  isActive: boolean('is_active').notNull().default(true),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Organizations configuration table
export const organizations = pgTable('organizations', {
  id: text('id').primaryKey(), // e.g. 'org_default', 'org_gorkha'
  name: text('name').notNull(),
  officeName: text('office_name').notNull(),
  officeCode: text('office_code'),
  ministryName: text('ministry_name'),
  departmentName: text('department_name'),
  parentBodyName: text('parent_body_name'),
  province: text('province').notNull(),
  district: text('district').notNull(),
  localLevel: text('local_level'),
  address: text('address').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  mobile: text('mobile'),
  whatsapp: text('whatsapp'),
  website: text('website'),
  panNumber: text('pan_number'),
  registrationNo: text('registration_no'),
  authorizedPersonName: text('authorized_person_name'),
  authorizedPersonDesignation: text('authorized_person_designation'),
  currentFiscalYear: text('current_fiscal_year').default('२०८१/८२'),
  logoUrl: text('logo_url'),
  signatureUrl: text('signature_url'),
  headerText: text('header_text'),
  footerText: text('footer_text'),
  alignment: text('alignment').default('center'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Employees table
export const employees = pgTable('employees', {
  id: text('id').primaryKey(),
  orgId: text('org_id').default('org_default'),
  code: text('code').notNull(),
  name: text('name').notNull(),
  designation: text('designation').notNull(),
  level: text('level').notNull(),
  serviceGroup: text('service_group'),
  serviceType: text('service_type').notNull(), // 'स्थायी' | 'अस्थायी' | 'करार'
  gender: text('gender').notNull(), // 'पुरुष' | 'महिला' | 'अन्य'
  disability: text('disability').notNull(), // 'अपाङ्ग भएको' | 'अपाङ्ग नभएको'
  remoteArea: text('remote_area').notNull(), // 'क' | 'ख' | 'ग' | 'घ' | 'ङ' | 'दुर्गम नभएको'
  pension: text('pension').notNull(), // 'भएको' | 'नभएको'
  filingType: text('filing_type').notNull(), // 'एकल' | 'दम्पत्ती'
  panNumber: text('pan_number'),
  bankAccount: text('bank_account'),
  bankName: text('bank_name'),
  joinedDateBS: text('joined_date_bs').notNull(),
  joinedDateAD: text('joined_date_ad').notNull(),
  currentPostDateBS: text('current_post_date_bs'),
  currentPostDateAD: text('current_post_date_ad'),
  technicalGradeAmount: numeric('technical_grade_amount'),
  previousGradeCount: integer('previous_grade_count').default(0),
  addedGradeCount: integer('added_grade_count').default(0),
  gradeIncreaseMonthText: text('grade_increase_month_text'),
  festivalBonusMonth: text('festival_bonus_month'),
  uniformAllowanceMonth: text('uniform_allowance_month'),
  phone: text('phone'),
  email: text('email'),
  remarks: text('remarks'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Salary Setups table
export const salarySetups = pgTable('salary_setups', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull(),
  orgId: text('org_id').default('org_default'),
  fiscalYear: text('fiscal_year').notNull(),
  basicSalary: numeric('basic_salary').notNull().default('0'),
  technicalGradeAmount: numeric('technical_grade_amount').default('0'),
  salaryMonthsCount: integer('salary_months_count').default(12),
  gradeRate: numeric('grade_rate').notNull().default('0'),
  currentGradeCount: integer('current_grade_count').default(0),
  previousGradeCount: integer('previous_grade_count').default(0),
  addedGradeCount: integer('added_grade_count').default(0),
  gradeIncreaseCount: integer('grade_increase_count').default(0),
  gradeIncreaseMonth: text('grade_increase_month').default('श्रावण'),
  festivalBonusMonth: text('festival_bonus_month').default('असोज'),
  festivalBonusCustom: numeric('festival_bonus_custom'),
  lifeInsuranceFund: numeric('life_insurance_fund').default('0'),
  dearnessAllowance: numeric('dearness_allowance').default('0'),
  uniformAllowance: numeric('uniform_allowance').default('0'),
  uniformAllowanceMonth: text('uniform_allowance_month'),
  remoteAllowance: numeric('remote_allowance').default('0'),
  incentiveAllowance: numeric('incentive_allowance').default('0'),
  vehicleAllowance: numeric('vehicle_allowance').default('0'),
  communicationAllowance: numeric('communication_allowance').default('0'),
  otherMonthlyAllowance: numeric('other_monthly_allowance').default('0'),
  otherIncome: numeric('other_income').default('0'),
  otherTaxableIncome: numeric('other_taxable_income').default('0'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Deduction Setups table
export const deductionSetups = pgTable('deduction_setups', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull(),
  orgId: text('org_id').default('org_default'),
  fiscalYear: text('fiscal_year').notNull(),
  loanDeduction: numeric('loan_deduction').default('0'),
  citizenInvestmentTrust: numeric('citizen_investment_trust').default('0'),
  investmentInsuranceDeduction: numeric('investment_insurance_deduction').default('0'),
  healthInsuranceDeduction: numeric('health_insurance_deduction').default('0'),
  homeInsuranceDeduction: numeric('home_insurance_deduction').default('0'),
  remoteTaxReliefOverride: numeric('remote_tax_relief_override'),
  otherDeduction: numeric('other_deduction').default('0'),
  disabilityReliefOverride: numeric('disability_relief_override'),
  pensionSSTExemptOverride: numeric('pension_sst_exempt_override'),
  medicalExpenseActual: numeric('medical_expense_actual').default('0'),
  femaleTaxRebateOverride: numeric('female_tax_rebate_override'),
  lifeInsuranceCeilingLimit: numeric('life_insurance_ceiling_limit'),
  citCeilingLimit: numeric('cit_ceiling_limit'),
  healthInsuranceCeilingLimit: numeric('health_insurance_ceiling_limit'),
  homeInsuranceCeilingLimit: numeric('home_insurance_ceiling_limit'),
  medicalTaxCreditCeilingLimit: numeric('medical_tax_credit_ceiling_limit'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Tax Reference table
export const taxReferences = pgTable('tax_references', {
  id: text('id').primaryKey(),
  fiscalYear: text('fiscal_year').notNull(),
  filingType: text('filing_type').notNull(), // 'एकल' | 'दम्पत्ती'
  slabsData: jsonb('slabs_data').notNull(),
  remoteExemptions: jsonb('remote_exemptions').notNull(),
  disabilityExemptionPercent: numeric('disability_exemption_percent').default('50'),
  femaleTaxRebatePercent: numeric('female_tax_rebate_percent').default('10'),
  pensionSSTExempt: boolean('pension_sst_exempt').default(true),
  medicalTaxCreditRatePercent: numeric('medical_tax_credit_rate_percent').default('15'),
  medicalTaxCreditMaxAmount: numeric('medical_tax_credit_max_amount').default('750'),
  lifeInsuranceMaxDeduction: numeric('life_insurance_max_deduction').default('40000'),
  citMaxDeductionPercent: numeric('cit_max_deduction_percent').default('33.33'),
  citMaxDeductionAmount: numeric('cit_max_deduction_amount').default('300000'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// System Settings & Integrations table
export const systemSettings = pgTable('system_settings', {
  key: text('key').primaryKey(), // e.g. 'google_sheets_config', 'payroll_app_state'
  data: jsonb('data').notNull(),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [employees.orgId],
    references: [organizations.id],
  }),
  salarySetups: many(salarySetups),
  deductionSetups: many(deductionSetups),
}));

export const salarySetupsRelations = relations(salarySetups, ({ one }) => ({
  employee: one(employees, {
    fields: [salarySetups.employeeId],
    references: [employees.id],
  }),
}));

export const deductionSetupsRelations = relations(deductionSetups, ({ one }) => ({
  employee: one(employees, {
    fields: [deductionSetups.employeeId],
    references: [employees.id],
  }),
}));
