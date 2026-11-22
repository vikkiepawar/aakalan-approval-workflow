import React, { useState } from 'react';
import { X, Award, AlertTriangle, CheckCircle, Scale } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Application } from '../../types';

interface SacHearingModalProps {
  application: Application;
  onClose: () => void;
  onSuccess: () => void;
}

export const SacHearingModal: React.FC<SacHearingModalProps> = ({ application, onClose, onSuccess }) => {
  const { token } = useAuth();
  const [outcome, setOutcome] = useState<'RECOMMENDED' | 'CONDITIONAL_APPROVAL' | 'NOT_RECOMMENDED'>('RECOMMENDED');
  const [minutes, setMinutes] = useState(
    'The Standing Hearing Committee (SHC) examined the institutional representation, verified rectification documents regarding building completion and faculty cadre, and heard the authorized representatives.'
  );
  const [conditions, setConditions] = useState(
    'Subject to continuous maintenance of approved cadre ratio and submission of annual compliance audit.'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!minutes.trim() || minutes.trim().length < 10) {
      setError('Hearing minutes must be at least 10 characters.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/applications/${application.id}/sac-hearing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          outcome,
          minutes: minutes.trim(),
          conditions: conditions.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process SAC/SHC hearing.');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error processing hearing.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden text-xs">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold">Standing Appellate / Hearing Committee (SAC/SHC)</h3>
              <p className="text-xs text-slate-300 mt-0.5">
                {application.application_number} · {application.institution_name}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Committee Hearing Finding *
            </label>
            <select
              value={outcome}
              onChange={e => setOutcome(e.target.value as any)}
              className="w-full border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 font-semibold"
            >
              <option value="RECOMMENDED">RECOMMENDED (Appeal Accepted, Rectification Satisfactory)</option>
              <option value="CONDITIONAL_APPROVAL">CONDITIONAL CLEARANCE (Time-Bound Undertaking Required)</option>
              <option value="NOT_RECOMMENDED">NOT RECOMMENDED (Deficiencies Unresolved / Rejected)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Official Hearing Proceedings & Minutes *
            </label>
            <textarea
              rows={4}
              value={minutes}
              onChange={e => setMinutes(e.target.value)}
              className="w-full border border-slate-300 rounded p-2.5 bg-white text-slate-900"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Binding Conditions & Provisos
            </label>
            <textarea
              rows={2}
              value={conditions}
              onChange={e => setConditions(e.target.value)}
              className="w-full border border-slate-300 rounded p-2.5 bg-white text-slate-900"
            />
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
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Award className="w-3.5 h-3.5" />
              <span>{loading ? 'Recording...' : 'Record Hearing Order'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
