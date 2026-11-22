import React, { useState, useEffect } from 'react';
import {
  X,
  Building2,
  Calendar,
  Clock,
  Shield,
  FileText,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Users,
  Award,
  Layers
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Application } from '../../types';
import { StageTimeline } from './StageTimeline';
import { StatusBadge } from './StatusBadge';

interface ApplicationDetailModalProps {
  applicationId: string;
  onClose: () => void;
  onRefresh?: () => void;
  onTriggerScrutinyAction?: (app: Application) => void;
  onTriggerCorrection?: (app: Application) => void;
  onTriggerEvcSchedule?: (app: Application) => void;
  onTriggerAdminDecision?: (app: Application) => void;
  onTriggerSacHearing?: (app: Application) => void;
  onTriggerAssign?: (app: Application) => void;
}

export const ApplicationDetailModal: React.FC<ApplicationDetailModalProps> = ({
  applicationId,
  onClose,
  onRefresh,
  onTriggerScrutinyAction,
  onTriggerCorrection,
  onTriggerEvcSchedule,
  onTriggerAdminDecision,
  onTriggerSacHearing,
  onTriggerAssign
}) => {
  const { token, user } = useAuth();
  const [app, setApp] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'timeline' | 'deficiencies' | 'documents' | 'evc' | 'history'>('timeline');

  const fetchDetail = async () => {
    if (!token || !applicationId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/applications/${applicationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setApp(data.application);
      }
    } catch (err) {
      console.error('Failed to load application:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [applicationId, token]);

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
        fetchDetail();
        onRefresh?.();
      }
    } catch (err) {
      console.error('Error verifying doc:', err);
    }
  };

  const handleVerifyDeficiency = async (defId: string, status: 'VERIFIED' | 'WAIVED') => {
    try {
      const res = await fetch(`/api/applications/${app?.id}/deficiencies/${defId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchDetail();
        onRefresh?.();
      }
    } catch (err) {
      console.error('Error verifying deficiency:', err);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-700">Loading Application Dossier...</p>
        </div>
      </div>
    );
  }

  if (!app) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-5xl w-full my-8 shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-blue-400 font-semibold uppercase">
                {app.academic_year} · {app.application_type.replace(/_/g, ' ')}
              </span>
              <StatusBadge status={app.status} size="sm" />
            </div>
            <h3 className="text-lg font-bold text-white mt-1">
              {app.application_number}
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              {app.institution_name} ({app.permanent_id}) · {app.city}, {app.state}
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-6 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('timeline')}
              className={`py-3.5 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'timeline'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Workflow & SLA
            </button>
            <button
              onClick={() => setActiveTab('deficiencies')}
              className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'deficiencies'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Deficiencies</span>
              {app.deficiencies && app.deficiencies.length > 0 && (
                <span className="text-[10px] bg-slate-200 px-1.5 py-0.2 rounded-full tabular-nums">
                  {app.deficiencies.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'documents'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Documents</span>
              {app.documents && app.documents.length > 0 && (
                <span className="text-[10px] bg-slate-200 px-1.5 py-0.2 rounded-full tabular-nums">
                  {app.documents.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('evc')}
              className={`py-3.5 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'evc'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              EVC Inspection
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-3.5 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'history'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Audit History
            </button>
          </div>

          {/* Quick Context / Actions */}
          <div className="flex items-center gap-2">
            {user?.role === 'SCRUTINY_OFFICER' && (app.status === 'UNDER_SCRUTINY' || app.status === 'RESUBMITTED') && onTriggerScrutinyAction && (
              <button
                onClick={() => onTriggerScrutinyAction(app)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold cursor-pointer shadow-xs"
              >
                Perform Scrutiny Action
              </button>
            )}

            {user?.role === 'INSTITUTION' && app.status === 'CORRECTION_REQUIRED' && onTriggerCorrection && (
              <button
                onClick={() => onTriggerCorrection(app)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold cursor-pointer shadow-xs"
              >
                Submit Rectification
              </button>
            )}

            {user?.role === 'REGIONAL_OFFICER' && app.status === 'UNDER_EVC' && onTriggerEvcSchedule && (
              <button
                onClick={() => onTriggerEvcSchedule(app)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold cursor-pointer shadow-xs"
              >
                Manage EVC Visit
              </button>
            )}

            {(user?.role === 'REGIONAL_OFFICER' || user?.role === 'ADMIN') && (app.current_stage_code === 'STAGE_SAC_SHC' || app.status === 'UNDER_SAC_SHC') && onTriggerSacHearing && (
              <button
                onClick={() => onTriggerSacHearing(app)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold cursor-pointer shadow-xs"
              >
                Process SAC/SHC Hearing
              </button>
            )}

            {user?.role === 'ADMIN' && onTriggerAssign && (
              <button
                onClick={() => onTriggerAssign(app)}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-semibold cursor-pointer shadow-xs"
              >
                Assign Template / Officer
              </button>
            )}

            {user?.role === 'ADMIN' && app.status !== 'APPROVED' && app.status !== 'REJECTED' && onTriggerAdminDecision && (
              <button
                onClick={() => onTriggerAdminDecision(app)}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold cursor-pointer shadow-xs"
              >
                Final Decision
              </button>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'timeline' && (
            <div className="space-y-6">
              <StageTimeline
                currentStageCode={app.current_stage_code}
                status={app.status}
                stagesConfig={app.stagesConfig || []}
                history={app.history || []}
                stageDeadlineAt={app.stage_deadline_at}
                ruleVersion={app.workflow_rule_version}
              />

              {/* Institution & Application Meta Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">
                    Institutional Specification
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Institution Type:</span>
                      <span className="font-medium text-slate-800">{app.institution_type || 'Engineering & Technology'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Establishment Year:</span>
                      <span className="font-mono text-slate-800">{app.establishment_year || 1990}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Freehold Land Area:</span>
                      <span className="font-mono text-slate-800">{app.land_area_acres} Acres</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Built-Up Area:</span>
                      <span className="font-mono text-slate-800">{app.built_up_area_sqm?.toLocaleString()} sq.m.</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Principal / Head:</span>
                      <span className="font-medium text-slate-800">{app.principal_name}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">
                    Workflow & Officer Assignments
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Workflow Template:</span>
                      <span className="font-medium text-slate-800">{app.workflow_template_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Rule Engine Version:</span>
                      <span className="font-mono text-slate-800">Version {app.workflow_rule_version}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Assigned Scrutiny Officer:</span>
                      <span className="font-medium text-slate-800">{app.scrutiny_officer_name || 'Dr. Rajesh K. Sharma'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Regional EVC Coordinator:</span>
                      <span className="font-medium text-slate-800">{app.regional_officer_name || 'Prof. S. N. Deshmukh'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Regional Jurisdiction:</span>
                      <span className="font-medium text-slate-800">{app.assigned_region}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Final Decision block if finalized */}
              {app.final_decision && (
                <div className={`p-4 rounded-lg border ${
                  app.final_decision === 'APPROVED' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Award className="w-4 h-4" />
                    <span className="font-bold text-sm">Official Decision: {app.final_decision}</span>
                    <span className="text-xs font-mono">({new Date(app.final_decision_at || '').toLocaleDateString()})</span>
                  </div>
                  <p className="text-xs">{app.final_decision_remarks}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'deficiencies' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900">
                  Recorded Deficiencies & Clarification Log
                </h4>
                <span className="text-xs text-slate-500">
                  {app.deficiencies?.length || 0} items identified
                </span>
              </div>

              {!app.deficiencies || app.deficiencies.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-xs">
                  No deficiencies recorded against this application.
                </div>
              ) : (
                <div className="space-y-3">
                  {app.deficiencies.map(def => (
                    <div
                      key={def.id}
                      className="p-4 bg-white border border-slate-200 rounded-lg shadow-2xs space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase font-mono ${
                            def.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-800' :
                            def.severity === 'MAJOR' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'
                          }`}>
                            {def.severity}
                          </span>
                          <span className="text-xs font-mono text-slate-500">
                            Category: {def.category}
                          </span>
                        </div>
                        <StatusBadge status={def.status} size="sm" />
                      </div>

                      <p className="text-xs text-slate-800 font-medium">
                        {def.description}
                      </p>

                      <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                        <span>Raised by: {def.raised_by_name}</span>
                        <span className="font-mono">{new Date(def.raised_at).toLocaleDateString()}</span>
                      </div>

                      {def.institutional_response && (
                        <div className="mt-2 p-3 bg-blue-50/60 border border-blue-200 rounded text-xs space-y-1">
                          <span className="font-semibold text-blue-900 block">
                            Institutional Rectification Response:
                          </span>
                          <p className="text-blue-800">{def.institutional_response}</p>
                          <span className="text-[10px] text-blue-500 font-mono block mt-1">
                            Responded on: {new Date(def.responded_at || '').toLocaleDateString()}
                          </span>
                        </div>
                      )}

                      {/* Scrutiny / Regional / Admin verification controls */}
                      {(user?.role === 'SCRUTINY_OFFICER' || user?.role === 'REGIONAL_OFFICER' || user?.role === 'ADMIN') && def.status !== 'VERIFIED' && def.status !== 'WAIVED' && (
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                          <span className="text-[11px] font-semibold text-slate-600">Officer Action:</span>
                          <button
                            onClick={() => handleVerifyDeficiency(def.id, 'VERIFIED')}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium rounded transition-colors cursor-pointer"
                          >
                            Mark Verified
                          </button>
                          <button
                            onClick={() => handleVerifyDeficiency(def.id, 'WAIVED')}
                            className="px-2.5 py-1 bg-slate-600 hover:bg-slate-700 text-white text-[11px] font-medium rounded transition-colors cursor-pointer"
                          >
                            Waive Deficiency
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900">
                  Prescribed Statutory Documents & Verification
                </h4>
                <span className="text-xs text-slate-500">
                  {app.documents?.length || 0} documents on file
                </span>
              </div>

              {!app.documents || app.documents.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-xs">
                  No documents linked to this application yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
                  {app.documents.map(doc => (
                    <div key={doc.id} className="p-4 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <FileText className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-xs text-slate-900">
                            {doc.title}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Type: {doc.document_type} · Validity: {doc.valid_from} to {doc.valid_to}
                          </div>
                          {doc.verification_notes && (
                            <div className="text-[11px] text-slate-600 mt-1 italic">
                              Note: {doc.verification_notes}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <StatusBadge status={doc.verification_status} size="sm" />
                        
                        {(user?.role === 'SCRUTINY_OFFICER' || user?.role === 'REGIONAL_OFFICER' || user?.role === 'ADMIN') && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleVerifyDoc(doc.id, 'VERIFIED')}
                              className="px-2 py-1 text-[11px] font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded border border-emerald-300 transition-colors cursor-pointer"
                            >
                              Verify
                            </button>
                            <button
                              onClick={() => handleVerifyDoc(doc.id, 'DEFICIENT')}
                              className="px-2 py-1 text-[11px] font-medium bg-rose-50 text-rose-700 hover:bg-rose-100 rounded border border-rose-300 transition-colors cursor-pointer"
                            >
                              Flag Deficient
                            </button>
                          </div>
                        )}

                        <a
                          href={`/api/compliance/documents/${doc.id}/download?token=${encodeURIComponent(token || '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded border border-blue-200 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>View Doc</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'evc' && (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-900">
                Expert Visiting Committee (EVC) Schedule & Findings
              </h4>

              {!app.evcVisits || app.evcVisits.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-xs">
                  No EVC inspection visit scheduled yet for this application.
                </div>
              ) : (
                app.evcVisits.map(v => (
                  <div key={v.id} className="p-5 bg-white border border-slate-200 rounded-lg shadow-2xs space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-slate-900">
                          {v.visit_type} Inspection Visit
                        </span>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Proposed Date: {new Date(v.proposed_date).toLocaleDateString()} · Status: {v.visit_status}
                        </div>
                      </div>
                      <StatusBadge status={v.outcome} size="sm" />
                    </div>

                    {/* Committee Members list */}
                    <div>
                      <h5 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                        Assigned Committee Experts
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {app.evcMembers?.map(m => (
                          <div key={m.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs">
                            <span className="font-bold text-slate-900 block truncate">{m.member_name}</span>
                            <span className="text-blue-600 font-medium block text-[11px] truncate">{m.role_in_committee.replace(/_/g, ' ')}</span>
                            <span className="text-slate-500 text-[11px] block truncate">{m.affiliation}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {v.report_summary && (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-2">
                        <span className="font-semibold text-slate-900 block">Inspection Summary & Compliance Scores:</span>
                        <div className="grid grid-cols-3 gap-2 text-center py-1">
                          <div className="bg-white p-2 rounded border border-slate-200">
                            <span className="text-slate-500 text-[10px] block">Infrastructure</span>
                            <span className="text-sm font-bold font-mono text-slate-800">{v.infrastructure_score}%</span>
                          </div>
                          <div className="bg-white p-2 rounded border border-slate-200">
                            <span className="text-slate-500 text-[10px] block">Laboratory Equipment</span>
                            <span className="text-sm font-bold font-mono text-slate-800">{v.lab_compliance_score}%</span>
                          </div>
                          <div className="bg-white p-2 rounded border border-slate-200">
                            <span className="text-slate-500 text-[10px] block">Faculty Cadre Ratio</span>
                            <span className="text-sm font-bold font-mono text-slate-800">{v.faculty_presence_ratio}%</span>
                          </div>
                        </div>
                        <p className="text-slate-700 mt-2">{v.report_summary}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-900">
                Immutable Lifecycle Audit Log
              </h4>

              <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {app.history?.map((h, idx) => (
                  <div key={h.id || idx} className="relative">
                    <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-white" />
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">{h.action.replace(/_/g, ' ')}</span>
                        <span className="font-mono text-[10px] text-slate-400">
                          {new Date(h.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-slate-500 text-[11px] mt-0.5">
                        Actor: {h.actor_name} ({h.actor_role}) · Stage: {h.stage_name}
                      </div>
                      {h.reason && (
                        <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded text-amber-900">
                          <span className="font-bold">Reason:</span> {h.reason}
                        </div>
                      )}
                      {h.notes && <p className="text-slate-600 mt-1">{h.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
