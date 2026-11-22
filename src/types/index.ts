export type UserRole = 'INSTITUTION' | 'SCRUTINY_OFFICER' | 'REGIONAL_OFFICER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  designation?: string;
  department?: string;
  region?: string;
  institution_id?: string;
  institution?: Institution;
  created_at?: string;
  last_login_at?: string;
}

export interface Institution {
  id: string;
  permanent_id: string;
  name: string;
  region: string;
  address: string;
  state: string;
  city: string;
  pincode: string;
  establishment_year: number;
  institution_type: string;
  land_area_acres: number;
  built_up_area_sqm: number;
  principal_name: string;
  principal_email: string;
  principal_phone: string;
  compliance_status: 'COMPLIANT' | 'ACTION_REQUIRED' | 'DEFICIENT';
  created_at: string;
}

export interface WorkflowStageDef {
  code: string;
  name: string;
  required_role: UserRole;
  deadline_days: number;
  allow_return: boolean;
  next_stage: string | null;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  code: string;
  description: string;
  version: number;
  stages_json?: string;
  stages?: WorkflowStageDef[];
  is_active: number;
  created_at: string;
}

export interface Application {
  id: string;
  application_number: string;
  institution_id: string;
  academic_year: string;
  application_type: 'EOA' | 'INCREASE_INTAKE' | 'NEW_COURSE' | 'NEW_INSTITUTION' | 'CLOSURE';
  workflow_template_id: string;
  workflow_template_name?: string;
  workflow_rule_version: number;
  current_stage_code: string;
  status:
    | 'DRAFT'
    | 'SUBMITTED'
    | 'UNDER_SCRUTINY'
    | 'CORRECTION_REQUIRED'
    | 'RESUBMITTED'
    | 'UNDER_EVC'
    | 'EVC_COMPLETED'
    | 'UNDER_SAC_SHC'
    | 'RECOMMENDED'
    | 'REJECTED'
    | 'APPROVED';
  assigned_scrutiny_officer_id?: string;
  assigned_regional_officer_id?: string;
  assigned_region: string;
  submitted_at?: string;
  stage_deadline_at?: string;
  overall_deadline_at?: string;
  final_decision?: 'APPROVED' | 'REJECTED';
  final_decision_at?: string;
  final_decision_remarks?: string;
  created_at: string;
  updated_at: string;
  // Joins
  institution_name?: string;
  permanent_id?: string;
  city?: string;
  state?: string;
  institution_region?: string;
  institution_type?: string;
  establishment_year?: number;
  land_area_acres?: number;
  built_up_area_sqm?: number;
  principal_name?: string;
  principal_email?: string;
  principal_phone?: string;
  scrutiny_officer_name?: string;
  regional_officer_name?: string;
  stagesConfig?: WorkflowStageDef[];
  history?: StageHistoryItem[];
  deficiencies?: Deficiency[];
  documents?: DocumentItem[];
  evcVisits?: EvcVisit[];
  evcMembers?: EvcMember[];
}

export interface StageHistoryItem {
  id: string;
  application_id: string;
  stage_code: string;
  stage_name: string;
  actor_user_id: string;
  actor_name: string;
  actor_role: UserRole;
  action: 'SUBMIT' | 'ASSIGN' | 'OBSERVE' | 'RETURN_FOR_CORRECTION' | 'RESUBMIT' | 'SCHEDULE_EVC' | 'COMPLETE_STAGE' | 'APPROVE' | 'REJECT';
  previous_status?: string;
  new_status?: string;
  reason?: string;
  notes?: string;
  created_at: string;
}

export interface Deficiency {
  id: string;
  application_id: string;
  stage_code: string;
  category: 'DOCUMENT' | 'INFRASTRUCTURE' | 'FACULTY' | 'FINANCIAL' | 'REGULATORY';
  description: string;
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
  status: 'OPEN' | 'ADDRESSED' | 'VERIFIED' | 'WAIVED';
  raised_by_user_id: string;
  raised_by_name: string;
  raised_at: string;
  institutional_response?: string;
  response_document_id?: string;
  responded_at?: string;
  resolved_by_user_id?: string;
  resolved_at?: string;
}

