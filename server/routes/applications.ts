declare const require: any;

type Response = {
  status(code: number): Response;
  json(body?: any): void;
};

const express = require('express');
import { queryOne, queryAll, runSql } from '../db.js';
import { authenticate, AuthenticatedRequest, requireRole, logAuditEvent, recordIntegrationEvent } from '../auth.js';

declare module '../auth.js' {
  interface AuthenticatedRequest {
    params: Record<string, string>;
    query: Record<string, any>;
    body: any;
  }
}

export const applicationsRouter = express.Router();

// List applications with search & filters
applicationsRouter.get('/', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const { type, region, stage, status, overdueOnly, search } = req.query;

  let query = `
    SELECT a.*,
           i.name as institution_name, i.permanent_id, i.city, i.state, i.region as institution_region,
           wt.name as workflow_template_name,
           u_scrutiny.full_name as scrutiny_officer_name,
           u_regional.full_name as regional_officer_name
    FROM applications a
    JOIN institutions i ON a.institution_id = i.id
    LEFT JOIN workflow_templates wt ON a.workflow_template_id = wt.id
    LEFT JOIN users u_scrutiny ON a.assigned_scrutiny_officer_id = u_scrutiny.id
    LEFT JOIN users u_regional ON a.assigned_regional_officer_id = u_regional.id
    WHERE 1=1
  `;
  const params: any[] = [];

  // Role scoping
  if (user.role === 'INSTITUTION') {
    query += ' AND a.institution_id = ?';
    params.push(user.institution_id || 'none');
  } else if (user.role === 'SCRUTINY_OFFICER') {
    if (user.region && user.region !== 'National') {
      query += ' AND (a.assigned_scrutiny_officer_id = ? OR a.assigned_region = ?)';
      params.push(user.id, user.region);
    }
  } else if (user.role === 'REGIONAL_OFFICER') {
    if (user.region && user.region !== 'National') {
      query += ' AND a.assigned_region = ?';
      params.push(user.region);
    }
  }

  // Filters
  if (type) {
    query += ' AND a.application_type = ?';
    params.push(type);
  }
  if (region) {
    query += ' AND a.assigned_region = ?';
    params.push(region);
  }
  if (stage) {
    query += ' AND a.current_stage_code = ?';
    params.push(stage);
  }
  if (status) {
    query += ' AND a.status = ?';
    params.push(status);
  }
  if (overdueOnly === 'true') {
    query += ' AND a.stage_deadline_at < ? AND a.status NOT IN (\'APPROVED\', \'REJECTED\')';
    params.push(new Date().toISOString());
  }
  if (search) {
    query += ' AND (a.application_number LIKE ? OR i.name LIKE ? OR i.permanent_id LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  query += ' ORDER BY a.updated_at DESC';

  const rows = queryAll(query, params);
  res.json({ applications: rows });
});

