import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

// Add global connection pool caching to persist across hot-reloads
declare global {
  var _postgresPool: Pool | undefined;
  var _drizzleDb: ReturnType<typeof drizzle> | undefined;
}

export const resetPool = async () => {
  const oldPool = global._postgresPool;
  global._postgresPool = undefined;
  global._drizzleDb = undefined;
  if (oldPool) {
    try {
      await oldPool.end();
    } catch {
      // ignore
    }
  }
};

// Function to create or retrieve the connection pool using resilient settings.
export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST || '127.0.0.1',
      user: process.env.SQL_USER || 'postgres',
      password: process.env.SQL_PASSWORD || '',
      database: process.env.SQL_DB_NAME || 'postgres',
      max: 10,
      connectionTimeoutMillis: 20000,
      idleTimeoutMillis: 30000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    // Prevent unhandled pool-level errors from crashing the application
    global._postgresPool.on('error', (err) => {
      console.warn('SQL pool connection notice (fallback/idle):', err.message);
      if (
        err.message?.includes('Connection terminated') ||
        (err as any)?.code === 'ECONNRESET' ||
        (err as any)?.code === '57P01'
      ) {
        resetPool();
      }
    });
  }
  return global._postgresPool;
};

export const getDb = () => {
  if (!global._drizzleDb) {
    const pool = createPool();
    global._drizzleDb = drizzle(pool, { schema });
  }
  return global._drizzleDb;
};

// Export db proxy for backwards compatibility
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    const database = getDb();
    return (database as any)[prop];
  },
});

export async function withDbRetry<T>(queryFn: () => Promise<T>, maxRetries = 2, delayMs = 600): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await queryFn();
    } catch (error: any) {
      attempt++;
      const isTransient =
        error?.message?.includes('Connection terminated') ||
        error?.message?.includes('connection timeout') ||
        error?.message?.includes('timeout') ||
        error?.code === 'ECONNRESET' ||
        error?.code === '57P01' ||
        error?.cause?.message?.includes('Connection terminated') ||
        error?.cause?.message?.includes('timeout');

      if (isTransient && attempt <= maxRetries) {
        console.warn(
          `[Cloud SQL] Transient connection issue (attempt ${attempt}/${maxRetries}), refreshing pool and retrying in ${delayMs}ms:`,
          error?.message || error
        );
        await resetPool();
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw error;
    }
  }
}

