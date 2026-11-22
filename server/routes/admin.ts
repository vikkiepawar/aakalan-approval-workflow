// @ts-ignore - Express types are provided at runtime by the application dependencies.
import { Router, Response } from 'express';
// @ts-ignore - bcryptjs types are provided at runtime by the application dependencies.
import bcrypt from 'bcryptjs';
import { queryOne, queryAll, runSql } from '../db.js';
import { authenticate, AuthenticatedRequest, requireRole, logAuditEvent } from '../auth.js';

export const adminRouter = Router();

// Require ADMIN for all routes in this router
adminRouter.use(authenticate, requireRole('ADMIN'));

// Get all users
adminRouter.get('/users', (_req: AuthenticatedRequest, res: Response): void => {
  const users = queryAll<any>(`
    SELECT u.id, u.email, u.full_name, u.role, u.designation, u.department, u.region,
           u.institution_id, u.is_active, u.created_at, u.last_login_at,
           i.name as institution_name
    FROM users u
    LEFT JOIN institutions i ON u.institution_id = i.id
    ORDER BY u.created_at DESC
  `);
  res.json({ users });
});

// Create new privileged user (Officer or Admin)
adminRouter.post('/users', (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const { email, password, full_name, role, designation, department, region, institution_id } = req.body;

  if (!email || !password || !full_name || !role) {
    res.status(400).json({ error: 'Email, password, full name and role are required.' });
    return;
  }

  const existing = queryOne('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()]);
  if (existing) {
    res.status(409).json({ error: 'A user with this email address already exists.' });
    return;
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);
  const userId = `usr-${Date.now().toString().slice(-6)}`;
  const now = new Date().toISOString();

  runSql(
    `INSERT INTO users (id, email, password_hash, full_name, role, designation, department, region, institution_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      email.trim(),
      passwordHash,
      full_name.trim(),
      role,
      designation || null,
      department || null,
      region || 'National',
      institution_id || null,
      now
    ]
  );

  logAuditEvent(user, 'CREATE_USER', 'USER', userId, {
    notes: `Created user ${email} with role ${role}`
  });

  res.status(201).json({ message: 'User created successfully.', user_id: userId });
});

// Update user status (active/deactivated) or role
adminRouter.patch('/users/:id', (req: AuthenticatedRequest, res: Response): void => {
  const admin = req.user!;
  const { id } = req.params;
  const { is_active, role, designation, department, region } = req.body;

  const target = queryOne<any>('SELECT * FROM users WHERE id = ?', [id]);
  if (!target) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  runSql(
    `UPDATE users
     SET is_active = COALESCE(?, is_active),
         role = COALESCE(?, role),
         designation = COALESCE(?, designation),
         department = COALESCE(?, department),
         region = COALESCE(?, region)
     WHERE id = ?`,
    [is_active !== undefined ? (is_active ? 1 : 0) : null, role || null, designation || null, department || null, region || null, id]
  );

  logAuditEvent(admin, 'UPDATE_USER', 'USER', id, {
    previousState: target.role,
    newState: role || target.role,
    notes: `Updated status: active=${is_active}, role=${role}`
  });

  res.json({ message: 'User updated successfully.' });
});

// Get all institutions
adminRouter.get('/institutions', (_req: AuthenticatedRequest, res: Response): void => {
  const institutions = queryAll<any>('SELECT * FROM institutions ORDER BY name ASC');
  res.json({ institutions });
});

// Get workflow templates
adminRouter.get('/workflow-templates', (_req: AuthenticatedRequest, res: Response): void => {
  const templates = queryAll<any>('SELECT * FROM workflow_templates ORDER BY created_at ASC');
  const parsed = templates.map(t => {
    try {
      return { ...t, stages: JSON.parse(t.stages_json) };
    } catch {
      return { ...t, stages: [] };
    }
  });
  res.json({ templates: parsed });
});

// Create/Update workflow template
adminRouter.post('/workflow-templates', (req: AuthenticatedRequest, res: Response): void => {
  const admin = req.user!;
  const { name, code, description, stages } = req.body;

  if (!name || !code || !stages || !Array.isArray(stages) || stages.length === 0) {
    res.status(400).json({ error: 'Name, unique code and valid stages array are required.' });
    return;
  }

  const existing = queryOne<any>('SELECT id, version FROM workflow_templates WHERE code = ?', [code]);
  const now = new Date().toISOString();

  if (existing) {
    // Increment version
    const newVersion = existing.version + 1;
    runSql(
      'UPDATE workflow_templates SET name = ?, description = ?, version = ?, stages_json = ? WHERE id = ?',
      [name, description, newVersion, JSON.stringify(stages), existing.id]
    );

    logAuditEvent(admin, 'UPDATE_WORKFLOW_TEMPLATE', 'WORKFLOW_TEMPLATE', existing.id, {
      notes: `Updated template ${code} to version ${newVersion}`
    });

    res.json({ message: `Workflow template updated to version ${newVersion}.` });
  } else {
    const tmplId = `tmpl-${code.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    runSql(
      `INSERT INTO workflow_templates (id, name, code, description, version, stages_json, created_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
      [tmplId, name, code, description, JSON.stringify(stages), now]
    );

    logAuditEvent(admin, 'CREATE_WORKFLOW_TEMPLATE', 'WORKFLOW_TEMPLATE', tmplId, {
      notes: `Created new workflow template: ${name} (${code})`
    });

    res.status(201).json({ message: 'Workflow template created successfully.', template_id: tmplId });
  }
});

// Audit Logs query
adminRouter.get('/audit-logs', (req: AuthenticatedRequest, res: Response): void => {
  const { action, entity_type, limit = 100 } = req.query;
  let query = 'SELECT * FROM audit_logs WHERE 1=1';
  const params: any[] = [];

  if (action) {
    query += ' AND action = ?';
    params.push(action);
  }
  if (entity_type) {
    query += ' AND entity_type = ?';
    params.push(entity_type);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(Number(limit) || 100);

  const logs = queryAll(query, params);
  res.json({ audit_logs: logs });
});

// Escalation rules and deadline configurations
adminRouter.get('/escalation-rules', (_req: AuthenticatedRequest, res: Response): void => {
  // Configurable escalation matrix
  const rules = [
    {
      level: 1,
      trigger: 'Approaching Deadline (within 48 hours)',
      target_role: 'SCRUTINY_OFFICER',
      action: 'Automated in-app alert & email notification',
      enabled: true
    },
    {
      level: 2,
      trigger: 'Stage Deadline Exceeded (Overdue 1-3 days)',
      target_role: 'REGIONAL_OFFICER',
      action: 'Regional Officer review queue flag & Webhook dispatch',
      enabled: true
    },
    {
      level: 3,
      trigger: 'Critical Overdue (Exceeded > 5 days)',
      target_role: 'ADMIN',
      action: 'Escalation to AICTE Director of Approvals & SMS broadcast',
      enabled: true
    }
  ];
  res.json({ rules });
});
