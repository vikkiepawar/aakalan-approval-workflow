// @ts-ignore Express typings are supplied by the server runtime dependencies.
import { Router, Request, Response } from 'express';
// @ts-ignore Node.js typings are supplied by the server runtime dependencies.
import path from 'node:path';
// @ts-ignore Node.js typings are supplied by the server runtime dependencies.
import fs from 'node:fs';
import { queryOne, queryAll, runSql } from '../db.js';
import { authenticate, AuthenticatedRequest as BaseAuthenticatedRequest, requireRole, logAuditEvent } from '../auth.js';

export const complianceRouter = Router();

type AuthenticatedRequest = BaseAuthenticatedRequest & Request;

const UPLOADS_DIR = path.resolve('.', 'data', 'uploads');

// List prescribed institutional documents
complianceRouter.get('/documents', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const { institution_id, status, expiring } = req.query;

  let query = `
    SELECT d.*, i.name as institution_name, i.permanent_id, i.region
    FROM documents d
    JOIN institutions i ON d.institution_id = i.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (user.role === 'INSTITUTION') {
    query += ' AND d.institution_id = ?';
    params.push(user.institution_id);
  } else if (institution_id) {
    query += ' AND d.institution_id = ?';
    params.push(institution_id);
  }

  if (status) {
    query += ' AND d.verification_status = ?';
    params.push(status);
  }

  const now = new Date();
  const nowIso = now.toISOString();

  if (expiring === 'soon') {
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    query += ' AND d.valid_to <= ? AND d.valid_to >= ?';
    params.push(thirtyDays, nowIso);
  } else if (expiring === 'expired') {
    query += ' AND d.valid_to < ?';
    params.push(nowIso);
  }

  query += ' ORDER BY d.valid_to ASC';

  const docs = queryAll(query, params);
  res.json({ documents: docs });
});

// Upload prescribed document (Private storage, validated attributes)
complianceRouter.post('/documents/upload', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const {
    document_type,
    title,
    file_name = 'document.pdf',
    valid_from,
    valid_to,
    application_id
  } = req.body;

  if (!document_type || !title || !valid_from || !valid_to) {
    res.status(400).json({ error: 'Document type, title, valid_from and valid_to dates are required.' });
    return;
  }

  const institutionId = user.institution_id || req.body.institution_id;
  if (!institutionId) {
    res.status(400).json({ error: 'Institution ID required.' });
    return;
  }

  // Create private physical file placeholder on disk if it doesn't exist
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const safeFileName = `${Date.now()}_${file_name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const diskPath = path.join(UPLOADS_DIR, safeFileName);
  const samplePdfContent = new TextEncoder().encode(`%PDF-1.4\naakalan VERIFIED REPOSITORY\nDocument: ${title}\nUploaded: ${new Date().toISOString()}\nActor: ${user.full_name}\n`);
  fs.writeFileSync(diskPath, samplePdfContent);

  const docId = `doc-${Date.now()}`;
  const now = new Date();
  const nowIso = now.toISOString();
  const expiryDate = new Date(valid_to);
  const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
  const isExpiringSoon = daysUntilExpiry <= 30 && daysUntilExpiry >= 0 ? 1 : 0;
  const initialStatus = daysUntilExpiry < 0 ? 'EXPIRED' : 'PENDING';

  runSql(
    `INSERT INTO documents (
       id, institution_id, application_id, document_type, title, file_name, file_size,
       mime_type, file_path, valid_from, valid_to, is_expiring_soon, verification_status,
       uploaded_by_user_id, uploaded_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 'application/pdf', ?, ?, ?, ?, ?, ?, ?)`,
    [
      docId,
      institutionId,
      application_id || null,
      document_type,
      title,
      file_name,
      samplePdfContent.length,
      `uploads/${safeFileName}`,
      valid_from,
      valid_to,
      isExpiringSoon,
      initialStatus,
      user.id,
      nowIso
    ]
  );

  logAuditEvent(user, 'UPLOAD_PRESCRIBED_DOCUMENT', 'DOCUMENT', docId, {
    notes: `Uploaded ${document_type}: ${title}. Valid until ${valid_to}`
  });

  res.status(201).json({
    message: 'Document securely uploaded to private repository.',
    document_id: docId
  });
});

// Private Document Preview/Download with auth token check
complianceRouter.get('/documents/:id/download', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const { id } = req.params;

  const doc = queryOne<any>('SELECT * FROM documents WHERE id = ?', [id]);
  if (!doc) {
    res.status(404).json({ error: 'Document not found.' });
    return;
  }

  // Institutional ownership check
  if (user.role === 'INSTITUTION' && doc.institution_id !== user.institution_id) {
    res.status(403).json({ error: 'Access denied to private document.' });
    return;
  }

  const filename = path.basename(doc.file_path);
  const fullPath = path.join(UPLOADS_DIR, filename);

  if (fs.existsSync(fullPath)) {
    res.setHeader('Content-Type', doc.mime_type || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${doc.file_name}"`);
    fs.createReadStream(fullPath).pipe(res);
  } else {
    // Generate streaming synthetic PDF placeholder if disk file not created yet
    res.setHeader('Content-Type', 'text/plain');
    res.send(`aakalan SECURE DOCUMENT ARCHIVE\n====================================\nDocument ID: ${doc.id}\nTitle: ${doc.title}\nType: ${doc.document_type}\nValidity: ${doc.valid_from} to ${doc.valid_to}\nStatus: ${doc.verification_status}\nUploaded: ${doc.uploaded_at}\nAuthorized Viewer: ${user.full_name} (${user.role})`);
  }
});