// Get application by ID with full details
applicationsRouter.get('/:id', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const { id } = req.params;

  const app = queryOne<any>(
    `SELECT a.*,
            i.name as institution_name, i.permanent_id, i.address, i.city, i.state, i.pincode,
            i.establishment_year, i.institution_type, i.land_area_acres, i.built_up_area_sqm,
            i.principal_name, i.principal_email, i.principal_phone,
            wt.name as workflow_template_name, wt.stages_json, wt.code as workflow_code,
            u_scrutiny.full_name as scrutiny_officer_name, u_scrutiny.email as scrutiny_officer_email,
            u_regional.full_name as regional_officer_name, u_regional.email as regional_officer_email
     FROM applications a
     JOIN institutions i ON a.institution_id = i.id
     LEFT JOIN workflow_templates wt ON a.workflow_template_id = wt.id
     LEFT JOIN users u_scrutiny ON a.assigned_scrutiny_officer_id = u_scrutiny.id
     LEFT JOIN users u_regional ON a.assigned_regional_officer_id = u_regional.id
     WHERE a.id = ?`,
    [id]
  );

  if (!app) {
    res.status(404).json({ error: 'Application record not found.' });
    return;
  }

  // Ownership check for institutions
  if (user.role === 'INSTITUTION' && app.institution_id !== user.institution_id) {
    res.status(403).json({ error: 'Unauthorized access to another institution application.' });
    return;
  }

  // Parse stages json
  let stagesConfig = [];
  try {
    stagesConfig = JSON.parse(app.stages_json || '[]');
  } catch (e) {
    stagesConfig = [];
  }

  // Fetch stage history
  const history = queryAll(
    'SELECT * FROM application_stages_history WHERE application_id = ? ORDER BY created_at ASC',
    [id]
  );

  // Fetch deficiencies
  const deficiencies = queryAll(
    'SELECT * FROM application_deficiencies WHERE application_id = ? ORDER BY raised_at DESC',
    [id]
  );

  // Fetch attached documents
  const documents = queryAll(
    'SELECT * FROM documents WHERE application_id = ? ORDER BY uploaded_at DESC',
    [id]
  );

  // Fetch EVC visits if any
  const evcVisits = queryAll(
    'SELECT * FROM evc_visits WHERE application_id = ? ORDER BY created_at DESC',
    [id]
  );

  // Fetch committee members if visit exists
  let evcMembers: any[] = [];
  if (evcVisits.length > 0) {
    evcMembers = queryAll(
      'SELECT * FROM evc_committee_members WHERE visit_id = ? ORDER BY id ASC',
      [evcVisits[0].id]
    );
  }

  res.json({
    application: {
      ...app,
      stagesConfig,
      history,
      deficiencies,
      documents,
      evcVisits,
      evcMembers
    }
  });
});

