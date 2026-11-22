import React, { useState, useEffect } from 'react';
import {
  ClipboardCheck,
  Search,
  Filter,
  Clock,
  AlertTriangle,
  ChevronRight,
  ShieldAlert,
  FileCheck2,
  CheckCircle2,
  Calendar,
  Building
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Application, DocumentItem } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { ApplicationReviewModal } from './ApplicationReviewModal';
import { ExternalLink, FolderCheck, History } from 'lucide-react';

interface ScrutinyDashboardProps {
  onSelectApplication: (appId: string) => void;
  activeTab?: string;
}

export const ScrutinyDashboard: React.FC<ScrutinyDashboardProps> = ({
  onSelectApplication,
  activeTab = 'overview'
}) => {
  const { token, user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [stageFilter, setStageFilter] = useState('ALL');
  const [regionFilter, setRegionFilter] = useState('ALL');
  const [deadlineFilter, setDeadlineFilter] = useState('ALL'); // 'ALL' | 'APPROACHING' | 'OVERDUE'

  const [reviewApp, setReviewApp] = useState<Application | null>(null);

  const fetchApplications = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [appRes, docRes] = await Promise.all([
        fetch('/api/applications', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/compliance/documents', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (appRes.ok) {
        const data = await appRes.json();
        setApplications(data.applications || []);
      }
      if (docRes.ok) {
        const data = await docRes.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error('Failed to load applications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyDoc = async (docId: string, status: 'VERIFIED' | 'DEFICIENT') => {
    const notes = status === 'DEFICIENT' ? prompt('Enter reason for document deficiency:') : 'Document examined and verified.';
    if (status === 'DEFICIENT' && !notes) return;
    try {
      const res = await fetch(`/api/compliance/documents/${docId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ verification_status: status, verification_notes: notes })
      });
      if (res.ok) {
        fetchApplications();
      }
    } catch (err) {
      console.error('Error verifying doc:', err);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [token, user]);

  const now = Date.now();
  const in48Hours = now + 48 * 3600 * 1000;

  const filteredApps = applications.filter(app => {
    // Search
    const query = searchTerm.toLowerCase();
    const matchSearch =
      app.application_number.toLowerCase().includes(query) ||
      (app.institution_name && app.institution_name.toLowerCase().includes(query)) ||
      (app.permanent_id && app.permanent_id.includes(query));

    // Type
    const matchType = typeFilter === 'ALL' || app.application_type === typeFilter;

    // Stage
    const matchStage = stageFilter === 'ALL' || app.current_stage_code === stageFilter;

    // Region
    const matchRegion = regionFilter === 'ALL' || app.assigned_region === regionFilter;

    // Deadline filter
    let matchDeadline = true;
    if (deadlineFilter === 'OVERDUE') {
      matchDeadline = !!app.stage_deadline_at && new Date(app.stage_deadline_at).getTime() < now && app.status !== 'APPROVED' && app.status !== 'REJECTED';
    } else if (deadlineFilter === 'APPROACHING') {
      const d = app.stage_deadline_at ? new Date(app.stage_deadline_at).getTime() : 0;
      matchDeadline = d >= now && d <= in48Hours && app.status !== 'APPROVED' && app.status !== 'REJECTED';
    }

    // Specific sidebar tab filtering
    if (activeTab === 'returned') {
      return matchSearch && app.status === 'CORRECTION_REQUIRED';
    }
    if (activeTab === 'queue') {
      return matchSearch && (app.status === 'UNDER_SCRUTINY' || app.status === 'RESUBMITTED');
    }

    return matchSearch && matchType && matchStage && matchRegion && matchDeadline;
  });

  const totalAssigned = applications.length;
  const underScrutinyCount = applications.filter(a => a.status === 'UNDER_SCRUTINY' || a.status === 'RESUBMITTED').length;
  const approachingCount = applications.filter(a => {
    const d = a.stage_deadline_at ? new Date(a.stage_deadline_at).getTime() : 0;
    return d >= now && d <= in48Hours && a.status !== 'APPROVED' && a.status !== 'REJECTED';
  }).length;
  const overdueCount = applications.filter(a => {
    const d = a.stage_deadline_at ? new Date(a.stage_deadline_at).getTime() : 0;
    return d < now && a.status !== 'APPROVED' && a.status !== 'REJECTED' && !!a.stage_deadline_at;
  }).length;

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-blue-600 font-semibold bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
              Scrutiny Officer Desk
            </span>
            <span className="text-xs text-slate-500">
              Jurisdiction: {user?.region || 'Western'} Region · Bureau of Approvals
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1.5">
            Technical Scrutiny & Document Verification Queue
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Review eligibility norms, examine statutory attachments, record deficiencies and advance approved dossiers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchApplications}
            className="px-3.5 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer"
          >
            Refresh Queue
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Assigned Applications</span>
            <ClipboardCheck className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {totalAssigned}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Western Regional Office Desk
          </div>
        </div>

        <div className="bg-white p-5 border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Under Active Scrutiny</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-blue-600 tabular-nums">
            {underScrutinyCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Pending Officer Examination
          </div>
        </div>

        <div className="bg-white p-5 border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Approaching SLA (&lt; 48h)</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-600 tabular-nums">
            {approachingCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Priority Action Required
          </div>
        </div>

        <div className="bg-white p-5 border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Overdue Applications</span>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-600 tabular-nums">
            {overdueCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Eligible for n8n Webhook Escalation
          </div>
        </div>
      </div>

      {/* Document Review Desk */}
      {activeTab === 'documents' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderCheck className="w-4 h-4 text-blue-600" />
              <h3 className="font-semibold text-xs text-slate-900 uppercase tracking-wider">
                Prescribed Statutory Documents Examination Desk ({documents.length})
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              Direct verification of Land, Building Plan, Fire Safety & Affidavits
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Document Title</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Validity</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-right">Verification Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No documents available for review.
                    </td>
                  </tr>
                ) : (
                  documents.map(doc => (
                    <tr key={doc.id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {doc.title}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                        {doc.document_type}
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-slate-600">
                        {doc.valid_from} to {doc.valid_to}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={doc.verification_status} size="sm" />
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 text-[11px] italic max-w-xs truncate">
                        {doc.verification_notes || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleVerifyDoc(doc.id, 'VERIFIED')}
                            className="px-2 py-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded border border-emerald-300 transition-colors cursor-pointer"
                          >
                            Verify
                          </button>
                          <button
                            onClick={() => handleVerifyDoc(doc.id, 'DEFICIENT')}
                            className="px-2 py-1 text-[11px] font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 rounded border border-rose-300 transition-colors cursor-pointer"
                          >
                            Flag Deficient
                          </button>
                          <a
                            href={`/api/compliance/documents/${doc.id}/download?token=${encodeURIComponent(token || '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 text-blue-600 hover:text-blue-800"
                            title="Download document"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Observations History Desk */}
      {activeTab === 'audit' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" />
              <h3 className="font-semibold text-xs text-slate-900 uppercase tracking-wider">
                Scrutiny Observations & Deficiencies Log
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              Audit trail of recorded observations across all assigned dossiers
            </span>
          </div>

          <div className="p-4 space-y-3">
            {applications.flatMap(a => (a.deficiencies || []).map(d => ({ ...d, app: a }))).length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No observations or deficiencies recorded.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 space-y-3">
                {applications.flatMap(a => (a.deficiencies || []).map(d => ({ ...d, app: a }))).map(item => (
                  <div key={item.id} className="pt-3 first:pt-0 flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {item.app.application_number}
                        </span>
                        <span className="text-xs text-slate-600 font-medium">
                          ({item.app.institution_name})
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase font-mono ${
                          item.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-800' :
                          item.severity === 'MAJOR' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'
                        }`}>
                          {item.severity}
                        </span>
                        <StatusBadge status={item.status} size="sm" />
                      </div>
                      <p className="text-xs text-slate-800 font-medium">
                        {item.description}
                      </p>
                      <div className="text-[11px] text-slate-500">
                        Category: {item.category} · Recorded by: {item.raised_by_name} ({new Date(item.raised_at).toLocaleDateString()})
                      </div>
                      {item.institutional_response && (
                        <div className="mt-1.5 p-2 bg-blue-50/70 border border-blue-200 rounded text-xs text-blue-900">
                          <span className="font-semibold block">Institutional Response:</span>
                          <span>{item.institutional_response}</span>
                        </div>
                      )}
                    </div>

                    <div className="shrink-0">
                      <button
                        onClick={() => onSelectApplication(item.app.id)}
                        className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-medium cursor-pointer"
                      >
                        Open Dossier
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filter and Table Card */}
      {(activeTab === 'overview' || activeTab === 'queue' || activeTab === 'returned') && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          {/* Filters Toolbar */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search institute / app #..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 border border-slate-300 rounded text-xs bg-white focus:ring-1 focus:ring-blue-500 w-52"
                />
              </div>

              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white text-slate-700"
              >
                <option value="ALL">All Application Types</option>
                <option value="EOA">Extension of Approval</option>
                <option value="INCREASE_INTAKE">Increase Intake</option>
                <option value="NEW_COURSE">New Course</option>
              </select>

              <select
                value={regionFilter}
                onChange={e => setRegionFilter(e.target.value)}
                className="border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white text-slate-700"
              >
                <option value="ALL">All Regions</option>
                <option value="Western">Western</option>
                <option value="Northern">Northern</option>
                <option value="South-Western">South-Western</option>
                <option value="Eastern">Eastern</option>
              </select>

              <select
                value={deadlineFilter}
                onChange={e => setDeadlineFilter(e.target.value)}
                className="border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white text-slate-700"
              >
                <option value="ALL">All Deadlines</option>
                <option value="APPROACHING">Approaching (&lt; 48h)</option>
                <option value="OVERDUE">Overdue (&gt; SLA)</option>
              </select>
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-800">{filteredApps.length}</span> cases
            </div>
          </div>

          {/* Applications Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Application Details</th>
                  <th className="py-3 px-4">Institution & Region</th>
                  <th className="py-3 px-4">Stage</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Age / Deadline</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredApps.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No applications match the current scrutiny filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredApps.map(app => {
                    const isOverdue = app.stage_deadline_at && new Date(app.stage_deadline_at).getTime() < now && app.status !== 'APPROVED' && app.status !== 'REJECTED';
                    const isApproaching = app.stage_deadline_at && new Date(app.stage_deadline_at).getTime() >= now && new Date(app.stage_deadline_at).getTime() <= in48Hours && app.status !== 'APPROVED' && app.status !== 'REJECTED';

                    const daysSinceSubmission = app.submitted_at
                      ? Math.floor((now - new Date(app.submitted_at).getTime()) / (1000 * 3600 * 24))
                      : 0;

                    return (
                      <tr
                        key={app.id}
                        onClick={() => onSelectApplication(app.id)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-slate-900">
                            {app.application_number}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {app.application_type.replace(/_/g, ' ')} · Rule v{app.workflow_rule_version}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-800">
                            {app.institution_name}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            PID: {app.permanent_id} · {app.assigned_region}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-medium text-slate-700">
                          {app.current_stage_code.replace(/STAGE_/g, '').replace(/_/g, ' ')}
                        </td>

                        <td className="py-3.5 px-4">
                          <StatusBadge status={app.status} size="sm" />
                        </td>

                        <td className="py-3.5 px-4 font-mono tabular-nums">
                          <div className="text-slate-600">
                            Age: <span className="font-bold text-slate-800">{daysSinceSubmission}d</span>
                          </div>
                          <div className="text-[11px] mt-0.5">
                            {app.stage_deadline_at ? (
                              isOverdue ? (
                                <span className="text-rose-600 font-bold">Overdue</span>
                              ) : isApproaching ? (
                                <span className="text-amber-600 font-bold">Due in &lt; 48h</span>
                              ) : (
                                <span className="text-slate-500">Due: {new Date(app.stage_deadline_at).toLocaleDateString()}</span>
                              )
                            ) : (
                              '—'
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {(app.status === 'UNDER_SCRUTINY' || app.status === 'RESUBMITTED') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReviewApp(app);
                                }}
                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold cursor-pointer"
                              >
                                Review
                              </button>
                            )}
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Review & Action Modal */}
      {reviewApp && (
        <ApplicationReviewModal
          application={reviewApp}
          onClose={() => setReviewApp(null)}
          onSuccess={() => {
            setReviewApp(null);
            fetchApplications();
          }}
        />
      )}
    </div>
  );
};
