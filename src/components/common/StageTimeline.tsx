import React from 'react';
import { CheckCircle2, Clock, AlertCircle, ArrowRight, ShieldAlert } from 'lucide-react';
import { WorkflowStageDef, StageHistoryItem } from '../../types';

interface StageTimelineProps {
  currentStageCode: string;
  status: string;
  stagesConfig: WorkflowStageDef[];
  history: StageHistoryItem[];
  stageDeadlineAt?: string;
  ruleVersion?: number;
}

export const StageTimeline: React.FC<StageTimelineProps> = ({
  currentStageCode,
  status,
  stagesConfig,
  history,
  stageDeadlineAt,
  ruleVersion = 1
}) => {
  // If no stagesConfig provided, default to Scrutiny + EVC + Final Decision
  const stages = stagesConfig.length > 0 ? stagesConfig : [
    { code: 'STAGE_SCRUTINY', name: 'Document Scrutiny', required_role: 'SCRUTINY_OFFICER' as const, deadline_days: 7, allow_return: true, next_stage: 'STAGE_EVC' },
    { code: 'STAGE_EVC', name: 'Expert Visiting Committee', required_role: 'REGIONAL_OFFICER' as const, deadline_days: 10, allow_return: false, next_stage: 'STAGE_FINAL_APPROVAL' },
    { code: 'STAGE_FINAL_APPROVAL', name: 'Competent Authority Final Decision', required_role: 'ADMIN' as const, deadline_days: 5, allow_return: false, next_stage: null }
  ];

  const currentStageIndex = stages.findIndex(s => s.code === currentStageCode);

  const isStageComplete = (index: number) => {
    if (status === 'APPROVED' || status === 'REJECTED') return true;
    return index < currentStageIndex;
  };

  const isStageActive = (index: number) => {
    if (status === 'APPROVED' || status === 'REJECTED') return false;
    return index === currentStageIndex;
  };

  // Check deadline status
  const now = new Date();
  const deadlineDate = stageDeadlineAt ? new Date(stageDeadlineAt) : null;
  const isOverdue = deadlineDate && deadlineDate < now && status !== 'APPROVED' && status !== 'REJECTED';
  const hoursLeft = deadlineDate ? Math.round((deadlineDate.getTime() - now.getTime()) / (1000 * 3600)) : null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-100">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Configured Workflow Pipeline</h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Governed by Workflow Rule Specification v{ruleVersion} · {stages.length} Configured Stage Gates
          </p>
        </div>

        {stageDeadlineAt && status !== 'APPROVED' && status !== 'REJECTED' && (
          <div className="flex items-center gap-2 text-xs">
            {isOverdue ? (
              <span className="flex items-center gap-1.5 text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded font-medium">
                <ShieldAlert className="w-3.5 h-3.5" />
                Overdue by {Math.abs(Math.round((hoursLeft || 0) / 24))} days (Escalation Eligible)
              </span>
            ) : hoursLeft !== null && hoursLeft <= 48 ? (
              <span className="flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded font-medium">
                <Clock className="w-3.5 h-3.5" />
                Stage Deadline: {hoursLeft}h remaining
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Deadline: {new Date(stageDeadlineAt).toLocaleDateString()}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Progress Bars / Steps */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {stages.map((stage, idx) => {
          const completed = isStageComplete(idx);
          const active = isStageActive(idx);
          const isCorrectionState = active && status === 'CORRECTION_REQUIRED';

          return (
            <div
              key={stage.code}
              className={`p-3.5 rounded-lg border transition-all ${
                completed
                  ? 'bg-slate-50 border-emerald-200'
                  : active
                  ? isCorrectionState
                    ? 'bg-amber-50/50 border-amber-300 ring-1 ring-amber-300'
                    : 'bg-blue-50/50 border-blue-300 ring-1 ring-blue-300'
                  : 'bg-white border-slate-200 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-mono text-slate-400 font-medium">Stage 0{idx + 1}</span>
                {completed ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-700 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Cleared
                  </span>
                ) : active ? (
                  isCorrectionState ? (
                    <span className="flex items-center gap-1 text-xs text-amber-700 font-semibold">
                      <AlertCircle className="w-3.5 h-3.5" /> Action Required
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-blue-700 font-semibold">
                      <Clock className="w-3.5 h-3.5" /> In Progress
                    </span>
                  )
                ) : (
                  <span className="text-xs text-slate-400">Upcoming</span>
                )}
              </div>

              <div className="font-semibold text-sm text-slate-900 leading-snug">{stage.name}</div>
              <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
                <span>Role: {stage.required_role.replace(/_/g, ' ')}</span>
                <span className="font-mono tabular-nums">{stage.deadline_days}d SLA</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Resubmission / Correction Banner if applicable */}
      {status === 'CORRECTION_REQUIRED' && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Correction Window Open:</span> The scrutiny officer identified deficiencies and returned this application. The institution must submit point-by-point rectifications and revised documents to advance.
          </div>
        </div>
      )}

      {status === 'RESUBMITTED' && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2 text-xs text-blue-800">
          <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Resubmitted:</span> The applicant institution has uploaded rectifications. The case is now awaiting re-scrutiny verification by the designated officer.
          </div>
        </div>
      )}
    </div>
  );
};