// Create new approval application
applicationsRouter.post('/', authenticate, requireRole('INSTITUTION', 'ADMIN'), (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const {
    application_type,
    academic_year = '2026-27',
    workflow_template_id = 'tmpl-scrutiny-evc',
    notes = ''
  } = req.body;

  let institutionId = user.institution_id;
  if (user.role === 'ADMIN' && req.body.institution_id) {
    institutionId = req.body.institution_id;
  }

  if (!institutionId) {
    res.status(400).json({ error: 'Institution ID is required.' });
    return;
  }

  const inst = queryOne<any>('SELECT * FROM institutions WHERE id = ?', [institutionId]);
  if (!inst) {
    res.status(404).json({ error: 'Associated institution not found.' });
    return;
  }

  const template = queryOne<any>('SELECT * FROM workflow_templates WHERE id = ?', [workflow_template_id]);
  if (!template) {
    res.status(400).json({ error: 'Selected workflow template does not exist.' });
    return;
  }

  // Parse template to get first stage deadline
  let stages = [];
  try {
    stages = JSON.parse(template.stages_json);
  } catch (e) {
    stages = [];
  }
  const firstStage = stages[0] || { code: 'STAGE_SCRUTINY', deadline_days: 7 };

  const now = new Date();
  const deadlineDays = firstStage.deadline_days || 7;
  const stageDeadline = new Date(now.getTime() + deadlineDays * 24 * 60 * 60 * 1000).toISOString();
  const overallDeadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // Generate Reference Number: AICTE/{YEAR}/{REGION_CODE}/{RAND_SEQ}
  const regionMap: Record<string, string> = {
    Western: 'WR',
    Northern: 'NR',
    'South-Western': 'SW',
    Southern: 'SR',
    Eastern: 'ER',
    Central: 'CR',
    'North-West': 'NWR'
  };
  const regCode = regionMap[inst.region] || 'HO';
  const seq = Math.floor(1000 + Math.random() * 9000);
  const appNumber = `AICTE/${academic_year}/${regCode}/${seq}`;
  const appId = `app-${Date.now().toString().slice(-6)}`;

  // Default scrutiny officer assignment for region
  const officer = queryOne<any>(
    'SELECT id FROM users WHERE role = \'SCRUTINY_OFFICER\' AND (region = ? OR region = \'National\') LIMIT 1',
    [inst.region]
  );
  const regionalOfficer = queryOne<any>(
    'SELECT id FROM users WHERE role = \'REGIONAL_OFFICER\' AND (region = ? OR region = \'National\') LIMIT 1',
    [inst.region]
  );

  runSql(
    `INSERT INTO applications (
       id, application_number, institution_id, academic_year, application_type,
       workflow_template_id, workflow_rule_version, current_stage_code, status,
       assigned_scrutiny_officer_id, assigned_regional_officer_id, assigned_region,
       submitted_at, stage_deadline_at, overall_deadline_at, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      appId,
      appNumber,
      inst.id,
      academic_year,
      application_type,
      template.id,
      template.version,
      firstStage.code || 'STAGE_SCRUTINY',
      'UNDER_SCRUTINY',
      officer?.id || 'usr-scrutiny-01',
      regionalOfficer?.id || 'usr-regional-01',
      inst.region,
      now.toISOString(),
      stageDeadline,
      overallDeadline,
      now.toISOString(),
      now.toISOString()
    ]
  );

  // Link any pre-existing or default prescribed documents to this new application
  const existingDocs = queryAll<any>('SELECT id FROM documents WHERE institution_id = ? AND application_id IS NULL', [inst.id]);
  for (const doc of existingDocs) {
    runSql('UPDATE documents SET application_id = ? WHERE id = ?', [appId, doc.id]);
  }

  // Create initial history record
  const histId = `hist-${Date.now()}`;
  runSql(
    `INSERT INTO application_stages_history (
       id, application_id, stage_code, stage_name, actor_user_id, actor_name, actor_role,
       action, previous_status, new_status, reason, notes, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      histId,
      appId,
      firstStage.code || 'STAGE_SCRUTINY',
      firstStage.name || 'Document & Eligibility Scrutiny',
      user.id,
      user.full_name,
      user.role,
      'SUBMIT',
      'DRAFT',
      'UNDER_SCRUTINY',
      null,
      `Submitted ${application_type} application for Academic Year ${academic_year}. ${notes}`,
      now.toISOString()
    ]
  );

  // Create notification for scrutiny officer
  if (officer) {
    runSql(
      `INSERT INTO notifications (id, recipient_user_id, recipient_role, title, message, notification_type, reference_type, reference_id, is_read, channel, delivery_status, sent_at, created_at)
       VALUES (?, ?, 'SCRUTINY_OFFICER', ?, ?, 'STAGE_ADVANCED', 'APPLICATION', ?, 0, 'IN_APP', 'DELIVERED', ?, ?)`,
      [
        `notif-${Date.now()}`,
        officer.id,
        `New Application Assigned: ${appNumber}`,
        `New ${application_type} application from ${inst.name} submitted and ready for scrutiny.`,
        appId,
        now.toISOString(),
        now.toISOString()
      ]
    );
  }

  // Audit log
  logAuditEvent(user, 'SUBMIT_APPLICATION', 'APPLICATION', appId, {
    previousState: 'DRAFT',
    newState: 'UNDER_SCRUTINY',
    notes: `Created & submitted application ${appNumber} under rule version ${template.version}`
  });

  // Integration Event
  recordIntegrationEvent('APPLICATION_SUBMITTED', {
    application_id: appId,
    application_number: appNumber,
    institution_id: inst.id,
    institution_name: inst.name,
    application_type,
    academic_year,
    assigned_region: inst.region,
    stage_deadline_at: stageDeadline
  });

  res.status(201).json({
    message: 'Application created and submitted successfully.',
    application_id: appId,
    application_number: appNumber
  });
});

