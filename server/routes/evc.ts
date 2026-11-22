import { queryOne, queryAll, runSql } from '../db.js';
import { authenticate, AuthenticatedRequest, requireRole, logAuditEvent, recordIntegrationEvent } from '../auth.js';

declare module '../auth.js' {
  interface AuthenticatedRequest {
    body: any;
    params: Record<string, string>;
  }
}

interface Response {
  status(code: number): Response;
  json(body: unknown): void;
}

// Resolve Express without requiring a local Express type package at compile time.
const express = eval('require')('express') as { Router: () => any };

export const evcRouter = express.Router();

// Get all EVC visits
evcRouter.get('/visits', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  let query = `
    SELECT v.*,
           a.application_number, a.application_type, a.status as application_status,
           i.name as institution_name, i.permanent_id, i.region, i.city, i.state,
           u.full_name as regional_officer_name
    FROM evc_visits v
    JOIN applications a ON v.application_id = a.id
    JOIN institutions i ON v.institution_id = i.id
    LEFT JOIN users u ON v.regional_officer_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (user.role === 'INSTITUTION') {
    query += ' AND v.institution_id = ?';
    params.push(user.institution_id);
  } else if (user.role === 'REGIONAL_OFFICER') {
    if (user.region && user.region !== 'National') {
      query += ' AND i.region = ?';
      params.push(user.region);
    }
  }

  query += ' ORDER BY v.proposed_date ASC';

  const visits = queryAll<any>(query, params);

  // Fetch committee members for each visit
  const visitIds = visits.map(v => v.id);
  let allMembers: any[] = [];
  if (visitIds.length > 0) {
    allMembers = queryAll(
      `SELECT * FROM evc_committee_members WHERE visit_id IN (${visitIds.map(() => '?').join(',')})`,
      visitIds
    );
  }

  const visitsWithMembers = visits.map(v => ({
    ...v,
    committee_members: allMembers.filter(m => m.visit_id === v.id)
  }));

  res.json({ visits: visitsWithMembers });
});

// Check committee member scheduling conflicts
evcRouter.get('/check-conflict', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  const { date, member_emails } = req.query;
  if (!date || !member_emails) {
    res.json({ conflicts: [] });
    return;
  }

  const dateStr = String(date).split('T')[0];
  const emails = String(member_emails).split(',').map(e => e.trim().toLowerCase());

  const conflicts = queryAll<any>(
    `SELECT m.member_name, m.email, m.visit_date, m.affiliation, v.application_id, i.name as institution_name
     FROM evc_committee_members m
     JOIN evc_visits v ON m.visit_id = v.id
     JOIN institutions i ON v.institution_id = i.id
     WHERE m.visit_date = ? AND LOWER(m.email) IN (${emails.map(() => '?').join(',')})`,
    [dateStr, ...emails]
  );

  res.json({ conflicts });
});

// Schedule new EVC visit
evcRouter.post('/visits', authenticate, requireRole('REGIONAL_OFFICER', 'ADMIN'), (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const {
    application_id,
    visit_type = 'SCHEDULED',
    proposed_date,
    confirmed_date,
    committee_members = []
  } = req.body;

  if (!application_id || !proposed_date) {
    res.status(400).json({ error: 'Application ID and proposed visit date are required.' });
    return;
  }

  const app = queryOne<any>(
    'SELECT a.*, i.name as institution_name FROM applications a JOIN institutions i ON a.institution_id = i.id WHERE a.id = ?',
    [application_id]
  );
  if (!app) {
    res.status(404).json({ error: 'Application not found.' });
    return;
  }

  // Conflict check for members on confirmed date
  const targetDate = (confirmed_date || proposed_date).split('T')[0];
  const memberEmails = committee_members.map((m: any) => (m.email || '').trim().toLowerCase()).filter(Boolean);

  if (memberEmails.length > 0) {
    const conflicts = queryAll<any>(
      `SELECT m.member_name, m.email, i.name as booked_institution
       FROM evc_committee_members m
       JOIN evc_visits v ON m.visit_id = v.id
       JOIN institutions i ON v.institution_id = i.id
       WHERE m.visit_date = ? AND LOWER(m.email) IN (${memberEmails.map(() => '?').join(',')})`,
      [targetDate, ...memberEmails]
    );

    if (conflicts.length > 0) {
      res.status(409).json({
        error: `Scheduling Conflict: ${conflicts[0].member_name} (${conflicts[0].email}) is already assigned to an inspection at ${conflicts[0].booked_institution} on ${targetDate}.`
      });
      return;
    }
  }

  const visitId = `evc-${Date.now()}`;
  const now = new Date().toISOString();

  runSql(
    `INSERT INTO evc_visits (
       id, application_id, institution_id, regional_officer_id, visit_type,
       proposed_date, confirmed_date, visit_status, outcome, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', 'PENDING', ?)`,
    [
      visitId,
      application_id,
      app.institution_id,
      user.id,
      visit_type,
      proposed_date,
      confirmed_date || proposed_date,
      now
    ]
  );

  // Insert committee members
  for (const m of committee_members) {
    if (!m.member_name) continue;
    const memberId = `mbr-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    runSql(
      `INSERT INTO evc_committee_members (
         id, visit_id, member_name, role_in_committee, affiliation, email, phone, visit_date, is_confirmed
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        memberId,
        visitId,
        m.member_name,
        m.role_in_committee || 'SUBJECT_EXPERT',
        m.affiliation || 'University Department',
        m.email || 'expert@institution.ac.in',
        m.phone || '+91 9800000000',
        targetDate
      ]
    );
  }

  // Record stage history
  runSql(
    `INSERT INTO application_stages_history (
       id, application_id, stage_code, stage_name, actor_user_id, actor_name, actor_role,
       action, previous_status, new_status, reason, notes, created_at
     ) VALUES (?, ?, 'STAGE_EVC', 'Expert Visiting Committee (EVC)', ?, ?, ?, 'SCHEDULE_EVC', ?, ?, NULL, ?, ?)`,
    [
      `hist-${Date.now()}`,
      application_id,
      user.id,
      user.full_name,
      user.role,
      app.status,
      'UNDER_EVC',
      `EVC inspection scheduled for ${targetDate} with ${committee_members.length} committee experts.`,
      now
    ]
  );

  logAuditEvent(user, 'SCHEDULE_EVC_VISIT', 'EVC_VISIT', visitId, {
    notes: `Scheduled ${visit_type} visit for ${app.application_number} on ${targetDate}`
  });

  recordIntegrationEvent('EVC_SCHEDULED', {
    visit_id: visitId,
    application_id,
    application_number: app.application_number,
    institution_name: app.institution_name,
    target_date: targetDate,
    committee_count: committee_members.length
  });

  res.status(201).json({
    message: 'Expert Visiting Committee visit scheduled successfully.',
    visit_id: visitId
  });
});