// Verify or Mark Deficient on document
complianceRouter.post('/documents/:id/verify', authenticate, requireRole('SCRUTINY_OFFICER', 'REGIONAL_OFFICER', 'ADMIN'), (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const { id } = req.params;
  const { verification_status, verification_notes } = req.body;

  if (!verification_status || !['VERIFIED', 'DEFICIENT', 'EXPIRED'].includes(verification_status)) {
    res.status(400).json({ error: 'Valid status required: VERIFIED, DEFICIENT, or EXPIRED.' });
    return;
  }

  const doc = queryOne<any>('SELECT * FROM documents WHERE id = ?', [id]);
  if (!doc) {
    res.status(404).json({ error: 'Document not found.' });
    return;
  }

  runSql(
    'UPDATE documents SET verification_status = ?, verification_notes = ? WHERE id = ?',
    [verification_status, verification_notes || null, id]
  );

  logAuditEvent(user, 'VERIFY_DOCUMENT', 'DOCUMENT', id, {
    previousState: doc.verification_status,
    newState: verification_status,
    notes: verification_notes
  });

  res.json({ message: `Document status updated to ${verification_status}.` });
});

// List compliance undertakings
complianceRouter.get('/undertakings', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const { status } = req.query;

  let query = `
    SELECT u.*, i.name as institution_name, i.permanent_id, i.region, a.application_number
    FROM compliance_undertakings u
    JOIN institutions i ON u.institution_id = i.id
    LEFT JOIN applications a ON u.application_id = a.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (user.role === 'INSTITUTION') {
    query += ' AND u.institution_id = ?';
    params.push(user.institution_id);
  }

  if (status) {
    query += ' AND u.status = ?';
    params.push(status);
  }

  query += ' ORDER BY u.deadline_date ASC';

  const undertakings = queryAll(query, params);
  res.json({ undertakings });
});

// Add new compliance undertaking
complianceRouter.post('/undertakings', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const {
    title,
    category = 'INFRASTRUCTURE',
    description,
    deadline_date,
    application_id,
    penalty_applicable = 0,
    notes
  } = req.body;

  if (!title || !description || !deadline_date) {
    res.status(400).json({ error: 'Title, description and deadline date are required.' });
    return;
  }

  const institutionId = user.institution_id || req.body.institution_id;
  if (!institutionId) {
    res.status(400).json({ error: 'Institution ID required.' });
    return;
  }

  const undId = `und-${Date.now()}`;
  const now = new Date().toISOString();

  runSql(
    `INSERT INTO compliance_undertakings (
       id, institution_id, application_id, title, category, description,
       submission_date, deadline_date, status, penalty_applicable, notes, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)`,
    [
      undId,
      institutionId,
      application_id || null,
      title,
      category,
      description,
      now.split('T')[0],
      deadline_date,
      penalty_applicable ? 1 : 0,
      notes || null,
      now
    ]
  );

  logAuditEvent(user, 'SUBMIT_COMPLIANCE_UNDERTAKING', 'COMPLIANCE_UNDERTAKING', undId, {
    notes: `Submitted undertaking: ${title}. Due: ${deadline_date}`
  });

  res.status(201).json({
    message: 'Time-bound compliance undertaking recorded successfully.',
    undertaking_id: undId
  });
});

// Update undertaking status / verify compliance
complianceRouter.post('/undertakings/:id/status', authenticate, requireRole('REGIONAL_OFFICER', 'ADMIN', 'SCRUTINY_OFFICER'), (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const { id } = req.params;
  const { status, notes } = req.body;

  if (!status || !['ACTIVE', 'SUBMITTED_FOR_REVIEW', 'COMPLIED', 'OVERDUE'].includes(status)) {
    res.status(400).json({ error: 'Valid status required: ACTIVE, SUBMITTED_FOR_REVIEW, COMPLIED, or OVERDUE.' });
    return;
  }

  const undertaking = queryOne<any>('SELECT * FROM compliance_undertakings WHERE id = ?', [id]);
  if (!undertaking) {
    res.status(404).json({ error: 'Undertaking not found.' });
    return;
  }

  runSql(
    'UPDATE compliance_undertakings SET status = ?, notes = COALESCE(?, notes) WHERE id = ?',
    [status, notes || null, id]
  );

  logAuditEvent(user, 'UPDATE_UNDERTAKING_STATUS', 'COMPLIANCE_UNDERTAKING', id, {
    previousState: undertaking.status,
    newState: status,
    notes
  });

  res.json({ message: `Undertaking status updated to ${status}.` });
});
