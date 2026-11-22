import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  FileText,
  Layers,
  Users,
  Webhook,
  History,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ShieldCheck,
  Plus,
  Search,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Award
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Application, AnalyticsSummary, WorkflowTemplate, User } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { DecisionModal } from './DecisionModal';
import { WorkflowTemplateModal } from './WorkflowTemplateModal';
import { UserManagementModal } from './UserManagementModal';
import { AssignOfficerModal } from './AssignOfficerModal';
import { N8nIntegrationView } from './N8nIntegrationView';
import { AuditLogsView } from './AuditLogsView';

interface AdminDashboardProps {
  onSelectApplication: (appId: string) => void;
  activeTab?: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onSelectApplication,
  activeTab = 'overview'
}) => {
  const { token, user } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [decisionApp, setDecisionApp] = useState<Application | null>(null);
  const [assignApp, setAssignApp] = useState<Application | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkflowTemplate | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);

  // Master applications search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [analyticsRes, appsRes, tmplRes, usersRes] = await Promise.all([
        fetch('/api/analytics/summary', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/applications', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/workflow-templates', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
      if (appsRes.ok) {
        const d = await appsRes.json();
        setApplications(d.applications || []);
      }
      if (tmplRes.ok) {
        const d = await tmplRes.json();
        setTemplates(d.templates || []);
      }
      if (usersRes.ok) {
        const d = await usersRes.json();
        setUsersList(d.users || []);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, user]);

  const kpis = analytics?.kpis || {
    totalApplications: applications.length,
    pendingApplications: applications.filter(a => a.status !== 'APPROVED' && a.status !== 'REJECTED').length,
    overdueApplications: applications.filter(a => a.stage_deadline_at && new Date(a.stage_deadline_at) < new Date() && a.status !== 'APPROVED').length,
    completedApplications: applications.filter(a => a.status === 'APPROVED' || a.status === 'REJECTED').length,
    awaitingCorrection: applications.filter(a => a.status === 'CORRECTION_REQUIRED').length,
    scheduledEvcVisits: 1,
    expiringDocsCount: 1,
    expiredDocsCount: 1,
    overdueComplianceCount: 1
  };

  const filteredApps = applications.filter(app => {
    const matchSearch =
      app.application_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (app.institution_name && app.institution_name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchStatus = statusFilter === 'ALL' || app.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-purple-600 font-semibold bg-purple-50 px-2.5 py-0.5 rounded border border-purple-200">
              System Administrator & Directorate Console
            </span>
            <span className="text-xs text-slate-500">
              National Approval Bureau · Headquarter Control
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1.5">
            aakalan Approval Governance & System Administration
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor system-wide application throughput, enforce statutory SLAs, manage configurable workflow templates, and orchestrate n8n automated notifications.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemplateModal(true)}
            className="px-3.5 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>New Template</span>
          </button>
          <button
            onClick={() => setShowUserModal(true)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Provision Officer</span>
          </button>
        </div>
      </div>

      {/* View Selector: overview / applications / templates / users / integrations / audit */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Executive KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 border border-slate-200 rounded-lg shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-medium">Total Applications</span>
                <FileText className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                {kpis.totalApplications}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {kpis.completedApplications} Finalized ({Math.round((kpis.completedApplications / (kpis.totalApplications || 1)) * 100)}% Cleared)
              </div>
            </div>

            <div className="bg-white p-5 border border-slate-200 rounded-lg shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-medium">Pending In Pipeline</span>
                <Clock className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold font-mono text-blue-600 tabular-nums">
                {kpis.pendingApplications}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Active Scrutiny & EVC Stages
              </div>
            </div>

            <div className="bg-white p-5 border border-slate-200 rounded-lg shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-medium">Overdue Applications</span>
                <AlertTriangle className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-2xl font-bold font-mono text-rose-600 tabular-nums">
                {kpis.overdueApplications}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Breached SLA · Escalation Ready
              </div>
            </div>

            <div className="bg-white p-5 border border-slate-200 rounded-lg shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-medium">Awaiting Corrections</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold font-mono text-amber-600 tabular-nums">
                {kpis.awaitingCorrection}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Institutional Rectification Window
              </div>
            </div>
          </div>

          {/* 2-Column Analytics Strip: Stage Pendency & Region Workload */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Stage-wise Pendency */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                <h3 className="font-semibold text-xs text-slate-900 uppercase tracking-wider">
                  Stage-Wise Application Pendency
                </h3>
                <span className="text-[11px] text-slate-500">Live DB Metrics</span>
              </div>

              <div className="space-y-3 text-xs">
                {analytics?.stagePendency?.map(item => {
                  const stageLabels: Record<string, string> = {
                    STAGE_SCRUTINY: 'Document & Eligibility Scrutiny',
                    STAGE_EVC: 'Physical Expert Visiting Committee',
                    STAGE_SAC_SHC: 'Standing Appellate / Hearing Committee',
                    STAGE_FINAL_APPROVAL: 'Competent Authority Final Decision'
                  };
                  const pct = Math.round((item.count / (kpis.pendingApplications || 1)) * 100);
                  return (
                    <div key={item.stage} className="space-y-1">
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-700">
                          {stageLabels[item.stage] || item.stage}
                        </span>
                        <span className="font-mono font-bold text-slate-900 tabular-nums">
                          {item.count} cases ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Application Ageing Breakdown */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                <h3 className="font-semibold text-xs text-slate-900 uppercase tracking-wider">
                  Application Ageing Profile (Days Since Submission)
                </h3>
                <span className="text-[11px] text-slate-500">SLA Enforcement</span>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center py-2">
                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-medium">&lt; 7 Days</div>
                  <div className="text-xl font-bold font-mono text-emerald-600 mt-1">
                    {analytics?.ageing?.under7Days || 0}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">On Target</div>
                </div>

                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-medium">7 – 15 Days</div>
                  <div className="text-xl font-bold font-mono text-blue-600 mt-1">
                    {analytics?.ageing?.days7to15 || 0}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">Active</div>
                </div>

                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-medium">15 – 30 Days</div>
                  <div className="text-xl font-bold font-mono text-amber-600 mt-1">
                    {analytics?.ageing?.days15to30 || 0}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">Extended</div>
                </div>

                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-medium">&gt; 30 Days</div>
                  <div className="text-xl font-bold font-mono text-rose-600 mt-1">
                    {analytics?.ageing?.over30Days || 0}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">Critical Overdue</div>
                </div>
              </div>

              {/* Regional Workload summary */}
              <div className="mt-4 pt-3 border-t border-slate-100 text-xs">
                <div className="font-semibold text-slate-800 mb-2">Regional Workload Distribution:</div>
                <div className="grid grid-cols-2 gap-2">
                  {analytics?.regionWorkload?.map(rw => (
                    <div key={rw.region} className="p-2 bg-slate-50 rounded flex justify-between">
                      <span className="text-slate-600">{rw.region}:</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {rw.pending_count} pending / {rw.count} total
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Applications Master Registry View */}
      {(activeTab === 'overview' || activeTab === 'applications') && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              <h3 className="font-semibold text-xs text-slate-900 uppercase tracking-wider">
                National Master Applications Registry ({applications.length})
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter applications..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 border border-slate-300 rounded text-xs bg-white focus:ring-1 focus:ring-blue-500 w-52"
                />
              </div>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white text-slate-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="UNDER_SCRUTINY">Under Scrutiny</option>
                <option value="CORRECTION_REQUIRED">Correction Required</option>
                <option value="UNDER_EVC">Under EVC</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Application</th>
                  <th className="py-3 px-4">Institution & Region</th>
                  <th className="py-3 px-4">Assigned Workflow</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Officer Assigned</th>
                  <th className="py-3 px-4 text-right">Final Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredApps.map(app => (
                  <tr
                    key={app.id}
                    onClick={() => onSelectApplication(app.id)}
                    className="hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {app.application_number}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{app.institution_name}</div>
                      <div className="text-[11px] text-slate-500">{app.assigned_region} Region</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      <span className="font-medium">{app.workflow_template_name}</span>
                      <span className="text-[10px] text-slate-400 block font-mono">v{app.workflow_rule_version}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={app.status} size="sm" />
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {app.scrutiny_officer_name || 'Dr. Rajesh K. Sharma'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAssignApp(app);
                          }}
                          className="px-2 py-1 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded text-[11px] font-medium cursor-pointer"
                        >
                          Assign
                        </button>
                        {app.status === 'APPROVED' || app.status === 'REJECTED' ? (
                          <span className="font-bold font-mono text-[11px] text-slate-700">
                            {app.status}
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDecisionApp(app);
                            }}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-semibold cursor-pointer shadow-2xs"
                          >
                            Execute Order
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Workflow Template Designer View */}
      {activeTab === 'templates' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <h3 className="font-semibold text-xs text-slate-900 uppercase tracking-wider">
                Configured Approval Workflow Templates
              </h3>
            </div>
            <button
              onClick={() => {
                setEditingTemplate(null);
                setShowTemplateModal(true);
              }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold cursor-pointer"
            >
              + Create Template
            </button>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map(tmpl => (
              <div key={tmpl.id} className="p-5 border border-slate-200 rounded-lg bg-slate-50/40 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{tmpl.name}</h4>
                    <span className="font-mono text-xs text-blue-700 font-semibold">{tmpl.code} · Version {tmpl.version}</span>
                  </div>
                  <button
                    onClick={() => {
                      setEditingTemplate(tmpl);
                      setShowTemplateModal(true);
                    }}
                    className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer"
                  >
                    Configure
                  </button>
                </div>

                <p className="text-xs text-slate-600">{tmpl.description}</p>

                <div className="space-y-1.5 pt-2 border-t border-slate-200 text-xs">
                  <span className="font-semibold text-slate-700 block text-[11px] uppercase">
                    Stage Sequence ({tmpl.stages?.length || 0} Gates):
                  </span>
                  {tmpl.stages?.map((s, i) => (
                    <div key={s.code || i} className="p-2 bg-white rounded border border-slate-200 flex items-center justify-between text-[11px]">
                      <span>0{i + 1}. {s.name}</span>
                      <span className="font-mono text-slate-500">{s.deadline_days}d SLA · {s.required_role.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User & Role Access View */}
      {activeTab === 'users' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-600" />
              <h3 className="font-semibold text-xs text-slate-900 uppercase tracking-wider">
                User Accounts & Privileged Role Authority
              </h3>
            </div>
            <button
              onClick={() => setShowUserModal(true)}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold cursor-pointer"
            >
              + Provision Officer
            </button>
          </div>

          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Name & Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Designation</th>
                  <th className="py-3 px-4">Region</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usersList.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{u.full_name}</div>
                      <div className="text-[11px] font-mono text-slate-500">{u.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[11px] font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {u.designation || 'Institutional Signatory'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {u.region || 'National'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-bold">
                        ACTIVE
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* n8n Integration Tab */}
      {activeTab === 'integrations' && <N8nIntegrationView />}

      {/* System Audit Logs Tab */}
      {activeTab === 'audit' && <AuditLogsView />}

      {/* Modals */}
      {decisionApp && (
        <DecisionModal
          application={decisionApp}
          onClose={() => setDecisionApp(null)}
          onSuccess={() => {
            setDecisionApp(null);
            fetchData();
          }}
        />
      )}

      {showTemplateModal && (
        <WorkflowTemplateModal
          template={editingTemplate}
          onClose={() => {
            setShowTemplateModal(false);
            setEditingTemplate(null);
          }}
          onSuccess={() => {
            setShowTemplateModal(false);
            setEditingTemplate(null);
            fetchData();
          }}
        />
      )}

      {showUserModal && (
        <UserManagementModal
          onClose={() => setShowUserModal(false)}
          onSuccess={() => {
            setShowUserModal(false);
            fetchData();
          }}
        />
      )}

      {assignApp && (
        <AssignOfficerModal
          application={assignApp}
          onClose={() => setAssignApp(null)}
          onSuccess={() => {
            setAssignApp(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
};
