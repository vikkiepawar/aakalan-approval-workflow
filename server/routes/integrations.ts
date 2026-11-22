declare function require(name: string): any;

import { queryOne, queryAll, runSql } from '../db.js';

interface IntegrationRequest {
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, any>;
  body: Record<string, any>;
}

interface IntegrationResponse {
  status(code: number): IntegrationResponse;
  json(body: any): void;
}

interface IntegrationNextFunction {
  (): void;
}

const { Router } = require('express');

export const integrationsRouter = Router();

const N8N_SECRET =
  (globalThis as any).process?.env?.N8N_WEBHOOK_SECRET || 'aicte-flow-n8n-secret-key-2026';

// Middleware to verify external integration token/header
function verifyIntegrationSecret(
  req: IntegrationRequest,
  res: IntegrationResponse,
  next: IntegrationNextFunction
): void {
  const incomingSecret =
    req.headers['x-aicte-flow-secret'] ||
    req.headers['x-api-key'] ||
    req.query.secret;

  if (!incomingSecret || incomingSecret !== N8N_SECRET) {
    res.status(401).json({
      error: 'Unauthorized: Invalid or missing X-AICTE-FLOW-SECRET header.'
    });
    return;
  }
  next();
}

// 1. Retrieve eligible upcoming and overdue actions for n8n automation / scheduled triggers
integrationsRouter.get('/n8n/pending-actions', verifyIntegrationSecret, (_req: IntegrationRequest, res: IntegrationResponse): void => {
  const now = new Date();
  const nowIso = now.toISOString();
  const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // Overdue applications
  const overdueApplications = queryAll<any>(
    `SELECT a.id, a.application_number, a.application_type, a.current_stage_code, a.status,
            a.stage_deadline_at, a.assigned_region,
            i.name as institution_name, i.permanent_id, i.principal_email,
            u.full_name as assigned_officer_name, u.email as assigned_officer_email
     FROM applications a
     JOIN institutions i ON a.institution_id = i.id
     LEFT JOIN users u ON a.assigned_scrutiny_officer_id = u.id
     WHERE a.stage_deadline_at < ? AND a.status NOT IN ('APPROVED', 'REJECTED')`,
    [nowIso]
  );

  // Approaching deadline applications (< 48h)
  const approachingDeadlines = queryAll<any>(
    `SELECT a.id, a.application_number, a.application_type, a.current_stage_code, a.status,
            a.stage_deadline_at, a.assigned_region,
            i.name as institution_name, i.permanent_id, i.principal_email,
            u.full_name as assigned_officer_name, u.email as assigned_officer_email
     FROM applications a
     JOIN institutions i ON a.institution_id = i.id
     LEFT JOIN users u ON a.assigned_scrutiny_officer_id = u.id
     WHERE a.stage_deadline_at >= ? AND a.stage_deadline_at <= ? AND a.status NOT IN ('APPROVED', 'REJECTED')`,
    [nowIso, in48Hours]
  );

  // Expiring documents (< 30 days)
  const expiringDocuments = queryAll<any>(
    `SELECT d.id, d.document_type, d.title, d.valid_to,
            i.name as institution_name, i.permanent_id, i.principal_email
     FROM documents d
     JOIN institutions i ON d.institution_id = i.id
     WHERE d.valid_to >= ? AND d.valid_to <= ? AND d.verification_status != 'EXPIRED'`,
    [nowIso, in30Days]
  );

  // Overdue compliance undertakings
  const overdueUndertakings = queryAll<any>(
    `SELECT u.id, u.title, u.category, u.deadline_date,
            i.name as institution_name, i.principal_email
     FROM compliance_undertakings u
     JOIN institutions i ON u.institution_id = i.id
     WHERE u.deadline_date < ? AND u.status = 'ACTIVE'`,
    [nowIso.split('T')[0]]
  );

  res.json({
    timestamp: nowIso,
    counts: {
      overdue_applications: overdueApplications.length,
      approaching_deadlines: approachingDeadlines.length,
      expiring_documents: expiringDocuments.length,
      overdue_undertakings: overdueUndertakings.length
    },
    actions: {
      overdue_applications: overdueApplications,
      approaching_deadlines: approachingDeadlines,
      expiring_documents: expiringDocuments,
      overdue_undertakings: overdueUndertakings
    }
  });
});