// Admin assigns workflow template & officers
applicationsRouter.post('/:id/assign', authenticate, requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const { id } = req.params;
  const { workflow_template_id, scrutiny_officer_id, regional_officer_id, notes } = req.body;

  const app = queryOne<any>('SELECT * FROM applications WHERE id = ?', [id]);
  if (!app) {
    res.status(404).json({ error: 'Application not found.' });
    return;
  }

  const template = queryOne<any>('SELECT * FROM workflow_templates WHERE id = ?', [workflow_template_id]);
  const now = new Date().toISOString();

  runSql(
    `UPDATE applications
     SET workflow_template_id = COALESCE(?, workflow_template_id),
         workflow_rule_version = COALESCE(?, workflow_rule_version),
         assigned_scrutiny_officer_id = COALESCE(?, assigned_scrutiny_officer_id),
         assigned_regional_officer_id = COALESCE(?, assigned_regional_officer_id),
         updated_at = ?
     WHERE id = ?`,
    [
      workflow_template_id || null,
      template ? template.version : null,
      scrutiny_officer_id || null,
      regional_officer_id || null,
      now,
      id
    ]
  );

  logAuditEvent(user, 'ASSIGN_WORKFLOW_AND_OFFICER', 'APPLICATION', id, {
    notes: `Updated assignments: Template ${workflow_template_id || app.workflow_template_id}. ${notes || ''}`
  });

  res.json({ message: 'Application assignments updated successfully.' });
});

