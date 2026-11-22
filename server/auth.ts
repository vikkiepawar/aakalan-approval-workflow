import { queryOne, runSql } from './db.js';
import jwt from 'jsonwebtoken';

// Minimal local request/response types avoid requiring Express's type package
// just to type these middleware functions.
interface Request {
  ip?: string;
  socket: { remoteAddress?: string };
  headers: { authorization?: string };
  query: Record<string, unknown>;
}

interface Response {
  status(code: number): Response;
  json(body: unknown): Response;
}

type NextFunction = () => void;

// Resolve the runtime dependency without requiring its type declarations here.
const JWT_SECRET = (globalThis as typeof globalThis & {
  process?: { env: Record<string, string | undefined> };
}).process?.env.JWT_SECRET || 'aicte-flow-secure-jwt-secret-key-2026';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: 'INSTITUTION' | 'SCRUTINY_OFFICER' | 'REGIONAL_OFFICER' | 'ADMIN';
  designation?: string;
  department?: string;
  region?: string;
  institution_id?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      designation: user.designation,
      department: user.department,
      region: user.region,
      institution_id: user.institution_id
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// In-memory simple rate limiting for sensitive endpoints
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export function rateLimitLogin(maxAttempts = 10, windowMs = 60000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const record = loginAttempts.get(ip);

    if (record) {
      if (now > record.resetAt) {
        loginAttempts.set(ip, { count: 1, resetAt: now + windowMs });
      } else {
        record.count += 1;
        if (record.count > maxAttempts) {
          res.status(429).json({
            error: 'Too many authentication attempts. Please wait 60 seconds before retrying.'
          });
          return;
        }
      }
    } else {
      loginAttempts.set(ip, { count: 1, resetAt: now + windowMs });
    }
    next();
  };
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Missing or invalid Bearer token.' });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    // Verify user exists and is active in database
    const userInDb = queryOne('SELECT id, is_active FROM users WHERE id = ?', [decoded.id]);
    if (!userInDb || !userInDb.is_active) {
      res.status(401).json({ error: 'User account not found or deactivated.' });
      return;
    }

    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired session token.' });
  }
}

export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access denied. Action requires one of: ${allowedRoles.join(', ')}. Current role: ${req.user.role}.`
      });
      return;
    }
    next();
  };
}

// Log audit events securely
export function logAuditEvent(
  actor: AuthUser | { id: string; full_name: string; role: string },
  action: string,
  entityType: string,
  entityId: string,
  options: {
    previousState?: string | null;
    newState?: string | null;
    ipAddress?: string;
    notes?: string;
  } = {}
): void {
  const id = `aud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  try {
    runSql(
      `INSERT INTO audit_logs (id, actor_user_id, actor_name, actor_role, action, entity_type, entity_id, previous_state, new_state, ip_address, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        actor.id,
        actor.full_name,
        actor.role,
        action,
        entityType,
        entityId,
        options.previousState || null,
        options.newState || null,
        options.ipAddress || null,
        options.notes || null,
        now
      ]
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

// Emit integration events for n8n or webhooks
export function recordIntegrationEvent(eventType: string, payload: Record<string, any>): string {
  const id = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  try {
    runSql(
      `INSERT INTO integration_events (id, event_type, payload_json, status, delivery_attempts, last_attempt_at, error_message, created_at)
       VALUES (?, ?, ?, 'PENDING', 0, NULL, NULL, ?)`,
      [id, eventType, JSON.stringify(payload), now]
    );
  } catch (err) {
    console.error('Failed to record integration event:', err);
  }
  return id;
}