export async function initSqlSchema() {
  try {
    const pool = createPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id text PRIMARY KEY,
        name text NOT NULL,
        office_name text NOT NULL,
        office_code text,
        ministry_name text,
        department_name text,
        parent_body_name text,
        province text NOT NULL,
        district text NOT NULL,
        local_level text,
        address text NOT NULL,
        email text NOT NULL,
        phone text,
        mobile text,
        whatsapp text,
        website text,
        pan_number text,
        registration_no text,
        authorized_person_name text,
        authorized_person_designation text,
        current_fiscal_year text DEFAULT '२०८१/८२',
        logo_url text,
        signature_url text,
        header_text text,
        footer_text text,
        alignment text DEFAULT 'center',
        spreadsheet_id text,
        spreadsheet_url text,
        drive_folder_id text DEFAULT '1XEVf3izkJYujAyW-qUfi3eP7vFimb2kj',
        last_synced_at timestamp,
        sync_status text DEFAULT 'IDLE',
        created_by_id text,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS users (
        id serial PRIMARY KEY,
        uid text NOT NULL UNIQUE,
        firebase_uid text UNIQUE,
        username text NOT NULL,
        full_name text NOT NULL,
        email text,
        role text NOT NULL DEFAULT 'GENERAL_USER',
        organization_id text REFERENCES organizations(id) ON DELETE SET NULL,
        organization_name text,
        designation text,
        phone text,
        is_active boolean NOT NULL DEFAULT true,
        metadata jsonb,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS employees (
        id text PRIMARY KEY,
        org_id text DEFAULT 'org_default',
        code text NOT NULL,
        name text NOT NULL,
        designation text NOT NULL,
        level text NOT NULL,
        service_group text,
        service_type text NOT NULL,
        gender text NOT NULL,
        disability text NOT NULL,
        remote_area text NOT NULL,
        pension text NOT NULL,
        filing_type text NOT NULL,
        pan_number text,
        bank_account text,
        bank_name text,
        joined_date_bs text NOT NULL,
        joined_date_ad text NOT NULL,
        current_post_date_bs text,
        current_post_date_ad text,
        technical_grade_amount numeric,
        previous_grade_count integer DEFAULT 0,
        added_grade_count integer DEFAULT 0,
        grade_increase_month_text text,
        festival_bonus_month text,
        uniform_allowance_month text,
        phone text,
        email text,
        remarks text,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS salary_setups (
        id text PRIMARY KEY,
        employee_id text NOT NULL,
        org_id text DEFAULT 'org_default',
        fiscal_year text NOT NULL,
        basic_salary numeric NOT NULL DEFAULT '0',
        technical_grade_amount numeric DEFAULT '0',
        salary_months_count integer DEFAULT 12,
        grade_rate numeric NOT NULL DEFAULT '0',
        current_grade_count integer DEFAULT 0,
        previous_grade_count integer DEFAULT 0,
        added_grade_count integer DEFAULT 0,
        grade_increase_count integer DEFAULT 0,
        grade_increase_month text DEFAULT 'श्रावण',
        festival_bonus_month text DEFAULT 'असोज',
        festival_bonus_custom numeric,
        life_insurance_fund numeric DEFAULT '0',
        dearness_allowance numeric DEFAULT '0',
        uniform_allowance numeric DEFAULT '0',
        uniform_allowance_month text,
        remote_allowance numeric DEFAULT '0',
        incentive_allowance numeric DEFAULT '0',
        vehicle_allowance numeric DEFAULT '0',
        communication_allowance numeric DEFAULT '0',
        other_monthly_allowance numeric DEFAULT '0',
        other_income numeric DEFAULT '0',
        other_taxable_income numeric DEFAULT '0',
        updated_at timestamp DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS deduction_setups (
        id text PRIMARY KEY,
        employee_id text NOT NULL,
        org_id text DEFAULT 'org_default',
        fiscal_year text NOT NULL,
        loan_deduction numeric DEFAULT '0',
        citizen_investment_trust numeric DEFAULT '0',
        investment_insurance_deduction numeric DEFAULT '0',
        health_insurance_deduction numeric DEFAULT '0',
        home_insurance_deduction numeric DEFAULT '0',
        remote_tax_relief_override numeric,
        other_deduction numeric DEFAULT '0',
        disability_relief_override numeric,
        pension_sst_exempt_override numeric,
        medical_expense_actual numeric DEFAULT '0',
        female_tax_rebate_override numeric,
        life_insurance_ceiling_limit numeric,
        cit_ceiling_limit numeric,
        health_insurance_ceiling_limit numeric,
        home_insurance_ceiling_limit numeric,
        medical_tax_credit_ceiling_limit numeric,
        updated_at timestamp DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS tax_references (
        id text PRIMARY KEY,
        fiscal_year text NOT NULL,
        filing_type text NOT NULL,
        slabs_data jsonb NOT NULL,
        remote_exemptions jsonb NOT NULL,
        disability_exemption_percent numeric DEFAULT '50',
        female_tax_rebate_percent numeric DEFAULT '10',
        pension_sst_exempt boolean DEFAULT true,
        medical_tax_credit_rate_percent numeric DEFAULT '15',
        medical_tax_credit_max_amount numeric DEFAULT '750',
        life_insurance_max_deduction numeric DEFAULT '40000',
        cit_max_deduction_percent numeric DEFAULT '33.33',
        cit_max_deduction_amount numeric DEFAULT '300000',
        updated_at timestamp DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        key text PRIMARY KEY,
        data jsonb NOT NULL,
        updated_by text,
        updated_at timestamp DEFAULT now()
      );
    `);
  } catch (err: any) {
    console.warn('[Postgres Schema] Notice during table verification:', err?.message || err);
  }
}

