import React, { useState } from 'react';
import { X, Award, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Application } from '../../types';

interface DecisionModalProps {
  application: Application;
  onClose: () => void;
  onSuccess: () => void;
}

export const DecisionModal: React.FC<DecisionModalProps> = ({ application, onClose, onSuccess }) => {
  const { token } = useAuth();
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [remarks, setRemarks] = useState(
    'Extension of Approval (EoA) granted for Academic Year 2026-27 in accordance with Council Resolution and recommendations of the Regional Committee.'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!remarks.trim() || remarks.trim().length < 10) {
      setError('Comprehensive decision remarks (minimum 10 characters) are legally required.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/applications/${application.id}/final-decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          decision,
          remarks: remarks.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to finalize decision.');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error processing decision.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold">Competent Authority Final Order</h3>
            <p className="text-xs text-slate-300 mt-0.5">
              {application.application_number} · {application.institution_name}
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
            <label className="block font-semibold text-slate-700 mb-2">
              Final Approval Order *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setDecision('APPROVED');
                  setRemarks('Extension of Approval (EoA) granted for Academic Year 2026-27 in accordance with Council Resolution and recommendations of the Regional Committee.');
                }}
                className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                  decision === 'APPROVED'
                    ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="font-bold text-emerald-800 flex items-center gap-1.5 mb-1">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Grant Approval</span>
                </div>
                <p className="text-slate-500 text-[11px]">
                  All statutory stages cleared. Issue official approval certificate.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDecision('REJECTED');
                  setRemarks('Application rejected due to non-rectification of critical statutory deficiencies within the prescribed deadline.');
                }}
                className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                  decision === 'REJECTED'
                    ? 'border-rose-500 bg-rose-50/50 ring-2 ring-rose-500/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="font-bold text-rose-800 flex items-center gap-1.5 mb-1">
                  <XCircle className="w-4 h-4 text-rose-600" />
                  <span>Reject Application</span>
                </div>
                <p className="text-slate-500 text-[11px]">
                  Non-rectification of critical deficiencies or regulatory bar.
                </p>
              </button>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Official Decision Remarks & Certificate Reference *
            </label>
            <textarea
              rows={4}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              className="w-full border border-slate-300 rounded p-2.5 bg-white text-slate-900 focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600 space-y-1">
            <span className="font-semibold block">Governance Invariant:</span>
            <span>Approval decisions are strictly manual and irrevocable. The decision record is cryptographically signed into the system audit log under rule specification v{application.workflow_rule_version}.</span>
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
              className={`px-4 py-2 text-white rounded font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                decision === 'APPROVED' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>{loading ? 'Recording...' : `Execute ${decision}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
