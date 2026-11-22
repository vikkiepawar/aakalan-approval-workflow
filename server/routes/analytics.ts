// @ts-ignore: Express is provided by the server's runtime dependencies.
import { Router, Response } from 'express';
import { queryOne, queryAll } from '../db.js';
import { authenticate, AuthenticatedRequest } from '../auth.js';

export const analyticsRouter = Router();

analyticsRouter.get('/summary', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const now = new Date();
  const nowIso = now.toISOString();

  // Scope filter:
  // - Institution: only their institution's data
  // - Scrutiny Officer: assigned or regional applications
  // - Regional Officer: regional applications
  // - Admin: nationwide
  let appScopeClause = 'WHERE 1=1';
  let params: any[] = [];

  if (user.role === 'INSTITUTION') {
    appScopeClause += ' AND institution_id = ?';
    params.push(user.institution_id || 'none');
  } else if (user.role === 'SCRUTINY_OFFICER') {
    if (user.region && user.region !== 'National') {
      appScopeClause += ' AND (assigned_scrutiny_officer_id = ? OR assigned_region = ?)';
      params.push(user.id, user.region);
    }
  } else if (user.role === 'REGIONAL_OFFICER') {
    if (user.region && user.region !== 'National') {
      appScopeClause += ' AND assigned_region = ?';
      params.push(user.region);
    }
  }

  // 1. Total applications
  const totalApps = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM applications ${appScopeClause}`,
    params
  )?.count || 0;

  // 2. Pending applications (not final approved, rejected, or draft)
  const pendingApps = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM applications ${appScopeClause} AND status NOT IN ('APPROVED', 'REJECTED', 'DRAFT')`,
    params
  )?.count || 0;

  // 3. Overdue applications (stage_deadline_at < now AND not resolved)
  const overdueApps = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM applications ${appScopeClause} AND status NOT IN ('APPROVED', 'REJECTED') AND stage_deadline_at IS NOT NULL AND stage_deadline_at < ?`,
    [...params, nowIso]
  )?.count || 0;

  // 4. Completed applications (APPROVED or REJECTED)
  const completedApps = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM applications ${appScopeClause} AND status IN ('APPROVED', 'REJECTED')`,
    params
  )?.count || 0;

  // 5. Applications awaiting institutional correction
  const correctionApps = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM applications ${appScopeClause} AND status = 'CORRECTION_REQUIRED'`,
    params
  )?.count || 0;

  // 6. EVC visits scheduled
  let evcScopeClause = 'WHERE 1=1';
  let evcParams: any[] = [];
  if (user.role === 'INSTITUTION') {
    evcScopeClause += ' AND institution_id = ?';
    evcParams.push(user.institution_id);
  }
  const scheduledEvcVisits = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM evc_visits ${evcScopeClause} AND visit_status IN ('SCHEDULED', 'PROPOSED')`,
    evcParams
  )?.count || 0;

  // 7. Documents expiring soon (< 30 days) or expired
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  let docScopeClause = 'WHERE 1=1';
  let docParams: any[] = [];
  if (user.role === 'INSTITUTION') {
    docScopeClause += ' AND institution_id = ?';
    docParams.push(user.institution_id);
  }

  const expiringDocsCount = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM documents ${docScopeClause} AND valid_to <= ? AND valid_to >= ?`,
    [...docParams, thirtyDaysLater, nowIso]
  )?.count || 0;

  const expiredDocsCount = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM documents ${docScopeClause} AND valid_to < ?`,
    [...docParams, nowIso]
  )?.count || 0;

  // 8. Compliance items overdue
  let compScopeClause = 'WHERE 1=1';
  let compParams: any[] = [];
  if (user.role === 'INSTITUTION') {
    compScopeClause += ' AND institution_id = ?';
    compParams.push(user.institution_id);
  }
  const overdueComplianceCount = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM compliance_undertakings ${compScopeClause} AND status = 'OVERDUE'`,
    compParams
  )?.count || 0;

  // 9. Stage-wise pendency breakdown
  const stagePendency = queryAll<any>(
    `SELECT current_stage_code as stage, COUNT(*) as count
     FROM applications
     ${appScopeClause} AND status NOT IN ('APPROVED', 'REJECTED', 'DRAFT')
     GROUP BY current_stage_code`,
    params
  );

  // 10. Region-wise workload
  const regionWorkload = queryAll<any>(
    `SELECT assigned_region as region, COUNT(*) as count,
            SUM(CASE WHEN status NOT IN ('APPROVED', 'REJECTED', 'DRAFT') THEN 1 ELSE 0 END) as pending_count,
            SUM(CASE WHEN stage_deadline_at < ? AND status NOT IN ('APPROVED', 'REJECTED') THEN 1 ELSE 0 END) as overdue_count
     FROM applications
     ${appScopeClause}
     GROUP BY assigned_region`,
    [nowIso, ...params]
  );

  // 11. Application Ageing breakdown (< 7 days, 7-15 days, 15-30 days, > 30 days)
  const allAppsForAgeing = queryAll<any>(
    `SELECT submitted_at FROM applications ${appScopeClause} AND submitted_at IS NOT NULL AND status NOT IN ('APPROVED', 'REJECTED')`,
    params
  );

  const ageing = {
    under7Days: 0,
    days7to15: 0,
    days15to30: 0,
    over30Days: 0
  };

  for (const app of allAppsForAgeing) {
    if (!app.submitted_at) continue;
    const subDate = new Date(app.submitted_at);
    const diffDays = Math.floor((now.getTime() - subDate.getTime()) / (1000 * 3600 * 24));
    if (diffDays < 7) {
      ageing.under7Days++;
    } else if (diffDays <= 15) {
      ageing.days7to15++;
    } else if (diffDays <= 30) {
      ageing.days15to30++;
    } else {
      ageing.over30Days++;
    }
  }

  // 12. Upcoming Deadlines (< 5 days)
  const fiveDaysLater = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString();
  const upcomingDeadlines = queryAll<any>(
    `SELECT a.id, a.application_number, a.application_type, a.current_stage_code, a.status, a.stage_deadline_at,
            i.name as institution_name, i.region
     FROM applications a
     JOIN institutions i ON a.institution_id = i.id
     ${appScopeClause} AND a.status NOT IN ('APPROVED', 'REJECTED') AND a.stage_deadline_at IS NOT NULL AND a.stage_deadline_at <= ?
     ORDER BY a.stage_deadline_at ASC
     LIMIT 8`,
    [...params, fiveDaysLater]
  );

  res.json({
    kpis: {
      totalApplications: totalApps,
      pendingApplications: pendingApps,
      overdueApplications: overdueApps,
      completedApplications: completedApps,
      awaitingCorrection: correctionApps,
      scheduledEvcVisits,
      expiringDocsCount,
      expiredDocsCount,
      overdueComplianceCount
    },
    stagePendency,
    regionWorkload,
    ageing,
    upcomingDeadlines
  });
});
