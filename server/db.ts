// @ts-ignore Node.js typings may not be included by the consuming TypeScript config.
import fsModule from 'fs';
// @ts-ignore Node.js typings may not be included by the consuming TypeScript config.
import pathModule from 'path';
// @ts-ignore sql.js typings may not be installed in the consuming project.
import initSqlJs from 'sql.js';
// @ts-ignore bcryptjs typings may not be installed in the consuming project.
import bcrypt from 'bcryptjs';

declare const process: { cwd(): string };

const fs: any = fsModule;
const path: any = pathModule;

type Database = any;
type SqlJsStatic = any;

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'aicte_flow.sqlite');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

let SQL: SqlJsStatic;
let db: Database;

export function getDb(): Database {
  if (!db) {
    throw new Error('Database not initialized yet.');
  }
  return db;
}

export function saveDb(): void {
  if (!db) return;
  try {
    const data = db.export();
    fs.writeFileSync(DB_FILE, data);
  } catch (err) {
    console.error('Failed to persist database to disk:', err);
  }
}

// Helper to run query with parameters
export function runSql(sqlText: string, params: any[] = []): void {
  const database = getDb();
  database.run(sqlText, params);
  saveDb();
}

// Helper to query all rows as typed objects
export function queryAll<T = any>(sqlText: string, params: any[] = []): T[] {
  const database = getDb();
  const stmt = database.prepare(sqlText);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

// Helper to query single row
export function queryOne<T = any>(sqlText: string, params: any[] = []): T | null {
  const rows = queryAll<T>(sqlText, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function initDatabase(): Promise<void> {
  SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      db = new SQL.Database(fileBuffer);
      console.log('Loaded existing SQLite database from disk.');
    } catch (err) {
      console.warn('Existing database file corrupted, creating fresh one:', err);
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
    console.log('Created new in-memory SQLite database instance.');
  }

  createSchema();
  seedInitialData();
  saveDb();
}

function createSchema(): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL, -- 'INSTITUTION' | 'SCRUTINY_OFFICER' | 'REGIONAL_OFFICER' | 'ADMIN'
      designation TEXT,
      department TEXT,
      region TEXT,
      institution_id TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS institutions (
      id TEXT PRIMARY KEY,
      permanent_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      region TEXT NOT NULL,
      address TEXT NOT NULL,
      state TEXT NOT NULL,
      city TEXT NOT NULL,
      pincode TEXT NOT NULL,
      establishment_year INTEGER NOT NULL,
      institution_type TEXT NOT NULL,
      land_area_acres REAL NOT NULL,
      built_up_area_sqm REAL NOT NULL,
      principal_name TEXT NOT NULL,
      principal_email TEXT NOT NULL,
      principal_phone TEXT NOT NULL,
      compliance_status TEXT DEFAULT 'COMPLIANT',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workflow_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      stages_json TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      application_number TEXT UNIQUE NOT NULL,
      institution_id TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      application_type TEXT NOT NULL, -- 'EOA' | 'INCREASE_INTAKE' | 'NEW_COURSE' | 'NEW_INSTITUTION' | 'CLOSURE'
      workflow_template_id TEXT NOT NULL,
      workflow_rule_version INTEGER NOT NULL,
      current_stage_code TEXT NOT NULL,
      status TEXT NOT NULL, -- 'DRAFT' | 'SUBMITTED' | 'UNDER_SCRUTINY' | 'CORRECTION_REQUIRED' | 'RESUBMITTED' | 'UNDER_EVC' | 'EVC_COMPLETED' | 'UNDER_SAC_SHC' | 'RECOMMENDED' | 'REJECTED' | 'APPROVED'
      assigned_scrutiny_officer_id TEXT,
      assigned_regional_officer_id TEXT,
      assigned_region TEXT NOT NULL,
      submitted_at TEXT,
      stage_deadline_at TEXT,
      overall_deadline_at TEXT,
      final_decision TEXT,
      final_decision_at TEXT,
      final_decision_remarks TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS application_stages_history (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      stage_code TEXT NOT NULL,
      stage_name TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL, -- 'SUBMIT' | 'ASSIGN' | 'OBSERVE' | 'RETURN_FOR_CORRECTION' | 'RESUBMIT' | 'SCHEDULE_EVC' | 'COMPLETE_STAGE' | 'APPROVE' | 'REJECT'
      previous_status TEXT,
      new_status TEXT,
      reason TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS application_deficiencies (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      stage_code TEXT NOT NULL,
      category TEXT NOT NULL, -- 'DOCUMENT' | 'INFRASTRUCTURE' | 'FACULTY' | 'FINANCIAL' | 'REGULATORY'
      description TEXT NOT NULL,
      severity TEXT NOT NULL, -- 'CRITICAL' | 'MAJOR' | 'MINOR'
      status TEXT NOT NULL, -- 'OPEN' | 'ADDRESSED' | 'VERIFIED' | 'WAIVED'
      raised_by_user_id TEXT NOT NULL,
      raised_by_name TEXT NOT NULL,
      raised_at TEXT NOT NULL,
      institutional_response TEXT,
      response_document_id TEXT,
      responded_at TEXT,
      resolved_by_user_id TEXT,
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      institution_id TEXT NOT NULL,
      application_id TEXT,
      document_type TEXT NOT NULL,
      title TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      valid_from TEXT NOT NULL,
      valid_to TEXT NOT NULL,
      is_expiring_soon INTEGER DEFAULT 0,
      verification_status TEXT DEFAULT 'PENDING', -- 'PENDING' | 'VERIFIED' | 'DEFICIENT' | 'EXPIRED'
      verification_notes TEXT,
      uploaded_by_user_id TEXT NOT NULL,
      uploaded_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS evc_visits (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      institution_id TEXT NOT NULL,
      regional_officer_id TEXT NOT NULL,
      visit_type TEXT NOT NULL, -- 'SCHEDULED' | 'SURPRISE' | 'VIRTUAL'
      proposed_date TEXT NOT NULL,
      confirmed_date TEXT,
      visit_status TEXT NOT NULL, -- 'PROPOSED' | 'SCHEDULED' | 'CONDUCTED' | 'REPORT_SUBMITTED' | 'CANCELLED'
      outcome TEXT DEFAULT 'PENDING', -- 'RECOMMENDED' | 'DEFICIENCIES_OBSERVED' | 'NOT_RECOMMENDED' | 'PENDING'
      infrastructure_score REAL,
      lab_compliance_score REAL,
      faculty_presence_ratio REAL,
      report_summary TEXT,
      recommendations TEXT,
      conducted_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS evc_committee_members (
      id TEXT PRIMARY KEY,
      visit_id TEXT NOT NULL,
      member_name TEXT NOT NULL,
      role_in_committee TEXT NOT NULL, -- 'CHAIRMAN' | 'SUBJECT_EXPERT' | 'PWD_ARCHITECT_EXPERT' | 'INDUSTRY_EXPERT'
      affiliation TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      visit_date TEXT NOT NULL,
      is_confirmed INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS compliance_undertakings (
      id TEXT PRIMARY KEY,
      institution_id TEXT NOT NULL,
      application_id TEXT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      submission_date TEXT NOT NULL,
      deadline_date TEXT NOT NULL,
      status TEXT NOT NULL, -- 'ACTIVE' | 'SUBMITTED_FOR_REVIEW' | 'COMPLIED' | 'OVERDUE'
      proof_document_id TEXT,
      penalty_applicable INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      recipient_user_id TEXT,
      recipient_role TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      notification_type TEXT NOT NULL,
      reference_type TEXT,
      reference_id TEXT,
      is_read INTEGER DEFAULT 0,
      channel TEXT DEFAULT 'IN_APP',
      delivery_status TEXT DEFAULT 'DELIVERED', -- 'SENT' | 'DELIVERED' | 'FAILED' | 'PENDING'
      sent_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      previous_state TEXT,
      new_state TEXT,
      ip_address TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS integration_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING', -- 'PENDING' | 'PROCESSED' | 'FAILED'
      delivery_attempts INTEGER DEFAULT 0,
      last_attempt_at TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

function seedInitialData(): void {
  const userCount = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM users');
  if (userCount && userCount.count > 0) {
    return; // Already seeded
  }

  console.log('Seeding initial synthetic aakalan data...');
  const salt = bcrypt.genSaltSync(10);
  const defaultPasswordHash = bcrypt.hashSync('aicte@demo123', salt);
  const now = new Date().toISOString();

  // 1. Seed Institutions
  const institutions = [
    {
      id: 'inst-001',
      permanent_id: '1-3321456789',
      name: 'Veermata Jijabai Technical Institute (VJTI)',
      region: 'Western',
      address: 'H. R. Mahajani Marg, Matunga',
      state: 'Maharashtra',
      city: 'Mumbai',
      pincode: '400019',
      establishment_year: 1887,
      institution_type: 'Engineering & Technology',
      land_area_acres: 16.5,
      built_up_area_sqm: 45200,
      principal_name: 'Dr. Sachin V. Patel',
      principal_email: 'principal@vjti-polytechnic.edu.in',
      principal_phone: '+91 22 24198101',
      compliance_status: 'COMPLIANT',
      created_at: now
    },
    {
      id: 'inst-002',
      permanent_id: '1-4458921300',
      name: 'Delhi Institute of Engineering & Advanced Technology',
      region: 'Northern',
      address: 'Sector 14, Institutional Area, Dwarka',
      state: 'Delhi',
      city: 'New Delhi',
      pincode: '110078',
      establishment_year: 2004,
      institution_type: 'Engineering & Technology',
      land_area_acres: 12.0,
      built_up_area_sqm: 32000,
      principal_name: 'Dr. Meenakshi Sundaram',
      principal_email: 'director@dieat.ac.in',
      principal_phone: '+91 11 28080000',
      compliance_status: 'COMPLIANT',
      created_at: now
    },
    {
      id: 'inst-003',
      permanent_id: '1-5129038471',
      name: 'Bengaluru Academy of Technology and Management',
      region: 'South-Western',
      address: 'Electronic City Phase II, Hosur Road',
      state: 'Karnataka',
      city: 'Bengaluru',
      pincode: '560100',
      establishment_year: 2011,
      institution_type: 'Management & Technology',
      land_area_acres: 8.5,
      built_up_area_sqm: 24500,
      principal_name: 'Dr. K. Ananthapadmanabhan',
      principal_email: 'head@batm.edu.in',
      principal_phone: '+91 80 41123344',
      compliance_status: 'ACTION_REQUIRED',
      created_at: now
    },
    {
      id: 'inst-004',
      permanent_id: '1-6239104822',
      name: 'Kolkata Institute of Pharmaceutical Sciences',
      region: 'Eastern',
      address: 'Sector V, Salt Lake City',
      state: 'West Bengal',
      city: 'Kolkata',
      pincode: '700091',
      establishment_year: 2015,
      institution_type: 'Pharmacy',
      land_area_acres: 5.2,
      built_up_area_sqm: 16800,
      principal_name: 'Dr. Debabrata Roy',
      principal_email: 'principal@kips.edu.in',
      principal_phone: '+91 33 23578900',
      compliance_status: 'COMPLIANT',
      created_at: now
    }
  ];

  for (const inst of institutions) {
    db.run(
      `INSERT INTO institutions (id, permanent_id, name, region, address, state, city, pincode, establishment_year, institution_type, land_area_acres, built_up_area_sqm, principal_name, principal_email, principal_phone, compliance_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        inst.id,
        inst.permanent_id,
        inst.name,
        inst.region,
        inst.address,
        inst.state,
        inst.city,
        inst.pincode,
        inst.establishment_year,
        inst.institution_type,
        inst.land_area_acres,
        inst.built_up_area_sqm,
        inst.principal_name,
        inst.principal_email,
        inst.principal_phone,
        inst.compliance_status,
        inst.created_at
      ]
    );
  }

  // 2. Seed Users (4 personas)
  const users = [
    {
      id: 'usr-inst-01',
      email: 'principal@vjti-polytechnic.edu.in',
      password_hash: defaultPasswordHash,
      full_name: 'Dr. Sachin V. Patel',
      role: 'INSTITUTION',
      designation: 'Principal & Authorized Signatory',
      department: 'Administration',
      region: 'Western',
      institution_id: 'inst-001',
      created_at: now
    },
    {
      id: 'usr-scrutiny-01',
      email: 'scrutiny.western@aicte-india.org',
      password_hash: defaultPasswordHash,
      full_name: 'Dr. Rajesh K. Sharma',
      role: 'SCRUTINY_OFFICER',
      designation: 'Senior Scrutiny Officer',
      department: 'Approval Bureau - Scrutiny Cell',
      region: 'Western',
      institution_id: null,
      created_at: now
    },
    {
      id: 'usr-regional-01',
      email: 'ro.mumbai@aicte-india.org',
      password_hash: defaultPasswordHash,
      full_name: 'Prof. S. N. Deshmukh',
      role: 'REGIONAL_OFFICER',
      designation: 'Regional Officer & EVC Coordinator',
      department: 'Western Regional Office (WRO)',
      region: 'Western',
      institution_id: null,
      created_at: now
    },
    {
      id: 'usr-admin-01',
      email: 'admin.workflows@aicte-india.org',
      password_hash: defaultPasswordHash,
      full_name: 'Shri P. V. Raman',
      role: 'ADMIN',
      designation: 'Director (Approval Bureau)',
      department: 'AICTE Headquarters, New Delhi',
      region: 'National',
      institution_id: null,
      created_at: now
    }
  ];

  for (const user of users) {
    db.run(
      `INSERT INTO users (id, email, password_hash, full_name, role, designation, department, region, institution_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.email,
        user.password_hash,
        user.full_name,
        user.role,
        user.designation,
        user.department,
        user.region,
        user.institution_id,
        user.created_at
      ]
    );
  }

  // 3. Seed Workflow Templates
  const workflowTemplates = [
    {
      id: 'tmpl-scrutiny-evc',
      name: 'Scrutiny + EVC (Comprehensive Verification)',
      code: 'SCRUTINY_EVC',
      description: 'Prescribed workflow for Extension of Approval with course additions or change in intake requiring physical Expert Visiting Committee.',
      version: 2,
      stages: [
        {
          code: 'STAGE_SCRUTINY',
          name: 'Document & Eligibility Scrutiny',
          required_role: 'SCRUTINY_OFFICER',
          deadline_days: 7,
          allow_return: true,
          next_stage: 'STAGE_EVC'
        },
        {
          code: 'STAGE_EVC',
          name: 'Expert Visiting Committee (EVC)',
          required_role: 'REGIONAL_OFFICER',
          deadline_days: 10,
          allow_return: false,
          next_stage: 'STAGE_FINAL_APPROVAL'
        },
        {
          code: 'STAGE_FINAL_APPROVAL',
          name: 'Competent Authority Final Decision',
          required_role: 'ADMIN',
          deadline_days: 5,
          allow_return: true,
          next_stage: null
        }
      ]
    },
    {
      id: 'tmpl-only-scrutiny',
      name: 'Only Scrutiny (Routine EoA with Clean History)',
      code: 'ONLY_SCRUTINY',
      description: 'Streamlined desk scrutiny for existing compliant institutions applying for simple Extension of Approval (EoA) without capacity alterations.',
      version: 1,
      stages: [
        {
          code: 'STAGE_SCRUTINY',
          name: 'Document & Eligibility Scrutiny',
          required_role: 'SCRUTINY_OFFICER',
          deadline_days: 5,
          allow_return: true,
          next_stage: 'STAGE_FINAL_APPROVAL'
        },
        {
          code: 'STAGE_FINAL_APPROVAL',
          name: 'Competent Authority Final Decision',
          required_role: 'ADMIN',
          deadline_days: 3,
          allow_return: false,
          next_stage: null
        }
      ]
    },
    {
      id: 'tmpl-scrutiny-evc-sac',
      name: 'Full Scrutiny + EVC + SAC/SHC Hearing',
      code: 'SCRUTINY_EVC_SAC',
      description: 'Full multi-tier approval workflow with Standing Appellate Committee (SAC) or Standing Hearing Committee (SHC) evaluation for critical cases.',
      version: 2,
      stages: [
        {
          code: 'STAGE_SCRUTINY',
          name: 'Document & Eligibility Scrutiny',
          required_role: 'SCRUTINY_OFFICER',
          deadline_days: 7,
          allow_return: true,
          next_stage: 'STAGE_EVC'
        },
        {
          code: 'STAGE_EVC',
          name: 'Expert Visiting Committee (EVC)',
          required_role: 'REGIONAL_OFFICER',
          deadline_days: 10,
          allow_return: false,
          next_stage: 'STAGE_SAC_SHC'
        },
        {
          code: 'STAGE_SAC_SHC',
          name: 'Standing Appellate / Hearing Committee',
          required_role: 'REGIONAL_OFFICER',
          deadline_days: 7,
          allow_return: true,
          next_stage: 'STAGE_FINAL_APPROVAL'
        },
        {
          code: 'STAGE_FINAL_APPROVAL',
          name: 'Executive Committee Final Decision',
          required_role: 'ADMIN',
          deadline_days: 5,
          allow_return: false,
          next_stage: null
        }
      ]
    },
    {
      id: 'tmpl-only-evc',
      name: 'Only EVC (Special Inspection & Verification)',
      code: 'ONLY_EVC',
      description: 'Direct physical verification workflow triggered for complaints, surprise checks, or compliance re-inspections.',
      version: 1,
      stages: [
        {
          code: 'STAGE_EVC',
          name: 'Physical Inspection / EVC Visit',
          required_role: 'REGIONAL_OFFICER',
          deadline_days: 7,
          allow_return: false,
          next_stage: 'STAGE_FINAL_APPROVAL'
        },
        {
          code: 'STAGE_FINAL_APPROVAL',
          name: 'Competent Authority Final Decision',
          required_role: 'ADMIN',
          deadline_days: 4,
          allow_return: false,
          next_stage: null
        }
      ]
    }
  ];

  for (const tmpl of workflowTemplates) {
    db.run(
      `INSERT INTO workflow_templates (id, name, code, description, version, stages_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tmpl.id, tmpl.name, tmpl.code, tmpl.description, tmpl.version, JSON.stringify(tmpl.stages), now]
    );
  }

  // Helper date calculations
  const dateOffset = (days: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
  };

  // 4. Seed Applications (Representing multiple realistic states)
  const applications = [
    {
      id: 'app-001',
      application_number: 'AICTE/2026-27/WR/8042',
      institution_id: 'inst-001',
      academic_year: '2026-27',
      application_type: 'INCREASE_INTAKE',
      workflow_template_id: 'tmpl-scrutiny-evc',
      workflow_rule_version: 2,
      current_stage_code: 'STAGE_SCRUTINY',
      status: 'UNDER_SCRUTINY',
      assigned_scrutiny_officer_id: 'usr-scrutiny-01',
      assigned_regional_officer_id: 'usr-regional-01',
      assigned_region: 'Western',
      submitted_at: dateOffset(-3),
      stage_deadline_at: dateOffset(1), // Approaching deadline (< 48 hours)
      overall_deadline_at: dateOffset(18),
      created_at: dateOffset(-4),
      updated_at: dateOffset(-1)
    },
    {
      id: 'app-002',
      application_number: 'AICTE/2026-27/WR/7890',
      institution_id: 'inst-001',
      academic_year: '2026-27',
      application_type: 'NEW_COURSE',
      workflow_template_id: 'tmpl-scrutiny-evc',
      workflow_rule_version: 2,
      current_stage_code: 'STAGE_SCRUTINY',
      status: 'CORRECTION_REQUIRED',
      assigned_scrutiny_officer_id: 'usr-scrutiny-01',
      assigned_regional_officer_id: 'usr-regional-01',
      assigned_region: 'Western',
      submitted_at: dateOffset(-8),
      stage_deadline_at: dateOffset(4),
      overall_deadline_at: dateOffset(15),
      created_at: dateOffset(-10),
      updated_at: dateOffset(-2)
    },
    {
      id: 'app-003',
      application_number: 'AICTE/2026-27/WR/6521',
      institution_id: 'inst-001',
      academic_year: '2026-27',
      application_type: 'EOA',
      workflow_template_id: 'tmpl-scrutiny-evc',
      workflow_rule_version: 2,
      current_stage_code: 'STAGE_EVC',
      status: 'UNDER_EVC',
      assigned_scrutiny_officer_id: 'usr-scrutiny-01',
      assigned_regional_officer_id: 'usr-regional-01',
      assigned_region: 'Western',
      submitted_at: dateOffset(-14),
      stage_deadline_at: dateOffset(3),
      overall_deadline_at: dateOffset(10),
      created_at: dateOffset(-16),
      updated_at: dateOffset(-2)
    },
    {
      id: 'app-004',
      application_number: 'AICTE/2026-27/NR/4102',
      institution_id: 'inst-002',
      academic_year: '2026-27',
      application_type: 'EOA',
      workflow_template_id: 'tmpl-only-scrutiny',
      workflow_rule_version: 1,
      current_stage_code: 'STAGE_FINAL_APPROVAL',
      status: 'APPROVED',
      assigned_scrutiny_officer_id: 'usr-scrutiny-01',
      assigned_regional_officer_id: 'usr-regional-01',
      assigned_region: 'Northern',
      submitted_at: dateOffset(-22),
      stage_deadline_at: dateOffset(-10),
      overall_deadline_at: dateOffset(-8),
      final_decision: 'APPROVED',
      final_decision_at: dateOffset(-9),
      final_decision_remarks: 'All prescribed norms met. Extension of Approval granted for Academic Year 2026-27 with existing intake.',
      created_at: dateOffset(-24),
      updated_at: dateOffset(-9)
    },
    {
      id: 'app-005',
      application_number: 'AICTE/2026-27/SW/3199',
      institution_id: 'inst-003',
      academic_year: '2026-27',
      application_type: 'INCREASE_INTAKE',
      workflow_template_id: 'tmpl-scrutiny-evc',
      workflow_rule_version: 2,
      current_stage_code: 'STAGE_SCRUTINY',
      status: 'UNDER_SCRUTINY',
      assigned_scrutiny_officer_id: 'usr-scrutiny-01',
      assigned_regional_officer_id: 'usr-regional-01',
      assigned_region: 'South-Western',
      submitted_at: dateOffset(-15),
      stage_deadline_at: dateOffset(-3), // OVERDUE (Eligible for notification & escalation)
      overall_deadline_at: dateOffset(5),
      created_at: dateOffset(-18),
      updated_at: dateOffset(-10)
    },
    {
      id: 'app-006',
      application_number: 'AICTE/2026-27/ER/5512',
      institution_id: 'inst-004',
      academic_year: '2026-27',
      application_type: 'NEW_COURSE',
      workflow_template_id: 'tmpl-scrutiny-evc-sac',
      workflow_rule_version: 2,
      current_stage_code: 'STAGE_SAC_SHC',
      status: 'UNDER_SAC_SHC',
      assigned_scrutiny_officer_id: 'usr-scrutiny-01',
      assigned_regional_officer_id: 'usr-regional-01',
      assigned_region: 'Eastern',
      submitted_at: dateOffset(-28),
      stage_deadline_at: dateOffset(5),
      overall_deadline_at: dateOffset(12),
      created_at: dateOffset(-30),
      updated_at: dateOffset(-4)
    }
  ];

  for (const app of applications) {
    db.run(
      `INSERT INTO applications (id, application_number, institution_id, academic_year, application_type, workflow_template_id, workflow_rule_version, current_stage_code, status, assigned_scrutiny_officer_id, assigned_regional_officer_id, assigned_region, submitted_at, stage_deadline_at, overall_deadline_at, final_decision, final_decision_at, final_decision_remarks, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        app.id,
        app.application_number,
        app.institution_id,
        app.academic_year,
        app.application_type,
        app.workflow_template_id,
        app.workflow_rule_version,
        app.current_stage_code,
        app.status,
        app.assigned_scrutiny_officer_id,
        app.assigned_regional_officer_id,
        app.assigned_region,
        app.submitted_at,
        app.stage_deadline_at,
        app.overall_deadline_at,
        app.final_decision || null,
        app.final_decision_at || null,
        app.final_decision_remarks || null,
        app.created_at,
        app.updated_at
      ]
    );
  }

  // 5. Seed Application Stage History
  const historyRecords = [
    {
      id: 'hist-001',
      application_id: 'app-001',
      stage_code: 'STAGE_DRAFT',
      stage_name: 'Application Form Filling',
      actor_user_id: 'usr-inst-01',
      actor_name: 'Dr. Sachin V. Patel',
      actor_role: 'INSTITUTION',
      action: 'SUBMIT',
      previous_status: 'DRAFT',
      new_status: 'SUBMITTED',
      reason: null,
      notes: 'Initial formal submission of Application for Increase in Intake in AI & Data Science (from 60 to 120 seats).',
      created_at: dateOffset(-3)
    },
    {
      id: 'hist-002',
      application_id: 'app-001',
      stage_code: 'STAGE_SCRUTINY',
      stage_name: 'Document & Eligibility Scrutiny',
      actor_user_id: 'usr-admin-01',
      actor_name: 'Shri P. V. Raman',
      actor_role: 'ADMIN',
      action: 'ASSIGN',
      previous_status: 'SUBMITTED',
      new_status: 'UNDER_SCRUTINY',
      reason: null,
      notes: 'Assigned to Dr. Rajesh K. Sharma (Senior Scrutiny Officer, Western Region Desk). Rule version: 2.',
      created_at: dateOffset(-3)
    },
    {
      id: 'hist-003',
      application_id: 'app-002',
      stage_code: 'STAGE_SCRUTINY',
      stage_name: 'Document & Eligibility Scrutiny',
      actor_user_id: 'usr-scrutiny-01',
      actor_name: 'Dr. Rajesh K. Sharma',
      actor_role: 'SCRUTINY_OFFICER',
      action: 'RETURN_FOR_CORRECTION',
      previous_status: 'UNDER_SCRUTINY',
      new_status: 'CORRECTION_REQUIRED',
      reason: 'Building Completion Certificate lacks Municipal Corporation occupancy approval endorsement for the newly constructed 4th floor labs.',
      notes: 'Applicant institution granted 5 business days to upload verified occupancy certificate from MCGM and updated faculty roster.',
      created_at: dateOffset(-2)
    },
    {
      id: 'hist-004',
      application_id: 'app-003',
      stage_code: 'STAGE_SCRUTINY',
      stage_name: 'Document & Eligibility Scrutiny',
      actor_user_id: 'usr-scrutiny-01',
      actor_name: 'Dr. Rajesh K. Sharma',
      actor_role: 'SCRUTINY_OFFICER',
      action: 'COMPLETE_STAGE',
      previous_status: 'UNDER_SCRUTINY',
      new_status: 'UNDER_EVC',
      reason: null,
      notes: 'Document scrutiny successfully cleared without non-waivable deficiencies. Advanced to physical Expert Visiting Committee stage.',
      created_at: dateOffset(-5)
    },
    {
      id: 'hist-005',
      application_id: 'app-003',
      stage_code: 'STAGE_EVC',
      stage_name: 'Expert Visiting Committee (EVC)',
      actor_user_id: 'usr-regional-01',
      actor_name: 'Prof. S. N. Deshmukh',
      actor_role: 'REGIONAL_OFFICER',
      action: 'SCHEDULE_EVC',
      previous_status: 'UNDER_EVC',
      new_status: 'UNDER_EVC',
      reason: null,
      notes: 'Scheduled physical inspection for 3-member committee on ' + dateOffset(3).split('T')[0],
      created_at: dateOffset(-2)
    }
  ];

  for (const h of historyRecords) {
    db.run(
      `INSERT INTO application_stages_history (id, application_id, stage_code, stage_name, actor_user_id, actor_name, actor_role, action, previous_status, new_status, reason, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [h.id, h.application_id, h.stage_code, h.stage_name, h.actor_user_id, h.actor_name, h.actor_role, h.action, h.previous_status, h.new_status, h.reason, h.notes, h.created_at]
    );
  }

  // 6. Seed Deficiencies
  const deficiencies = [
    {
      id: 'def-001',
      application_id: 'app-002',
      stage_code: 'STAGE_SCRUTINY',
      category: 'DOCUMENT',
      description: 'Building Completion & Occupancy Certificate: Municipal corporation seal missing on Annexure B.',
      severity: 'CRITICAL',
      status: 'OPEN',
      raised_by_user_id: 'usr-scrutiny-01',
      raised_by_name: 'Dr. Rajesh K. Sharma',
      raised_at: dateOffset(-2),
      institutional_response: null,
      response_document_id: null,
      responded_at: null,
      resolved_by_user_id: null,
      resolved_at: null
    },
    {
      id: 'def-002',
      application_id: 'app-002',
      stage_code: 'STAGE_SCRUTINY',
      category: 'FACULTY',
      description: 'Cadre ratio discrepancy in Computer Science: Professor-to-Student ratio is 1:24 instead of prescribed 1:20.',
      severity: 'MAJOR',
      status: 'OPEN',
      raised_by_user_id: 'usr-scrutiny-01',
      raised_by_name: 'Dr. Rajesh K. Sharma',
      raised_at: dateOffset(-2),
      institutional_response: null,
      response_document_id: null,
      responded_at: null,
      resolved_by_user_id: null,
      resolved_at: null
    },
    {
      id: 'def-003',
      application_id: 'app-001',
      stage_code: 'STAGE_SCRUTINY',
      category: 'INFRASTRUCTURE',
      description: 'Language Laboratory software license certificate expired on 2026-03-31; renewal receipt required.',
      severity: 'MINOR',
      status: 'ADDRESSED',
      raised_by_user_id: 'usr-scrutiny-01',
      raised_by_name: 'Dr. Rajesh K. Sharma',
      raised_at: dateOffset(-2),
      institutional_response: 'Purchased 3-year enterprise license renewal from Pearson EdTech. Invoice and active license key uploaded.',
      response_document_id: 'doc-004',
      responded_at: dateOffset(-1),
      resolved_by_user_id: null,
      resolved_at: null
    }
  ];

  for (const def of deficiencies) {
    db.run(
      `INSERT INTO application_deficiencies (id, application_id, stage_code, category, description, severity, status, raised_by_user_id, raised_by_name, raised_at, institutional_response, response_document_id, responded_at, resolved_by_user_id, resolved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [def.id, def.application_id, def.stage_code, def.category, def.description, def.severity, def.status, def.raised_by_user_id, def.raised_by_name, def.raised_at, def.institutional_response, def.response_document_id, def.responded_at, def.resolved_by_user_id, def.resolved_at]
    );
  }

  // 7. Seed Prescribed Documents
  const documents = [
    {
      id: 'doc-001',
      institution_id: 'inst-001',
      application_id: 'app-001',
      document_type: 'LAND_REGISTRATION',
      title: 'Perpetual Land Deed & Government Gazette Allocation',
      file_name: 'vjti_land_title_gazette.pdf',
      file_size: 2450000,
      mime_type: 'application/pdf',
      file_path: 'uploads/vjti_land_title_gazette.pdf',
      valid_from: '1985-04-01',
      valid_to: '2085-03-31',
      is_expiring_soon: 0,
      verification_status: 'VERIFIED',
      verification_notes: '16.5 acres contiguous freehold title verified against State Revenue records.',
      uploaded_by_user_id: 'usr-inst-01',
      uploaded_at: dateOffset(-10)
    },
    {
      id: 'doc-002',
      institution_id: 'inst-001',
      application_id: 'app-001',
      document_type: 'FIRE_SAFETY_NOC',
      title: 'Fire Safety Clearance NOC from Chief Fire Officer',
      file_name: 'fire_safety_noc_2026.pdf',
      file_size: 1120000,
      mime_type: 'application/pdf',
      file_path: 'uploads/fire_safety_noc_2026.pdf',
      valid_from: '2025-11-15',
      valid_to: dateOffset(22), // Expiring soon (< 30 days!)
      is_expiring_soon: 1,
      verification_status: 'VERIFIED',
      verification_notes: 'Valid certificate; renewal application advised within 3 weeks.',
      uploaded_by_user_id: 'usr-inst-01',
      uploaded_at: dateOffset(-10)
    },
    {
      id: 'doc-003',
      institution_id: 'inst-001',
      application_id: 'app-001',
      document_type: 'BUILDING_COMPLETION',
      title: 'Municipal Corporation Building Occupancy Certificate',
      file_name: 'mcgm_occupancy_certificate.pdf',
      file_size: 3200000,
      mime_type: 'application/pdf',
      file_path: 'uploads/mcgm_occupancy_certificate.pdf',
      valid_from: '2018-06-12',
      valid_to: '2038-06-11',
      is_expiring_soon: 0,
      verification_status: 'VERIFIED',
      verification_notes: 'Permanent structural soundness and occupancy verified.',
      uploaded_by_user_id: 'usr-inst-01',
      uploaded_at: dateOffset(-10)
    },
    {
      id: 'doc-004',
      institution_id: 'inst-001',
      application_id: 'app-001',
      document_type: 'DEFICIENCY_RECTIFICATION',
      title: 'Pearson Language Lab Software License 2026-2029',
      file_name: 'pearson_language_lab_invoice.pdf',
      file_size: 640000,
      mime_type: 'application/pdf',
      file_path: 'uploads/pearson_language_lab_invoice.pdf',
      valid_from: '2026-04-01',
      valid_to: '2029-03-31',
      is_expiring_soon: 0,
      verification_status: 'PENDING',
      verification_notes: 'Uploaded by institution to resolve deficiency DEF-003.',
      uploaded_by_user_id: 'usr-inst-01',
      uploaded_at: dateOffset(-1)
    },
    {
      id: 'doc-005',
      institution_id: 'inst-003',
      application_id: 'app-005',
      document_type: 'FIRE_SAFETY_NOC',
      title: 'Karnataka State Fire & Emergency Clearance',
      file_name: 'ksfes_fire_noc_2025.pdf',
      file_size: 980000,
      mime_type: 'application/pdf',
      file_path: 'uploads/ksfes_fire_noc_2025.pdf',
      valid_from: '2024-10-01',
      valid_to: dateOffset(-5), // Expired!
      is_expiring_soon: 0,
      verification_status: 'EXPIRED',
      verification_notes: 'Expired 5 days ago. Immediate renewal undertaking required.',
      uploaded_by_user_id: 'usr-inst-01',
      uploaded_at: dateOffset(-20)
    }
  ];

  for (const doc of documents) {
    db.run(
      `INSERT INTO documents (id, institution_id, application_id, document_type, title, file_name, file_size, mime_type, file_path, valid_from, valid_to, is_expiring_soon, verification_status, verification_notes, uploaded_by_user_id, uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [doc.id, doc.institution_id, doc.application_id, doc.document_type, doc.title, doc.file_name, doc.file_size, doc.mime_type, doc.file_path, doc.valid_from, doc.valid_to, doc.is_expiring_soon, doc.verification_status, doc.verification_notes, doc.uploaded_by_user_id, doc.uploaded_at]
    );
  }

  // 8. Seed EVC Visits & Committee Members
  const evcVisits = [
    {
      id: 'evc-001',
      application_id: 'app-003',
      institution_id: 'inst-001',
      regional_officer_id: 'usr-regional-01',
      visit_type: 'SCHEDULED',
      proposed_date: dateOffset(3),
      confirmed_date: dateOffset(3),
      visit_status: 'SCHEDULED',
      outcome: 'PENDING',
      infrastructure_score: null,
      lab_compliance_score: null,
      faculty_presence_ratio: null,
      report_summary: null,
      recommendations: null,
      conducted_at: null,
      created_at: dateOffset(-2)
    }
  ];

  for (const v of evcVisits) {
    db.run(
      `INSERT INTO evc_visits (id, application_id, institution_id, regional_officer_id, visit_type, proposed_date, confirmed_date, visit_status, outcome, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [v.id, v.application_id, v.institution_id, v.regional_officer_id, v.visit_type, v.proposed_date, v.confirmed_date, v.visit_status, v.outcome, v.created_at]
    );
  }

  const evcMembers = [
    {
      id: 'mbr-001',
      visit_id: 'evc-001',
      member_name: 'Dr. Anand M. Joshi',
      role_in_committee: 'CHAIRMAN',
      affiliation: 'Former Dean, IIT Bombay',
      email: 'a.joshi@iitb.ac.in',
      phone: '+91 9820112233',
      visit_date: dateOffset(3).split('T')[0],
      is_confirmed: 1
    },
    {
      id: 'mbr-002',
      visit_id: 'evc-001',
      member_name: 'Prof. Sunita Deshpande',
      role_in_committee: 'SUBJECT_EXPERT',
      affiliation: 'HOD Computer Engineering, COEP Pune',
      email: 's.deshpande@coep.ac.in',
      phone: '+91 9422334455',
      visit_date: dateOffset(3).split('T')[0],
      is_confirmed: 1
    },
    {
      id: 'mbr-003',
      visit_id: 'evc-001',
      member_name: 'Er. Nitin G. Kale',
      role_in_committee: 'PWD_ARCHITECT_EXPERT',
      affiliation: 'Chief Architect, Maharashtra PWD Division',
      email: 'ng.kale@pwd.maharashtra.gov.in',
      phone: '+91 9890123456',
      visit_date: dateOffset(3).split('T')[0],
      is_confirmed: 1
    }
  ];

  for (const m of evcMembers) {
    db.run(
      `INSERT INTO evc_committee_members (id, visit_id, member_name, role_in_committee, affiliation, email, phone, visit_date, is_confirmed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [m.id, m.visit_id, m.member_name, m.role_in_committee, m.affiliation, m.email, m.phone, m.visit_date, m.is_confirmed]
    );
  }

  // 9. Seed Compliance Undertakings
  const undertakings = [
    {
      id: 'und-001',
      institution_id: 'inst-001',
      application_id: 'app-001',
      title: 'Barrier-Free Campus: Tactile Paving & Wheelchair Ramp Completion',
      category: 'INFRASTRUCTURE',
      description: 'Undertaking to complete barrier-free tactile paving and dedicated elevator access for disabled students in the new Technology Block.',
      submission_date: dateOffset(-20),
      deadline_date: dateOffset(15),
      status: 'ACTIVE',
      proof_document_id: null,
      penalty_applicable: 1,
      notes: '60% civil work completed. Final inspection due in 15 days.',
      created_at: dateOffset(-20)
    },
    {
      id: 'und-002',
      institution_id: 'inst-001',
      application_id: 'app-002',
      title: 'Faculty Cadre Regularization (Professor appointment in Data Science)',
      category: 'FACULTY_CADRE',
      description: 'Formal undertaking submitted to university selection board to hire 2 full-time regular professors as per AICTE cadre norms.',
      submission_date: dateOffset(-30),
      deadline_date: dateOffset(-5), // OVERDUE
      status: 'OVERDUE',
      proof_document_id: null,
      penalty_applicable: 1,
      notes: 'Selection committee interviews concluded on 15th; formal appointment letters awaiting syndicate ratifying.',
      created_at: dateOffset(-30)
    }
  ];

  for (const u of undertakings) {
    db.run(
      `INSERT INTO compliance_undertakings (id, institution_id, application_id, title, category, description, submission_date, deadline_date, status, proof_document_id, penalty_applicable, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [u.id, u.institution_id, u.application_id, u.title, u.category, u.description, u.submission_date, u.deadline_date, u.status, u.proof_document_id, u.penalty_applicable, u.notes, u.created_at]
    );
  }

  // 10. Seed Notifications
  const notifications = [
    {
      id: 'notif-001',
      recipient_user_id: 'usr-scrutiny-01',
      recipient_role: 'SCRUTINY_OFFICER',
      title: 'Approaching Deadline: Application AICTE/2026-27/WR/8042',
      message: 'Scrutiny deadline expires in less than 48 hours for VJTI Mumbai (Increase in Intake). Please finalize observation.',
      notification_type: 'DEADLINE_WARNING',
      reference_type: 'APPLICATION',
      reference_id: 'app-001',
      is_read: 0,
      channel: 'IN_APP',
      delivery_status: 'DELIVERED',
      sent_at: dateOffset(-1),
      created_at: dateOffset(-1)
    },
    {
      id: 'notif-002',
      recipient_user_id: 'usr-inst-01',
      recipient_role: 'INSTITUTION',
      title: 'Application Returned for Correction: AICTE/2026-27/WR/7890',
      message: 'Scrutiny Officer Dr. Rajesh K. Sharma returned your application with 2 deficiencies. Please submit rectifications within 5 days.',
      notification_type: 'CORRECTION_REQUIRED',
      reference_type: 'APPLICATION',
      reference_id: 'app-002',
      is_read: 0,
      channel: 'IN_APP',
      delivery_status: 'DELIVERED',
      sent_at: dateOffset(-2),
      created_at: dateOffset(-2)
    },
    {
      id: 'notif-003',
      recipient_user_id: 'usr-admin-01',
      recipient_role: 'ADMIN',
      title: 'Escalation Notice: Overdue Scrutiny Case AICTE/2026-27/SW/3199',
      message: 'Application for Bengaluru Academy has exceeded the 7-day scrutiny limit without officer action. Auto-escalated to Director.',
      notification_type: 'OVERDUE_ESCALATION',
      reference_type: 'APPLICATION',
      reference_id: 'app-005',
      is_read: 0,
      channel: 'N8N_WEBHOOK',
      delivery_status: 'SENT',
      sent_at: dateOffset(-1),
      created_at: dateOffset(-1)
    }
  ];

  for (const n of notifications) {
    db.run(
      `INSERT INTO notifications (id, recipient_user_id, recipient_role, title, message, notification_type, reference_type, reference_id, is_read, channel, delivery_status, sent_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [n.id, n.recipient_user_id, n.recipient_role, n.title, n.message, n.notification_type, n.reference_type, n.reference_id, n.is_read, n.channel, n.delivery_status, n.sent_at, n.created_at]
    );
  }

  // 11. Seed System Audit Logs
  const auditLogs = [
    {
      id: 'aud-001',
      actor_user_id: 'usr-inst-01',
      actor_name: 'Dr. Sachin V. Patel',
      actor_role: 'INSTITUTION',
      action: 'SUBMIT_APPLICATION',
      entity_type: 'APPLICATION',
      entity_id: 'app-001',
      previous_state: 'DRAFT',
      new_state: 'SUBMITTED',
      ip_address: '103.21.124.5',
      notes: 'Application AICTE/2026-27/WR/8042 submitted with 4 verified documents.',
      created_at: dateOffset(-3)
    },
    {
      id: 'aud-002',
      actor_user_id: 'usr-admin-01',
      actor_name: 'Shri P. V. Raman',
      actor_role: 'ADMIN',
      action: 'ASSIGN_WORKFLOW_AND_OFFICER',
      entity_type: 'APPLICATION',
      entity_id: 'app-001',
      previous_state: 'SUBMITTED',
      new_state: 'UNDER_SCRUTINY',
      ip_address: '14.139.60.10',
      notes: 'Assigned workflow template SCRUTINY_EVC (v2) and assigned officer Dr. Rajesh K. Sharma.',
      created_at: dateOffset(-3)
    },
    {
      id: 'aud-003',
      actor_user_id: 'usr-scrutiny-01',
      actor_name: 'Dr. Rajesh K. Sharma',
      actor_role: 'SCRUTINY_OFFICER',
      action: 'RETURN_APPLICATION_FOR_CORRECTION',
      entity_type: 'APPLICATION',
      entity_id: 'app-002',
      previous_state: 'UNDER_SCRUTINY',
      new_state: 'CORRECTION_REQUIRED',
      ip_address: '14.139.60.18',
      notes: 'Recorded 2 deficiencies in building completion and faculty cadre ratio.',
      created_at: dateOffset(-2)
    }
  ];

  for (const a of auditLogs) {
    db.run(
      `INSERT INTO audit_logs (id, actor_user_id, actor_name, actor_role, action, entity_type, entity_id, previous_state, new_state, ip_address, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [a.id, a.actor_user_id, a.actor_name, a.actor_role, a.action, a.entity_type, a.entity_id, a.previous_state, a.new_state, a.ip_address, a.notes, a.created_at]
    );
  }

  // 12. Seed Sample Integration Events
  const integrationEvents = [
    {
      id: 'evt-001',
      event_type: 'DEADLINE_BREACHED',
      payload_json: JSON.stringify({
        application_id: 'app-005',
        application_number: 'AICTE/2026-27/SW/3199',
        institution_name: 'Bengaluru Academy of Technology and Management',
        stage: 'STAGE_SCRUTINY',
        days_overdue: 3,
        escalation_level: 'DIRECTOR_APPROVAL',
        responsible_officer: 'Dr. Rajesh K. Sharma'
      }),
      status: 'PROCESSED',
      delivery_attempts: 1,
      last_attempt_at: dateOffset(-1),
      error_message: null,
      created_at: dateOffset(-1)
    },
    {
      id: 'evt-002',
      event_type: 'EVC_SCHEDULED',
      payload_json: JSON.stringify({
        application_id: 'app-003',
        application_number: 'AICTE/2026-27/WR/6521',
        institution_name: 'Veermata Jijabai Technical Institute (VJTI)',
        visit_date: dateOffset(3).split('T')[0],
        committee_size: 3
      }),
      status: 'PROCESSED',
      delivery_attempts: 1,
      last_attempt_at: dateOffset(-2),
      error_message: null,
      created_at: dateOffset(-2)
    }
  ];

  for (const e of integrationEvents) {
    db.run(
      `INSERT INTO integration_events (id, event_type, payload_json, status, delivery_attempts, last_attempt_at, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [e.id, e.event_type, e.payload_json, e.status, e.delivery_attempts, e.last_attempt_at, e.error_message, e.created_at]
    );
  }

  console.log('Seed data successfully committed.');
}
