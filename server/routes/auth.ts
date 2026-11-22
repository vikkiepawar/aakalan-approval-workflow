// @ts-ignore -- dependency types are unavailable in this project environment
import { Router, Request, Response } from 'express';
// @ts-ignore -- dependency types are unavailable in this project environment
import bcrypt from 'bcryptjs';
import { queryOne, queryAll, runSql } from '../db.js';
import { generateToken, authenticate, rateLimitLogin, AuthenticatedRequest, logAuditEvent } from '../auth.js';

export const authRouter = Router();

// Login with email and password
authRouter.post('/login', rateLimitLogin(10, 60000), (req: Request, res: Response): void => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const user = queryOne<any>('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()]);
  if (!user || !user.is_active) {
    res.status(401).json({ error: 'Invalid email address or deactivated credentials.' });
    return;
  }

  const passwordValid = bcrypt.compareSync(password, user.password_hash);
  if (!passwordValid) {
    res.status(401).json({ error: 'Invalid password. Please check your credentials.' });
    return;
  }

  const now = new Date().toISOString();
  runSql('UPDATE users SET last_login_at = ? WHERE id = ?', [now, user.id]);

  const token = generateToken({
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    designation: user.designation,
    department: user.department,
    region: user.region,
    institution_id: user.institution_id
  });

  let institution = null;
  if (user.institution_id) {
    institution = queryOne('SELECT * FROM institutions WHERE id = ?', [user.institution_id]);
  }

  logAuditEvent(user, 'USER_LOGIN', 'USER', user.id, {
    ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
    notes: `Successful portal sign-in as ${user.role}`
  });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      designation: user.designation,
      department: user.department,
      region: user.region,
      institution_id: user.institution_id,
      institution
    }
  });
});

// Self-registration for Institution accounts ONLY (privileged roles cannot self-register!)
authRouter.post('/register-institution', (req: Request, res: Response): void => {
  const {
    permanent_id,
    institution_name,
    region,
    address,
    state,
    city,
    pincode,
    establishment_year,
    institution_type,
    land_area_acres,
    built_up_area_sqm,
    principal_name,
    email,
    password,
    phone
  } = req.body;

  if (!permanent_id || !institution_name || !region || !email || !password || !principal_name) {
    res.status(400).json({ error: 'Please fill in all mandatory institution registration fields.' });
    return;
  }

  // Check if email already taken
  const existingUser = queryOne('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()]);
  if (existingUser) {
    res.status(409).json({ error: 'A user account with this email address already exists.' });
    return;
  }

  // Check if permanent_id already registered
  const existingInst = queryOne('SELECT id FROM institutions WHERE permanent_id = ?', [permanent_id.trim()]);
  if (existingInst) {
    res.status(409).json({ error: 'An institution with this AICTE Permanent ID is already registered.' });
    return;
  }

  const now = new Date().toISOString();
  const instId = `inst-${Date.now().toString().slice(-6)}`;
  const userId = `usr-inst-${Date.now().toString().slice(-6)}`;

  // Create Institution
  runSql(
    `INSERT INTO institutions (id, permanent_id, name, region, address, state, city, pincode, establishment_year, institution_type, land_area_acres, built_up_area_sqm, principal_name, principal_email, principal_phone, compliance_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLIANT', ?)`,
    [
      instId,
      permanent_id.trim(),
      institution_name.trim(),
      region,
      address || 'Institutional Area',
      state || 'State',
      city || 'City',
      pincode || '000000',
      Number(establishment_year) || new Date().getFullYear(),
      institution_type || 'Engineering & Technology',
      Number(land_area_acres) || 10.0,
      Number(built_up_area_sqm) || 25000,
      principal_name.trim(),
      email.trim(),
      phone || '+91 9999999999',
      now
    ]
  );

  // Hash password
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);

  // Enforce role = 'INSTITUTION' ONLY
  runSql(
    `INSERT INTO users (id, email, password_hash, full_name, role, designation, department, region, institution_id, created_at)
     VALUES (?, ?, ?, ?, 'INSTITUTION', 'Principal & Authorized Signatory', 'Administration', ?, ?, ?)`,
    [userId, email.trim(), passwordHash, principal_name.trim(), region, instId, now]
  );

  const newUser = {
    id: userId,
    email: email.trim(),
    full_name: principal_name.trim(),
    role: 'INSTITUTION' as const,
    designation: 'Principal & Authorized Signatory',
    department: 'Administration',
    region,
    institution_id: instId
  };

  const token = generateToken(newUser);

  logAuditEvent(newUser, 'REGISTER_INSTITUTION', 'INSTITUTION', instId, {
    notes: `New institution registered: ${institution_name} (${permanent_id})`
  });

  res.status(201).json({
    message: 'Institution and authorized user registered successfully.',
    token,
    user: newUser
  });
});

// Get current logged-in user profile
authRouter.get('/me', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }

  const user = queryOne<any>('SELECT id, email, full_name, role, designation, department, region, institution_id, created_at FROM users WHERE id = ?', [req.user.id]);
  if (!user) {
    res.status(404).json({ error: 'User profile not found.' });
    return;
  }

  let institution = null;
  if (user.institution_id) {
    institution = queryOne('SELECT * FROM institutions WHERE id = ?', [user.institution_id]);
  }

  res.json({
    user: {
      ...user,
      institution
    }
  });
});

// Demo Persona Quick-Switch endpoint (Specifically designed for evaluating the 4 mandatory roles)
authRouter.get('/personas', (_req: Request, res: Response): void => {
  const personas = queryAll<any>(`
    SELECT u.id, u.email, u.full_name, u.role, u.designation, u.department, u.region, u.institution_id, i.name as institution_name
    FROM users u
    LEFT JOIN institutions i ON u.institution_id = i.id
    WHERE u.id IN ('usr-inst-01', 'usr-scrutiny-01', 'usr-regional-01', 'usr-admin-01')
    ORDER BY CASE u.role
      WHEN 'INSTITUTION' THEN 1
      WHEN 'SCRUTINY_OFFICER' THEN 2
      WHEN 'REGIONAL_OFFICER' THEN 3
      WHEN 'ADMIN' THEN 4
      ELSE 5
    END
  `);

  res.json({ personas });
});

authRouter.post('/switch-persona', (req: Request, res: Response): void => {
  const { personaId } = req.body;
  if (!personaId) {
    res.status(400).json({ error: 'Persona ID is required.' });
    return;
  }

  const user = queryOne<any>('SELECT * FROM users WHERE id = ?', [personaId]);
  if (!user) {
    res.status(404).json({ error: 'Persona user not found.' });
    return;
  }

  const token = generateToken({
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    designation: user.designation,
    department: user.department,
    region: user.region,
    institution_id: user.institution_id
  });

  let institution = null;
  if (user.institution_id) {
    institution = queryOne('SELECT * FROM institutions WHERE id = ?', [user.institution_id]);
  }

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      designation: user.designation,
      department: user.department,
      region: user.region,
      institution_id: user.institution_id,
      institution
    }
  });
});
