import React, { useState, useEffect } from 'react';
import {
  Building2,
  FileText,
  AlertTriangle,
  FolderCheck,
  ShieldCheck,
  Plus,
  Clock,
  ExternalLink,
  ChevronRight,
  Search,
  Filter
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Application, DocumentItem, ComplianceUndertaking } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { NewApplicationModal } from './NewApplicationModal';
import { CorrectionModal } from './CorrectionModal';
import { DocumentUploadModal } from './DocumentUploadModal';
import { UndertakingModal } from './UndertakingModal';

interface InstitutionDashboardProps {
  onSelectApplication: (appId: string) => void;
  activeTab?: string;
}

export const InstitutionDashboard: React.FC<InstitutionDashboardProps> = ({
  onSelectApplication,
  activeTab = 'overview'
}) => {
  const { token, user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [undertakings, setUndertakings] = useState<ComplianceUndertaking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Modals
  const [showNewAppModal, setShowNewAppModal] = useState(false);
  const [correctionApp, setCorrectionApp] = useState<Application | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showUndertakingModal, setShowUndertakingModal] = useState(false);

  const fetchData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [appRes, docRes, undRes] = await Promise.all([
        fetch('/api/applications', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/compliance/documents', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/compliance/undertakings', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (appRes.ok) {
        const data = await appRes.json();
        setApplications(data.applications || []);
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
      console.error('Failed to load institution data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, user]);

  const inst = user?.institution;
  const pendingCorrections = applications.filter(a => a.status === 'CORRECTION_REQUIRED');
  const expiringDocs = documents.filter(d => {
    const diff = (new Date(d.valid_to).getTime() - Date.now()) / (1000 * 3600 * 24);
    return diff <= 30;
  });

  const filteredApps = applications.filter(app => {
    const matchSearch =
      app.application_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.application_type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = typeFilter === 'ALL' || app.application_type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Institution Overview */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-blue-600 font-semibold bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
              AICTE PID: {inst?.permanent_id || '1-3321456789'}
            </span>
            <span className="text-xs text-slate-500">
              Region: {inst?.region || 'Western'} · State: {inst?.state || 'Maharashtra'}
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1.5">
            {inst?.name || 'Technical Institute'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {inst?.address}, {inst?.city} · Principal: {inst?.principal_name} ({inst?.principal_phone})
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-3.5 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <FolderCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Upload Document</span>
          </button>

          <button
            onClick={() => setShowNewAppModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Application</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Approval Dossiers</span>
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {applications.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {applications.filter(a => a.status === 'APPROVED').length} Approved for 2026-27
          </div>
        </div>

        <div className="bg-white p-5 border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Corrections Required</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-600 tabular-nums">
            {pendingCorrections.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Returned by Scrutiny Desk
          </div>
        </div>

        <div className="bg-white p-5 border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Prescribed Documents</span>
            <FolderCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {documents.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {expiringDocs.length > 0 ? (
              <span className="text-amber-600 font-medium">{expiringDocs.length} expiring soon</span>
            ) : (
              'All documents valid'
            )}
          </div>
        </div>

        <div className="bg-white p-5 border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Commitment Undertakings</span>
            <ShieldCheck className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {undertakings.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {undertakings.filter(u => u.status === 'OVERDUE').length > 0 ? (
              <span className="text-rose-600 font-medium">1 overdue commitment</span>
            ) : (
              'Active compliance'
            )}
          </div>
        </div>
      </div>

      {/* Critical Action Banner for Deficiencies if any */}
      {pendingCorrections.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900">
                Action Required: Application {pendingCorrections[0].application_number} Returned
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">
                The Scrutiny Officer returned this application with deficiencies. Rectifications must be submitted to prevent timeline forfeiture.
              </p>
            </div>
          </div>
          <button
            onClick={() => setCorrectionApp(pendingCorrections[0])}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold cursor-pointer whitespace-nowrap shadow-xs"
          >
            Submit Rectification Now
          </button>
        </div>
      )}

      {/* Main Table: Applications */}
      {(activeTab === 'overview' || activeTab === 'applications') && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              <h3 className="font-semibold text-xs text-slate-900 uppercase tracking-wider">
                My Approval Applications ({applications.length})
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search application #..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 border border-slate-300 rounded text-xs bg-white focus:ring-1 focus:ring-blue-500 w-44"
                />
              </div>

              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white text-slate-700"
              >
                <option value="ALL">All Types</option>
                <option value="EOA">EoA</option>
                <option value="INCREASE_INTAKE">Increase Intake</option>
                <option value="NEW_COURSE">New Course</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Application Reference</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Current Stage</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Stage Deadline</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredApps.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No applications found matching query.
                    </td>
                  </tr>
                ) : (
                  filteredApps.map(app => {
                    const isOverdue = app.stage_deadline_at && new Date(app.stage_deadline_at) < new Date() && app.status !== 'APPROVED' && app.status !== 'REJECTED';
                    return (
                      <tr
                        key={app.id}
                        onClick={() => onSelectApplication(app.id)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">
                          {app.application_number}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {app.application_type.replace(/_/g, ' ')}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">
                          {app.current_stage_code.replace(/STAGE_/g, '').replace(/_/g, ' ')}
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={app.status} size="sm" />
                        </td>
                        <td className="py-3.5 px-4 font-mono tabular-nums">
                          {app.stage_deadline_at ? (
                            <span className={isOverdue ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                              {new Date(app.stage_deadline_at).toLocaleDateString()}
                              {isOverdue && ' (Overdue)'}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {app.status === 'CORRECTION_REQUIRED' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCorrectionApp(app);
                                }}
                                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold cursor-pointer"
                              >
                                Rectify
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

      {/* Prescribed Documents Section */}
      {(activeTab === 'overview' || activeTab === 'documents') && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderCheck className="w-4 h-4 text-slate-500" />
              <h3 className="font-semibold text-xs text-slate-900 uppercase tracking-wider">
                Prescribed Statutory Documents Registry
              </h3>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
            >
              + Upload Statutory Doc
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Document Title</th>
                  <th className="py-3 px-4">Document Type</th>
                  <th className="py-3 px-4">Validity Period</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.map(doc => {
                  const daysLeft = Math.ceil((new Date(doc.valid_to).getTime() - Date.now()) / (1000 * 3600 * 24));
                  const isExpiring = daysLeft <= 30 && daysLeft >= 0;
                  const isExpired = daysLeft < 0;

                  return (
                    <tr key={doc.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {doc.title}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                        {doc.document_type}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums">
                        <span className="text-slate-600">{doc.valid_from} to </span>
                        <span className={isExpired ? 'text-rose-600 font-bold' : isExpiring ? 'text-amber-600 font-semibold' : 'text-slate-800'}>
                          {doc.valid_to}
                        </span>
                        {isExpiring && <span className="text-amber-600 text-[10px] ml-1">({daysLeft}d left)</span>}
                        {isExpired && <span className="text-rose-600 text-[10px] ml-1">(Expired)</span>}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={doc.verification_status} size="sm" />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <a
                          href={`/api/compliance/documents/${doc.id}/download?token=${encodeURIComponent(token || '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:text-blue-800 font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Deficiencies & Corrections Section */}
      {(activeTab === 'overview' || activeTab === 'deficiencies') && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h3 className="font-semibold text-xs text-slate-900 uppercase tracking-wider">
                Deficiencies & Clarification Rectification Desk
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              {applications.filter(a => a.status === 'CORRECTION_REQUIRED').length} active correction required
            </span>
          </div>

          <div className="p-4 space-y-4">
            {applications.flatMap(a => (a.deficiencies || []).map(d => ({ ...d, app: a }))).length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No deficiencies recorded against your institution applications.
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
                        Category: {item.category} · Raised by: {item.raised_by_name} ({new Date(item.raised_at).toLocaleDateString()})
                      </div>

                      {item.institutional_response && (
                        <div className="mt-2 p-2.5 bg-blue-50/60 border border-blue-200 rounded text-xs">
                          <span className="font-semibold text-blue-900 block">Submitted Response:</span>
                          <span className="text-blue-800">{item.institutional_response}</span>
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {item.app.status === 'CORRECTION_REQUIRED' && (
                        <button
                          onClick={() => setCorrectionApp(item.app)}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold cursor-pointer shadow-xs"
                        >
                          Rectify Now
                        </button>
                      )}
                      <button
                        onClick={() => onSelectApplication(item.app.id)}
                        className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-medium cursor-pointer"
                      >
                        View Dossier
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compliance Undertakings */}
      {(activeTab === 'overview' || activeTab === 'compliance') && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-500" />
              <h3 className="font-semibold text-xs text-slate-900 uppercase tracking-wider">
                Time-Bound Compliance Undertakings
              </h3>
            </div>
            <button
              onClick={() => setShowUndertakingModal(true)}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
            >
              + Submit Undertaking
            </button>
          </div>

          <div className="p-4 divide-y divide-slate-100 space-y-3">
            {undertakings.map(u => (
              <div key={u.id} className="pt-3 first:pt-0 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-slate-900">{u.title}</span>
                    <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                      {u.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{u.description}</p>
                  <div className="text-[11px] text-slate-500 mt-1 font-mono">
                    Deadline: <span className={u.status === 'OVERDUE' ? 'text-rose-600 font-bold' : 'text-slate-800'}>{u.deadline_date}</span>
                    {u.notes && <span className="ml-3 italic text-slate-500">Note: {u.notes}</span>}
                  </div>
                </div>
                <StatusBadge status={u.status} size="sm" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {showNewAppModal && (
        <NewApplicationModal
          onClose={() => setShowNewAppModal(false)}
          onSuccess={() => {
            setShowNewAppModal(false);
            fetchData();
          }}
        />
      )}

      {correctionApp && (
        <CorrectionModal
          application={correctionApp}
          onClose={() => setCorrectionApp(null)}
          onSuccess={() => {
            setCorrectionApp(null);
            fetchData();
          }}
        />
      )}

      {showUploadModal && (
        <DocumentUploadModal
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            setShowUploadModal(false);
            fetchData();
          }}
        />
      )}

      {showUndertakingModal && (
        <UndertakingModal
          onClose={() => setShowUndertakingModal(false)}
          onSuccess={() => {
            setShowUndertakingModal(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
};