// Scrutiny Officer Action:
// 1. Observe Deficiencies
// 2. Return for Correction (MANDATORY REASON REQUIRED)
// 3. Complete Scrutiny (Advance to Next Stage)
applicationsRouter.post('/:id/scrutiny-action', authenticate, requireRole('SCRUTINY_OFFICER', 'ADMIN'), (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const { id } = req.params;
  const { action, reason, notes, deficiencies = [] } = req.body;

  const app = queryOne<any>(
    'SELECT a.*, i.name as institution_name, wt.stages_json FROM applications a JOIN institutions i ON a.institution_id = i.id LEFT JOIN workflow_templates wt ON a.workflow_template_id = wt.id WHERE a.id = ?',
    [id]
  );

  if (!app) {
    res.status(404).json({ error: 'Application not found.' });
    return;
  }

  const now = new Date();
  const nowIso = now.toISOString();

  // Case 1: Return for Correction
  if (action === 'RETURN_FOR_CORRECTION') {
    if (!reason || reason.trim().length < 10) {
      res.status(400).json({
        error: 'Mandatory requirement: A clear, specific justification (minimum 10 characters) must be recorded for returning an application for correction.'
      });
      return;
    }

    // Save deficiencies if provided
    for (const def of deficiencies) {
      if (!def.description) continue;
      const defId = `def-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      runSql(
        `INSERT INTO application_deficiencies (
           id, application_id, stage_code, category, description, severity, status,
           raised_by_user_id, raised_by_name, raised_at
         ) VALUES (?, ?, 'STAGE_SCRUTINY', ?, ?, ?, 'OPEN', ?, ?, ?)`,
        [
          defId,
          id,
          def.category || 'DOCUMENT',
          def.description,
          def.severity || 'MAJOR',
          user.id,
          user.full_name,
          nowIso
        ]
      );
    }

    // Update application status to CORRECTION_REQUIRED and set 5-day correction window
    const correctionDeadline = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString();
    runSql(
      'UPDATE applications SET status = \'CORRECTION_REQUIRED\', stage_deadline_at = ?, updated_at = ? WHERE id = ?',
      [correctionDeadline, nowIso, id]
    );

    // Record immutable stage history
    const histId = `hist-${Date.now()}`;
    runSql(
      `INSERT INTO application_stages_history (
         id, application_id, stage_code, stage_name, actor_user_id, actor_name, actor_role,
         action, previous_status, new_status, reason, notes, created_at
       ) VALUES (?, ?, 'STAGE_SCRUTINY', 'Document & Eligibility Scrutiny', ?, ?, ?, 'RETURN_FOR_CORRECTION', ?, 'CORRECTION_REQUIRED', ?, ?, ?)`,
      [histId, id, user.id, user.full_name, user.role, app.status, reason.trim(), notes || null, nowIso]
    );

    // Notify institution user
    runSql(
      `INSERT INTO notifications (id, recipient_user_id, recipient_role, title, message, notification_type, reference_type, reference_id, is_read, channel, delivery_status, sent_at, created_at)
       VALUES (?, NULL, 'INSTITUTION', ?, ?, 'CORRECTION_REQUIRED', 'APPLICATION', ?, 0, 'IN_APP', 'DELIVERED', ?, ?)`,
      [
        `notif-${Date.now()}`,
        `Deficiencies Noted: Application ${app.application_number} Returned`,
        `Scrutiny officer ${user.full_name} returned your application for rectification. Reason: ${reason}. Please submit corrections within 5 days.`,
        id,
        nowIso,
        nowIso
      ]
    );

    logAuditEvent(user, 'RETURN_APPLICATION_FOR_CORRECTION', 'APPLICATION', id, {
      previousState: app.status,
      newState: 'CORRECTION_REQUIRED',
      notes: `Returned with reason: ${reason}`
    });

    recordIntegrationEvent('STAGE_CHANGED', {
      application_id: id,
      application_number: app.application_number,
      institution_name: app.institution_name,
      previous_status: app.status,
      new_status: 'CORRECTION_REQUIRED',
      reason
    });

    res.json({ message: 'Application returned for institutional correction with recorded deficiencies.' });
    return;
  }

  // Case 2: Complete Scrutiny (Advance to next stage in template)
  if (action === 'COMPLETE_SCRUTINY') {
    // Check if open unresolved critical deficiencies remain
    const openCritical = queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM application_deficiencies WHERE application_id = ? AND status = \'OPEN\' AND severity = \'CRITICAL\'',
      [id]
    );
    if (openCritical && openCritical.count > 0) {
      res.status(400).json({
        error: `Cannot complete scrutiny: There are ${openCritical.count} open critical deficiencies that must be addressed or verified first.`
      });
      return;
    }

    // Determine next stage from template
    let stages: any[] = [];
    try {
      stages = JSON.parse(app.stages_json || '[]');
    } catch (e) {
      stages = [];
    }

    const currentStageIndex = stages.findIndex((s: any) => s.code === 'STAGE_SCRUTINY');
    const nextStageDef = stages[currentStageIndex + 1];
    let nextStageCode = nextStageDef?.code || 'STAGE_FINAL_APPROVAL';
    let nextStatus = 'UNDER_EVC';

    if (nextStageCode === 'STAGE_EVC') {
      nextStatus = 'UNDER_EVC';
    } else if (nextStageCode === 'STAGE_SAC_SHC') {
      nextStatus = 'UNDER_SAC_SHC';
    } else if (nextStageCode === 'STAGE_FINAL_APPROVAL') {
      nextStatus = 'RECOMMENDED';
    }

    const nextDeadlineDays = nextStageDef?.deadline_days || 10;
    const nextDeadline = new Date(now.getTime() + nextDeadlineDays * 24 * 60 * 60 * 1000).toISOString();

    runSql(
      'UPDATE applications SET current_stage_code = ?, status = ?, stage_deadline_at = ?, updated_at = ? WHERE id = ?',
      [nextStageCode, nextStatus, nextDeadline, nowIso, id]
    );

    // Auto-resolve any addressed or open non-critical deficiencies
    runSql(
      `UPDATE application_deficiencies
       SET status = 'VERIFIED', resolved_by_user_id = ?, resolved_at = ?
       WHERE application_id = ? AND status IN ('OPEN', 'ADDRESSED')`,
      [user.id, nowIso, id]
    );

    const histId = `hist-${Date.now()}`;
    runSql(
      `INSERT INTO application_stages_history (
         id, application_id, stage_code, stage_name, actor_user_id, actor_name, actor_role,
         action, previous_status, new_status, reason, notes, created_at
       ) VALUES (?, ?, 'STAGE_SCRUTINY', 'Document & Eligibility Scrutiny', ?, ?, ?, 'COMPLETE_STAGE', ?, ?, NULL, ?, ?)`,
      [histId, id, user.id, user.full_name, user.role, app.status, nextStatus, notes || 'Document scrutiny completed successfully.', nowIso]
    );

    // Notify Regional Officer if moving to EVC
    if (app.assigned_regional_officer_id) {
      runSql(
        `INSERT INTO notifications (id, recipient_user_id, recipient_role, title, message, notification_type, reference_type, reference_id, is_read, channel, delivery_status, sent_at, created_at)
         VALUES (?, ?, 'REGIONAL_OFFICER', ?, ?, 'STAGE_ADVANCED', 'APPLICATION', ?, 0, 'IN_APP', 'DELIVERED', ?, ?)`,
        [
          `notif-${Date.now()}`,
          app.assigned_regional_officer_id,
          `Application Advanced to EVC: ${app.application_number}`,
          `Scrutiny cleared for ${app.institution_name}. Please coordinate and schedule Expert Visiting Committee visit.`,
          id,
          nowIso,
          nowIso
        ]
      );
    }

    logAuditEvent(user, 'COMPLETE_SCRUTINY_STAGE', 'APPLICATION', id, {
      previousState: app.status,
      newState: nextStatus,
      notes: `Scrutiny cleared. Advanced to ${nextStageCode}`
    });

    recordIntegrationEvent('STAGE_CHANGED', {
      application_id: id,
      application_number: app.application_number,
      previous_status: app.status,
      new_status: nextStatus,
      next_stage: nextStageCode
    });

    res.json({
      message: `Scrutiny stage completed. Application advanced to ${nextStageCode} (${nextStatus}).`,
      next_stage: nextStageCode,
      status: nextStatus
    });
    return;
  }

  res.status(400).json({ error: 'Invalid scrutiny action specified.' });
});

// Institution Action: Submit Point-by-Point Correction & Resubmit
applicationsRouter.post('/:id/submit-correction', authenticate, requireRole('INSTITUTION', 'ADMIN'), (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const { id } = req.params;
  const { explanations = {}, documentTitles = {}, generalClarification = '' } = req.body;

  const app = queryOne<any>('SELECT * FROM applications WHERE id = ?', [id]);
  if (!app) {
    res.status(404).json({ error: 'Application not found.' });
    return;
  }

  if (user.role === 'INSTITUTION' && app.institution_id !== user.institution_id) {
    res.status(403).json({ error: 'Unauthorized.' });
    return;
  }

  const now = new Date();
  const nowIso = now.toISOString();

  // Update addressed deficiencies
  for (const [defId, explanation] of Object.entries(explanations)) {
    if (!explanation) continue;
    runSql(
      'UPDATE application_deficiencies SET status = \'ADDRESSED\', institutional_response = ?, responded_at = ? WHERE id = ? AND application_id = ?',
      [explanation, nowIso, defId, id]
    );
  }

  // Create simulated correction document record if titles provided
  for (const [defId, title] of Object.entries(documentTitles)) {
    if (!title) continue;
    const docId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    runSql(
      `INSERT INTO documents (lice(2, 6
         id, institution_id, application_id, document_type, title, file_name, file_size, mime_type, file_path,
         valid_from, valid_to, verification_status, uploaded_by_user_id, uploaded_at
       ) VALUES (?, ?, ?, 'DEFICIENCY_RECTIFICATION', ?, ?, 1500000, 'application/pdf', ?, ?, ?, 'PENDING', ?, ?)`,
      [
        docId,
        app.institution_id,
        id,
        title,
        `correction_${defId}.pdf`,
        `uploads/correction_${defId}.pdf`,
        nowIso.split('T')[0],
        new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        user.id,
        nowIso
      ]
    );
    // Link document to deficiency
    runSql('UPDATE application_deficiencies SET response_document_id = ? WHERE id = ?', [docId, defId]);
  }

  // Resubmit application back to Under Scrutiny with 7-day review window
  const newDeadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  runSql(
    'UPDATE applications SET status = \'RESUBMITTED\', stage_deadline_at = ?, updated_at = ? WHERE id = ?',
    [newDeadline, nowIso, id]
  );

  const histId = `hist-${Date.now()}`;
  runSql(
    `INSERT INTO application_stages_history (
       id, application_id, stage_code, stage_name, actor_user_id, actor_name, actor_role,
       action, previous_status, new_status, reason, notes, created_at
     ) VALUES (?, ?, ?, 'Document & Eligibility Scrutiny', ?, ?, ?, 'RESUBMIT', 'CORRECTION_REQUIRED', 'RESUBMITTED', NULL, ?, ?)`,
    [
      histId,
      id,
      app.current_stage_code,
      user.id,
      user.full_name,
      user.role,
      `Institution submitted clarifications and rectifications. ${generalClarification}`,
      nowIso
    ]
  );

  // Notify scrutiny officer
  if (app.assigned_scrutiny_officer_id) {
    runSql(
      `INSERT INTO notifications (id, recipient_user_id, recipient_role, title, message, notification_type, reference_type, reference_id, is_read, channel, delivery_status, sent_at, created_at)
       VALUES (?, ?, 'SCRUTINY_OFFICER', ?, ?, 'STAGE_ADVANCED', 'APPLICATION', ?, 0, 'IN_APP', 'DELIVERED', ?, ?)`,
      [
        `notif-${Date.now()}`,
        app.assigned_scrutiny_officer_id,
        `Rectification Submitted: ${app.application_number}`,
        'The applicant institution has submitted responses and supporting documents for all deficiencies. Ready for re-scrutiny.',
        id,
        nowIso,
        nowIso
      ]
    );
  }

  logAuditEvent(user, 'SUBMIT_CORRECTION', 'APPLICATION', id, {
    previousState: 'CORRECTION_REQUIRED',
    newState: 'RESUBMITTED',
    notes: `Institution submitted deficiency clarifications. General: ${generalClarification}`
  });

  recordIntegrationEvent('CORRECTION_SUBMITTED', {
    application_id: id,
    application_number: app.application_number,
    clarification: generalClarification
  });

  res.json({ message: 'Correction details and rectification documents submitted successfully.' });
});

// Final Decision: Approve or Reject (Admin or Executive Committee)
applicationsRouter.post('/:id/final-decision', authenticate, requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const { id } = req.params;
  const { decision, remarks } = req.body;

  if (!decision || !['APPROVED', 'REJECTED'].includes(decision)) {
    res.status(400).json({ error: 'Decision must be either APPROVED or REJECTED.' });
    return;
  }

  if (!remarks || remarks.trim().length < 5) {
    res.status(400).json({ error: 'Mandatory requirement: Comprehensive decision remarks must be provided.' });
  }

    return;
  const app = queryOne<any>('SELECT * FROM applications WHERE id = ?', [id]);
  if (!app) {
    res.status(404).json({ error: 'Application not found.' });
    return;
  }

  const now = new Date().toISOString();

  runSql(
    `UPDATE applications
     SET status = ?, current_stage_code = 'STAGE_FINAL_APPROVAL',
         final_decision = ?, final_decision_at = ?, final_decision_remarks = ?,
         stage_deadline_at = NULL, updated_at = ?
     WHERE id = ?`,
    [decision, decision, now, remarks.trim(), now, id]
  );

  const histId = `hist-${Date.now()}`;
  runSql(
    `INSERT INTO application_stages_history (
       id, application_id, stage_code, stage_name, actor_user_id, actor_name, actor_role,
       action, previous_status, new_status, reason, notes, created_at
     ) VALUES (?, ?, 'STAGE_FINAL_APPROVAL', 'Competent Authority Final Decision', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      histId,
      id,
      user.id,
      user.full_name,
      user.role,
      decision === 'APPROVED' ? 'APPROVE' : 'REJECT',
      app.status,
      decision,
      decision === 'REJECTED' ? remarks : null,
      remarks,
      now
    ]
  );

  // Notify Institution
  runSql(
    `INSERT INTO notifications (id, recipient_user_id, recipient_role, title, message, notification_type, reference_type, reference_id, is_read, channel, delivery_status, sent_at, created_at)
     VALUES (?, NULL, 'INSTITUTION', ?, ?, 'STAGE_ADVANCED', 'APPLICATION', ?, 0, 'IN_APP', 'DELIVERED', ?, ?)`,
    [
      `notif-${Date.now()}`,
      `Final Decision on Application ${app.application_number}: ${decision}`,
      `The Competent Authority has finalized decision: ${decision}. Remarks: ${remarks}`,
      id,
      now,
      now
    ]
  );

  logAuditEvent(user, decision === 'APPROVED' ? 'APPROVE_APPLICATION' : 'REJECT_APPLICATION', 'APPLICATION', id, {
    previousState: app.status,
    newState: decision,
    notes: remarks
  });

  recordIntegrationEvent('STAGE_CHANGED', {
    application_id: id,
    application_number: app.application_number,
    final_decision: decision,
    remarks
  });

  res.json({
    message: `Application successfully marked as ${decision}.`,
    decision
  });
});

// Verify or waive single deficiency
applicationsRouter.post('/:id/deficiencies/:defId/verify', authenticate, requireRole('SCRUTINY_OFFICER', 'REGIONAL_OFFICER', 'ADMIN'), (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const { id, defId } = req.params;
  const { status = 'VERIFIED', notes } = req.body; // 'VERIFIED' | 'WAIVED' | 'OPEN'

  const def = queryOne<any>('SELECT * FROM application_deficiencies WHERE id = ? AND application_id = ?', [defId, id]);
  if (!def) {
    res.status(404).json({ error: 'Deficiency record not found.' });
    return;
  }

  const now = new Date().toISOString();
  runSql(
    'UPDATE application_deficiencies SET status = ?, resolved_by_user_id = ?, resolved_at = ? WHERE id = ?',
    [status, user.id, now, defId]
  );

  logAuditEvent(user, 'VERIFY_DEFICIENCY', 'DEFICIENCY', defId, {
    previousState: def.status,
    newState: status,
    notes: notes || `Marked deficiency as ${status}`
  });

  res.json({ message: `Deficiency status updated to ${status}.` });
});

// Process SAC / SHC Hearing Outcome
applicationsRouter.post('/:id/sac-hearing', authenticate, requireRole('REGIONAL_OFFICER', 'ADMIN'), (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const { id } = req.params;
  const { outcome, minutes, conditions } = req.body;

  if (!outcome || !minutes || minutes.trim().length < 10) {
    res.status(400).json({ error: 'Hearing outcome and detailed minutes (min 10 chars) are required.' });
    return;
  }

  const app = queryOne<any>('SELECT * FROM applications WHERE id = ?', [id]);
  if (!app) {
    res.status(404).json({ error: 'Application not found.' });
    return;
  }

  const now = new Date().toISOString();
  let nextStageCode = 'STAGE_FINAL_APPROVAL';
  let nextStatus = outcome === 'RECOMMENDED' ? 'RECOMMENDED' : outcome === 'NOT_RECOMMENDED' ? 'REJECTED' : 'RECOMMENDED';

  runSql(
    'UPDATE applications SET current_stage_code = ?, status = ?, updated_at = ? WHERE id = ?',
    [nextStageCode, nextStatus, now, id]
  );

  const histId = `hist-${Date.now()}`;
  runSql(
    `INSERT INTO application_stages_history (
       id, application_id, stage_code, stage_name, actor_user_id, actor_name, actor_role,
       action, previous_status, new_status, reason, notes, created_at
     ) VALUES (?, ?, 'STAGE_SAC_SHC', 'Standing Appellate / Hearing Committee', ?, ?, ?, 'COMPLETE_STAGE', ?, ?, NULL, ?, ?)`,
    [
      histId,
      id,
      user.id,
      user.full_name,
      user.role,
      app.status,
      nextStatus,
      `SAC/SHC Hearing Outcome: ${outcome}. Minutes: ${minutes}. Conditions: ${conditions || 'None'}`,
      now
    ]
  );

  logAuditEvent(user, 'PROCESS_SAC_SHC_HEARING', 'APPLICATION', id, {
    previousState: app.status,
    newState: nextStatus,
    notes: `Hearing outcome: ${outcome}. Minutes: ${minutes}`
  });

  recordIntegrationEvent('STAGE_CHANGED', {
    application_id: id,
    application_number: app.application_number,
    stage: 'STAGE_SAC_SHC',
    outcome
  });

  res.json({ message: 'SAC / SHC Hearing decision recorded successfully.', status: nextStatus });
});