// Record EVC Visit Outcome and Inspection Checklist
evcRouter.post('/visits/:id/record-outcome', authenticate, requireRole('REGIONAL_OFFICER', 'ADMIN'), (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const { id } = req.params;
  const {
    outcome,
    infrastructure_score = 90,
    lab_compliance_score = 85,
    faculty_presence_ratio = 95,
    report_summary,
    recommendations,
    advance_stage = true
  } = req.body;

  if (!outcome || !['RECOMMENDED', 'DEFICIENCIES_OBSERVED', 'NOT_RECOMMENDED'].includes(outcome)) {
    res.status(400).json({ error: 'Valid outcome required: RECOMMENDED, DEFICIENCIES_OBSERVED, or NOT_RECOMMENDED.' });
    return;
  }

  if (!report_summary || report_summary.trim().length < 10) {
    res.status(400).json({ error: 'Inspection report summary must be at least 10 characters.' });
    return;
  }

  const visit = queryOne<any>(
    'SELECT v.*, a.application_number, a.workflow_template_id, a.stages_json, i.name as institution_name FROM evc_visits v JOIN applications a ON v.application_id = a.id JOIN institutions i ON v.institution_id = i.id WHERE v.id = ?',
    [id]
  );
  if (!visit) {
    res.status(404).json({ error: 'EVC visit not found.' });
    return;
  }

  const now = new Date().toISOString();

  runSql(
    `UPDATE evc_visits
     SET visit_status = 'REPORT_SUBMITTED', outcome = ?,
         infrastructure_score = ?, lab_compliance_score = ?, faculty_presence_ratio = ?,
         report_summary = ?, recommendations = ?, conducted_at = COALESCE(conducted_at, ?)
     WHERE id = ?`,
    [
      outcome,
      infrastructure_score,
      lab_compliance_score,
      faculty_presence_ratio,
      report_summary,
      recommendations || '',
      now,
      id
    ]
  );

  // If advance_stage is selected and outcome is RECOMMENDED, move application forward
  if (advance_stage) {
    let nextStageCode = 'STAGE_FINAL_APPROVAL';
    let nextStatus = outcome === 'RECOMMENDED' ? 'RECOMMENDED' : 'DEFICIENCIES_OBSERVED';

    runSql(
      'UPDATE applications SET current_stage_code = ?, status = ?, updated_at = ? WHERE id = ?',
      [nextStageCode, nextStatus, now, visit.application_id]
    );

    runSql(
      `INSERT INTO application_stages_history (
         id, application_id, stage_code, stage_name, actor_user_id, actor_name, actor_role,
         action, previous_status, new_status, reason, notes, created_at
       ) VALUES (?, ?, 'STAGE_EVC', 'Expert Visiting Committee (EVC)', ?, ?, ?, 'COMPLETE_STAGE', 'UNDER_EVC', ?, NULL, ?, ?)`,
      [
        `hist-${Date.now()}`,
        visit.application_id,
        user.id,
        user.full_name,
        user.role,
        nextStatus,
        `EVC report filed: ${outcome}. Summary: ${report_summary}`,
        now
      ]
    );
  }

  logAuditEvent(user, 'RECORD_EVC_OUTCOME', 'EVC_VISIT', id, {
    newState: outcome,
    notes: `Report filed: ${outcome}. Scores: Infra ${infrastructure_score}%, Labs ${lab_compliance_score}%, Faculty ${faculty_presence_ratio}%`
  });

  res.json({ message: 'EVC visit inspection report and outcome recorded successfully.' });
});
