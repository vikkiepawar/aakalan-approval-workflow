import React, { useState } from 'react';
import { X, CheckCircle, AlertTriangle, Plus, Trash2, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Application } from '../../types';

interface ApplicationReviewModalProps {
  application: Application;
  onClose: () => void;
  onSuccess: () => void;
}

export const ApplicationReviewModal: React.FC<ApplicationReviewModalProps> = ({
  application,
  onClose,
  onSuccess
}) => {
  const { token } = useAuth();
  const [selectedAction, setSelectedAction] = useState<'RETURN_FOR_CORRECTION' | 'COMPLETE_SCRUTINY'>('COMPLETE_SCRUTINY');
  const [mandatoryReason, setMandatoryReason] = useState('');
  const [scrutinyNotes, setScrutinyNotes] = useState('All statutory documents examined and found in accordance with prescribed AICTE norms.');
  const [deficiencies, setDeficiencies] = useState<Array<{ category: string; description: string; severity: string }>>([]);
  const [newDefCategory, setNewDefCategory] = useState('DOCUMENT');
  const [newDefSeverity, setNewDefSeverity] = useState('MAJOR');
  const [newDefDesc, setNewDefDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addDeficiency = () => {
    if (!newDefDesc.trim()) return;
    setDeficiencies(prev => [
      ...prev,
      { category: newDefCategory, severity: newDefSeverity, description: newDefDesc.trim() }
    ]);
    setNewDefDesc('');
  };

  const removeDeficiency = (index: number) => {
    setDeficiencies(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (selectedAction === 'RETURN_FOR_CORRECTION') {
      if (!mandatoryReason.trim() || mandatoryReason.trim().length < 10) {
        setError('Mandatory Requirement: A clear, specific justification (minimum 10 characters) must be recorded for returning an application for correction.');
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/applications/${application.id}/scrutiny-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          action: selectedAction,
          reason: mandatoryReason.trim(),
          notes: scrutinyNotes,
          deficiencies
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to execute scrutiny action.');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error processing review.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-2xl w-full my-8 shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-sm font-bold">Official Scrutiny Desk Decision</h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Reviewing: {application.application_number} · {application.institution_name}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Decision Selector */}
          <div>
            <label className="block font-semibold text-slate-700 mb-2">
              Select Scrutiny Action *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedAction('COMPLETE_SCRUTINY')}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  selectedAction === 'COMPLETE_SCRUTINY'
                    ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="font-bold text-slate-900 flex items-center gap-1.5 mb-1">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Clear & Complete Scrutiny</span>
                </div>
                <p className="text-slate-500 text-[11px]">
                  All eligibility criteria verified. Advance to next stage (EVC / Final Decision).
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedAction('RETURN_FOR_CORRECTION')}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  selectedAction === 'RETURN_FOR_CORRECTION'
                    ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="font-bold text-slate-900 flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Return for Correction</span>
                </div>
                <p className="text-slate-500 text-[11px]">
                  Record deficiencies and return application to institution with mandatory reason.
                </p>
              </button>
            </div>
          </div>

          {/* Mandatory Reason Input (Strictly enforced when returning) */}
          {selectedAction === 'RETURN_FOR_CORRECTION' && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
              <div>
                <label className="block font-bold text-amber-900 mb-1">
                  Mandatory Legal Return Reason * (Minimum 10 characters)
                </label>
                <textarea
                  rows={3}
                  value={mandatoryReason}
                  onChange={e => setMandatoryReason(e.target.value)}
                  placeholder="State the statutory non-compliance or document defect requiring correction..."
                  className="w-full border border-amber-300 rounded p-2.5 bg-white text-slate-900 focus:ring-1 focus:ring-amber-500 font-medium"
                  required
                />
              </div>

              {/* Add Point-by-point Deficiencies */}
              <div className="space-y-2 pt-2 border-t border-amber-200">
                <span className="font-semibold text-amber-900 block">
                  Add Itemized Deficiencies for Institutional Response:
                </span>

                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={newDefCategory}
                    onChange={e => setNewDefCategory(e.target.value)}
                    className="border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-800"
                  >
                    <option value="DOCUMENT">Document</option>
                    <option value="INFRASTRUCTURE">Infrastructure</option>
                    <option value="FACULTY">Faculty Cadre</option>
                    <option value="FINANCIAL">Financial</option>
                    <option value="REGULATORY">Regulatory</option>
                  </select>

                  <select
                    value={newDefSeverity}
                    onChange={e => setNewDefSeverity(e.target.value)}
                    className="border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-800"
                  >
                    <option value="CRITICAL">Critical</option>
                    <option value="MAJOR">Major</option>
                    <option value="MINOR">Minor</option>
                  </select>

                  <button
                    type="button"
                    onClick={addDeficiency}
                    className="bg-slate-900 text-white rounded px-2 py-1.5 font-semibold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <input
                  type="text"
                  value={newDefDesc}
                  onChange={e => setNewDefDesc(e.target.value)}
                  placeholder="Deficiency item description (e.g., Land Title deed missing notary seal)..."
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900"
                />

                {deficiencies.length > 0 && (
                  <div className="space-y-1.5 mt-2">
                    {deficiencies.map((d, i) => (
                      <div key={i} className="p-2 bg-white border border-amber-200 rounded flex items-center justify-between text-[11px]">
                        <div>
                          <span className="font-bold text-slate-800 mr-2">[{d.severity}] {d.category}:</span>
                          <span className="text-slate-600">{d.description}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDeficiency(i)}
                          className="text-rose-600 hover:text-rose-800 cursor-pointer p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Official Scrutiny Remarks & Officer Certification *
            </label>
            <textarea
              rows={3}
              value={scrutinyNotes}
              onChange={e => setScrutinyNotes(e.target.value)}
              className="w-full border border-slate-300 rounded p-2.5 bg-white text-slate-900 focus:ring-1 focus:ring-blue-500"
              required
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
              className={`px-4 py-2 text-white rounded font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                selectedAction === 'COMPLETE_SCRUTINY' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>{loading ? 'Processing...' : selectedAction === 'COMPLETE_SCRUTINY' ? 'Confirm & Advance Stage' : 'Return for Correction'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
