import React, { useState } from 'react';
import { X, Award, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { EvcVisit } from '../../types';

interface RecordOutcomeModalProps {
  visit: EvcVisit;
  onClose: () => void;
  onSuccess: () => void;
}

export const RecordOutcomeModal: React.FC<RecordOutcomeModalProps> = ({ visit, onClose, onSuccess }) => {
  const { token } = useAuth();
  const [outcome, setOutcome] = useState<'RECOMMENDED' | 'DEFICIENCIES_OBSERVED' | 'NOT_RECOMMENDED'>('RECOMMENDED');
  const [infraScore, setInfraScore] = useState(92);
  const [labScore, setLabScore] = useState(88);
  const [facultyRatio, setFacultyRatio] = useState(94);
  const [reportSummary, setReportSummary] = useState('Physical inspection verified all laboratories, computing centers, barrier-free access, and faculty attendance rolls. Infrastructure meets Approval Process Handbook guidelines.');
  const [recommendations, setRecommendations] = useState('Recommended for grant of Extension of Approval with the requested intake capacity.');
  const [advanceStage, setAdvanceStage] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!reportSummary.trim() || reportSummary.trim().length < 10) {
      setError('Inspection report summary must be at least 10 characters.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/evc/visits/${visit.id}/record-outcome`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          outcome,
          infrastructure_score: Number(infraScore),
          lab_compliance_score: Number(labScore),
          faculty_presence_ratio: Number(facultyRatio),
          report_summary: reportSummary.trim(),
          recommendations: recommendations.trim(),
          advance_stage: advanceStage
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record visit outcome.');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error recording outcome.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-xl w-full my-8 shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold">Record EVC Inspection Outcome</h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Visit ID: {visit.id} · {visit.institution_name}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Visiting Committee Recommendation *
            </label>
            <select
              value={outcome}
              onChange={e => setOutcome(e.target.value as any)}
              className="w-full border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 font-semibold"
            >
              <option value="RECOMMENDED">RECOMMENDED (Statutory compliance satisfied)</option>
              <option value="DEFICIENCIES_OBSERVED">DEFICIENCIES OBSERVED (Referred to SAC/SHC Hearing)</option>
              <option value="NOT_RECOMMENDED">NOT RECOMMENDED (Critical deviations found)</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Infrastructure Score (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={infraScore}
                onChange={e => setInfraScore(Number(e.target.value))}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900 font-mono"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Lab Equipment Score (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={labScore}
                onChange={e => setLabScore(Number(e.target.value))}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900 font-mono"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Faculty Ratio (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={facultyRatio}
                onChange={e => setFacultyRatio(Number(e.target.value))}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900 font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Committee Inspection Report Summary *
            </label>
            <textarea
              rows={3}
              value={reportSummary}
              onChange={e => setReportSummary(e.target.value)}
              className="w-full border border-slate-300 rounded p-2.5 bg-white text-slate-900"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Final Recommendations & Conditions
            </label>
            <textarea
              rows={2}
              value={recommendations}
              onChange={e => setRecommendations(e.target.value)}
              className="w-full border border-slate-300 rounded p-2.5 bg-white text-slate-900"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="advance"
              checked={advanceStage}
              onChange={e => setAdvanceStage(e.target.checked)}
              className="rounded text-blue-600 cursor-pointer"
            />
            <label htmlFor="advance" className="text-slate-700 cursor-pointer font-medium">
              Advance application to next workflow stage based on configured template
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded hover:bg-slate-50 cursor-pointer font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Award className="w-3.5 h-3.5" />
              <span>{loading ? 'Filing...' : 'Submit Official Report'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
