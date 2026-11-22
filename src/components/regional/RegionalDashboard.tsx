import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Award,
  ChevronRight,
  Plus,
  ShieldCheck,
  Building2,
  FileText
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Application, EvcVisit } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { ScheduleEvcModal } from './ScheduleEvcModal';
import { RecordOutcomeModal } from './RecordOutcomeModal';
import { SacHearingModal } from './SacHearingModal';
import { DocumentItem, ComplianceUndertaking } from '../../types';

interface RegionalDashboardProps {
  onSelectApplication: (appId: string) => void;
  activeTab?: string;
}

export const RegionalDashboard: React.FC<RegionalDashboardProps> = ({
  onSelectApplication,
  activeTab = 'overview'
}) => {
  const { token, user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [visits, setVisits] = useState<EvcVisit[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [undertakings, setUndertakings] = useState<ComplianceUndertaking[]>([]);
  const [loading, setLoading] = useState(true);

  const [scheduleApp, setScheduleApp] = useState<Application | null>(null);
  const [outcomeVisit, setOutcomeVisit] = useState<EvcVisit | null>(null);
  const [sacApp, setSacApp] = useState<Application | null>(null);

  const fetchData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [appRes, visitRes, docRes, undRes] = await Promise.all([
        fetch('/api/applications', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/evc/visits', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/compliance/documents', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/compliance/undertakings', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (appRes.ok) {
        const data = await appRes.json();
        setApplications(data.applications || []);
      }
      if (visitRes.ok) {
        const data = await visitRes.json();
        setVisits(data.visits || []);
      }
      if (docRes.ok) {
        const data = await docRes.json();
        setDocuments(data.documents || []);
      }
      if (undRes.ok) {
        const data = await undRes.json();
        setUndertakings(data.undertakings || []);
      }
    } catch (err) {
      console.error('Failed to load regional data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, user]);

  const evcPendingApps = applications.filter(a => a.status === 'UNDER_EVC');
  const sacCases = applications.filter(a => a.current_stage_code === 'STAGE_SAC_SHC' || a.status === 'UNDER_SAC_SHC');
  const upcomingVisits = visits.filter(v => v.visit_status === 'SCHEDULED' || v.visit_status === 'PROPOSED');

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-indigo-600 font-semibold bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-200">
              Regional Office Desk
            </span>
            <span className="text-xs text-slate-500">
              Jurisdiction: {user?.region || 'Western'} Region · Regional Directorate
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1.5">
            Regional Operations, EVC Scheduling & Committee Inspections
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Coordinate Expert Visiting Committees, check expert availability conflicts, record physical findings, and conduct SAC/SHC appellate proceedings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {evcPendingApps.length > 0 && (
            <button
              onClick={() => setScheduleApp(evcPendingApps[0])}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Schedule EVC Visit</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">EVC Pipeline</span>
            <CalendarIcon className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {evcPendingApps.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Cleared Scrutiny, Awaiting Visit
          </div>
        </div>

        <div className="bg-white p-5 border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Scheduled Inspections</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-blue-600 tabular-nums">
            {upcomingVisits.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Committees Confirmed
          </div>
        </div>

        <div className="bg-white p-5 border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">SAC / SHC Cases</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-600 tabular-nums">
            {sacCases.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Appellate & Hearing Queue
          </div>
        </div>

        <div className="bg-white p-5 border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Inspection Reports Filed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 tabular-nums">
            {visits.filter(v => v.visit_status === 'REPORT_SUBMITTED').length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Ready for Executive Committee
          </div>
        </div>
      </div>

      {/* SAC / SHC Hearings Desk */}
      {(activeTab === 'overview' || activeTab === 'sac_shc') && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-600" />
              <h3 className="font-semibold text-xs text-slate-900 uppercase tracking-wider">
                Standing Appellate Committee (SAC) & Standing Hearing Committee (SHC) Queue ({sacCases.length})
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              Quorum & Appellate Proceedings Desk
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Application</th>
                  <th className="py-3 px-4">Institution</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Stage</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Appellate Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sacCases.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No applications currently referred to SAC / SHC in this jurisdiction.
                    </td>
                  </tr>
                ) : (
                  sacCases.map(app => (
                    <tr
                      key={app.id}
                      onClick={() => onSelectApplication(app.id)}
                      className="hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {app.application_number}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {app.institution_name}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {app.application_type.replace(/_/g, ' ')}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-amber-700">
                        SAC / SHC Hearing
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={app.status} size="sm" />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSacApp(app);
                          }}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold cursor-pointer shadow-xs"
                        >
                          Conduct SAC/SHC Hearing
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EVC Visits Section (Calendar / List) */}
      {(activeTab === 'overview' || activeTab === 'evc_scheduler' || activeTab === 'evc_reports') && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-indigo-600" />
              <h3 className="font-semibold text-xs text-slate-900 uppercase tracking-wider">
                Expert Visiting Committee (EVC) Calendar & Inspection Schedule
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Conflict Detection: <span className="text-emerald-700 font-bold">Enabled</span>
            </span>
          </div>

          <div className="p-4 space-y-4">
            {visits.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No EVC visits currently scheduled. Select an application in the EVC pipeline below to assign a committee.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {visits.map(v => (
                  <div
                    key={v.id}
                    className="p-5 border border-slate-200 rounded-lg bg-slate-50/50 hover:bg-slate-50 transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900">
                            {v.application_number}
                          </span>
                          <StatusBadge status={v.visit_status} size="sm" />
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 mt-1">
                          {v.institution_name}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {v.region} Region · Type: {v.visit_type}
                        </p>
                      </div>

                      <StatusBadge status={v.outcome} size="sm" />
                    </div>

                    <div className="p-3 bg-white border border-slate-200 rounded text-xs space-y-1">
                      <div className="flex justify-between text-slate-600">
                        <span>Inspection Date:</span>
                        <span className="font-mono font-semibold text-slate-900">
                          {new Date(v.proposed_date).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Committee Size:</span>
                        <span className="font-mono text-slate-800">
                          {v.committee_members?.length || 3} Experts Assigned
                        </span>
                      </div>
                    </div>

                    {/* Member previews */}
                    <div className="text-[11px] text-slate-600 space-y-1">
                      <span className="font-semibold text-slate-700 block">Committee Composition:</span>
                      {v.committee_members?.map(m => (
                        <div key={m.id} className="flex items-center justify-between truncate">
                          <span>• {m.member_name} ({m.role_in_committee.replace(/_/g, ' ')})</span>
                          <span className="text-slate-400 font-mono text-[10px]">{m.affiliation}</span>
                        </div>
                      ))}
                    </div>

                    {v.report_summary && (
                      <div className="p-2.5 bg-slate-100 rounded text-xs">
                        <span className="font-semibold text-slate-800 block">Inspection Findings:</span>
                        <p className="text-slate-600 mt-0.5">{v.report_summary}</p>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                      <button
                        onClick={() => onSelectApplication(v.application_id)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                      >
                        View Application Dossier →
                      </button>

                      {v.visit_status === 'SCHEDULED' && (
                        <button
                          onClick={() => setOutcomeVisit(v)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold cursor-pointer"
                        >
                          Record Inspection Outcome
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Applications Awaiting EVC Scheduling */}
      {(activeTab === 'overview' || activeTab === 'evc_scheduler') && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <h3 className="font-semibold text-xs text-slate-900 uppercase tracking-wider">
                Applications In EVC Stage ({evcPendingApps.length})
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              Desk Scrutiny Cleared · Ready for Visit Scheduling
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Application</th>
                  <th className="py-3 px-4">Institution</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Current Status</th>
                  <th className="py-3 px-4">SLA Deadline</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {evcPendingApps.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No applications currently waiting for EVC scheduling.
                    </td>
                  </tr>
                ) : (
                  evcPendingApps.map(app => (
                    <tr
                      key={app.id}
                      onClick={() => onSelectApplication(app.id)}
                      className="hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {app.application_number}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {app.institution_name}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {app.application_type.replace(/_/g, ' ')}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={app.status} size="sm" />
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-slate-600">
                        {app.stage_deadline_at ? new Date(app.stage_deadline_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setScheduleApp(app);
                          }}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold cursor-pointer"
                        >
                          Schedule Visit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Regional Compliance & Document Desk */}
      {(activeTab === 'overview' || activeTab === 'compliance') && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              <h3 className="font-semibold text-xs text-slate-900 uppercase tracking-wider">
                Regional Institutional Compliance & Statutory Validities
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              {undertakings.length} undertakings · {documents.length} statutory files
            </span>
          </div>

          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
                <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider mb-2">
                  Active Undertakings ({undertakings.length})
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {undertakings.map(u => (
                    <div key={u.id} className="p-2.5 bg-white border border-slate-200 rounded text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">{u.title}</span>
                        <StatusBadge status={u.status} size="sm" />
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Deadline: {u.deadline_date} · Category: {u.category}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
                <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider mb-2">
                  Institutional Statutory Attachments ({documents.length})
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {documents.map(d => (
                    <div key={d.id} className="p-2.5 bg-white border border-slate-200 rounded text-xs flex items-center justify-between gap-2">
                      <div>
                        <span className="font-semibold text-slate-900 block truncate">{d.title}</span>
                        <span className="text-[11px] text-slate-500">Valid: {d.valid_from} to {d.valid_to}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={d.verification_status} size="sm" />
                        <a
                          href={`/api/compliance/documents/${d.id}/download?token=${encodeURIComponent(token || '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-[11px] font-semibold"
                        >
                          View
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {scheduleApp && (
        <ScheduleEvcModal
          application={scheduleApp}
          onClose={() => setScheduleApp(null)}
          onSuccess={() => {
            setScheduleApp(null);
            fetchData();
          }}
        />
      )}

      {outcomeVisit && (
        <RecordOutcomeModal
          visit={outcomeVisit}
          onClose={() => setOutcomeVisit(null)}
          onSuccess={() => {
            setOutcomeVisit(null);
            fetchData();
          }}
        />
      )}

      {sacApp && (
        <SacHearingModal
          application={sacApp}
          onClose={() => setSacApp(null)}
          onSuccess={() => {
            setSacApp(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
};