export interface DocumentItem {
  id: string;
  institution_id: string;
  application_id?: string;
  document_type: string;
  title: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  file_path: string;
  valid_from: string;
  valid_to: string;
  is_expiring_soon: number;
  verification_status: 'PENDING' | 'VERIFIED' | 'DEFICIENT' | 'EXPIRED';
  verification_notes?: string;
  uploaded_by_user_id: string;
  uploaded_at: string;
  institution_name?: string;
}

export interface EvcVisit {
  id: string;
  application_id: string;
  institution_id: string;
  regional_officer_id: string;
  visit_type: 'SCHEDULED' | 'SURPRISE' | 'VIRTUAL';
  proposed_date: string;
  confirmed_date?: string;
  visit_status: 'PROPOSED' | 'SCHEDULED' | 'CONDUCTED' | 'REPORT_SUBMITTED' | 'CANCELLED';
  outcome: 'RECOMMENDED' | 'DEFICIENCIES_OBSERVED' | 'NOT_RECOMMENDED' | 'PENDING';
  infrastructure_score?: number;
  lab_compliance_score?: number;
  faculty_presence_ratio?: number;
  report_summary?: string;
  recommendations?: string;
  conducted_at?: string;
  created_at: string;
  application_number?: string;
  application_type?: string;
  institution_name?: string;
  region?: string;
  committee_members?: EvcMember[];
}

export interface EvcMember {
  id: string;
  visit_id: string;
  member_name: string;
  role_in_committee: 'CHAIRMAN' | 'SUBJECT_EXPERT' | 'PWD_ARCHITECT_EXPERT' | 'INDUSTRY_EXPERT';
  affiliation: string;
  email: string;
  phone: string;
  visit_date: string;
  is_confirmed: number;
}

export interface ComplianceUndertaking {
  id: string;
  institution_id: string;
  application_id?: string;
  title: string;
  category: 'INFRASTRUCTURE' | 'FACULTY_CADRE' | 'LAB_EQUIPMENT' | 'LIBRARY_RESOURCES' | 'SAFETY_AUDIT';
  description: string;
  submission_date: string;
  deadline_date: string;
  status: 'ACTIVE' | 'SUBMITTED_FOR_REVIEW' | 'COMPLIED' | 'OVERDUE';
  proof_document_id?: string;
  penalty_applicable: number;
  notes?: string;
  created_at: string;
  institution_name?: string;
  application_number?: string;
}

export interface NotificationItem {
  id: string;
  recipient_user_id?: string;
  recipient_role?: string;
  title: string;
  message: string;
  notification_type: 'DEADLINE_WARNING' | 'STAGE_ADVANCED' | 'CORRECTION_REQUIRED' | 'EVC_SCHEDULED' | 'DOCUMENT_EXPIRING' | 'OVERDUE_ESCALATION' | 'EXTERNAL_DELIVERY';
  reference_type?: string;
  reference_id?: string;
  is_read: number;
  channel: string;
  delivery_status: string;
  sent_at: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_user_id: string;
  actor_name: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  previous_state?: string;
  new_state?: string;
  ip_address?: string;
  notes?: string;
  created_at: string;
}

export interface AnalyticsSummary {
  kpis: {
    totalApplications: number;
    pendingApplications: number;
    overdueApplications: number;
    completedApplications: number;
    awaitingCorrection: number;
    scheduledEvcVisits: number;
    expiringDocsCount: number;
    expiredDocsCount: number;
    overdueComplianceCount: number;
  };
  stagePendency: Array<{ stage: string; count: number }>;
  regionWorkload: Array<{ region: string; count: number; pending_count: number; overdue_count: number }>;
  ageing: {
    under7Days: number;
    days7to15: number;
    days15to30: number;
    over30Days: number;
  };
  upcomingDeadlines: Array<{
    id: string;
    application_number: string;
    application_type: string;
    current_stage_code: string;
    status: string;
    stage_deadline_at: string;
    institution_name: string;
    region: string;
  }>;
}