// 2. Record notification delivery attempts (called by n8n or SMS/Email service)
integrationsRouter.post('/n8n/record-delivery', verifyIntegrationSecret, (req: IntegrationRequest, res: IntegrationResponse): void => {
  const {
    delivery_id,
    event_id,
    recipient_email,
    channel = 'EMAIL', // 'EMAIL' | 'SMS' | 'WHATSAPP' | 'N8N_WEBHOOK'
    status = 'DELIVERED', // 'SENT' | 'DELIVERED' | 'FAILED'
    notification_title,
    notification_body,
    error_message,
    reference_type,
    reference_id
  } = req.body;

  if (!recipient_email && !notification_title) {
    res.status(400).json({ error: 'Recipient and title/body are required to record delivery.' });
    return;
  }

  const notifId = delivery_id || `notif-ext-${Date.now()}`;
  const now = new Date().toISOString();

  // Find user by email if exists
  const user = recipient_email ? queryOne<any>('SELECT id, role FROM users WHERE LOWER(email) = LOWER(?)', [recipient_email.trim()]) : null;

  runSql(
    `INSERT INTO notifications (
       id, recipient_user_id, recipient_role, title, message, notification_type,
       reference_type, reference_id, is_read, channel, delivery_status, sent_at, created_at
     ) VALUES (?, ?, ?, ?, ?, 'EXTERNAL_DELIVERY', ?, ?, 0, ?, ?, ?, ?)`,
    [
      notifId,
      user?.id || null,
      user?.role || 'EXTERNAL',
      notification_title || 'aakalan Notification',
      notification_body || 'Automated compliance notification dispatched.',
      reference_type || null,
      reference_id || null,
      channel,
      status,
      now,
      now
    ]
  );

  // If tied to an integration event, mark event processed
  if (event_id) {
    runSql(
      'UPDATE integration_events SET status = ?, delivery_attempts = delivery_attempts + 1, last_attempt_at = ?, error_message = ? WHERE id = ?',
      [status === 'DELIVERED' ? 'PROCESSED' : 'FAILED', now, error_message || null, event_id]
    );
  }

  res.status(201).json({
    message: 'Notification delivery attempt recorded successfully.',
    delivery_id: notifId,
    status
  });
});

// 3. Event mechanism for n8n polling or webhooks (Application submissions, stage changes, corrections, expiry)
integrationsRouter.get('/n8n/events', verifyIntegrationSecret, (req: IntegrationRequest, res: IntegrationResponse): void => {
  const { status, limit = 50 } = req.query;
  let query = 'SELECT * FROM integration_events WHERE 1=1';
  const params: any[] = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(Number(limit) || 50);

  const events = queryAll<any>(query, params);
  const parsed = events.map(e => {
    try {
      return { ...e, payload: JSON.parse(e.payload_json) };
    } catch {
      return { ...e, payload: {} };
    }
  });

  res.json({ events: parsed });
});

// 4. Trigger deadline calculation & synthetic cron check (Allows immediate demonstration of n8n trigger)
integrationsRouter.post('/n8n/trigger-cron', verifyIntegrationSecret, (_req: IntegrationRequest, res: IntegrationResponse): void => {
  const now = new Date();
  const nowIso = now.toISOString();

  // Find overdue applications
  const overdue = queryAll<any>(
    'SELECT id, application_number, assigned_scrutiny_officer_id FROM applications WHERE stage_deadline_at < ? AND status NOT IN (\'APPROVED\', \'REJECTED\')',
    [nowIso]
  );

  let generatedAlerts = 0;
  for (const app of overdue) {
    // Check if notification was already sent in last 24h
    const recentNotif = queryOne(
      'SELECT id FROM notifications WHERE reference_id = ? AND notification_type = \'DEADLINE_WARNING\' AND created_at > ?',
      [app.id, new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()]
    );

    if (!recentNotif) {
      runSql(
        `INSERT INTO notifications (id, recipient_user_id, recipient_role, title, message, notification_type, reference_type, reference_id, is_read, channel, delivery_status, sent_at, created_at)
         VALUES (?, ?, 'SCRUTINY_OFFICER', ?, ?, 'DEADLINE_WARNING', 'APPLICATION', ?, 0, 'N8N_WEBHOOK', 'DELIVERED', ?, ?)`,
        [
          `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          app.assigned_scrutiny_officer_id,
          `Escalation: Application ${app.application_number} is Overdue`,
          `This application has exceeded its allotted timeline. Priority action required immediately.`,
          app.id,
          nowIso,
          nowIso
        ]
      );
      generatedAlerts++;
    }
  }

  res.json({
    message: 'Cron check executed successfully.',
    overdue_count: overdue.length,
    alerts_generated: generatedAlerts
  });
});
