import React, { useState } from 'react';
import { X, Send, AlertTriangle, FileUp, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Application, Deficiency } from '../../types';

interface CorrectionModalProps {
  application: Application;
  onClose: () => void;
  onSuccess: () => void;
}

export const CorrectionModal: React.FC<CorrectionModalProps> = ({ application, onClose, onSuccess }) => {
  const { token } = useAuth();
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [documentTitles, setDocumentTitles] = useState<Record<string, string>>({});
  const [generalClarification, setGeneralClarification] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deficiencies = application.deficiencies || [];

  const handleExplanationChange = (id: string, text: string) => {
    setExplanations(prev => ({ ...prev, [id]: text }));
  };

  const handleDocTitleChange = (id: string, text: string) => {
    setDocumentTitles(prev => ({ ...prev, [id]: text }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/applications/${application.id}/submit-correction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          explanations,
          documentTitles,
          generalClarification
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit rectifications.');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error submitting correction.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-2xl w-full my-8 shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 bg-amber-700 text-white flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-sm font-bold">Deficiency Rectification & Resubmission</h3>
            <p className="text-xs text-amber-100 mt-0.5">
              Application: {application.application_number} · Address all flagged items
            </p>
          </div>
          <button onClick={onClose} className="text-amber-200 hover:text-white cursor-pointer">
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

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">
            <strong>Mandatory Compliance Instructions:</strong> You must respond point-by-point to each observation made by the Scrutiny Officer. Upload corresponding endorsed proofs where required.
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-slate-900 uppercase tracking-wider text-[11px]">
              Flagged Deficiency Items ({deficiencies.length})
            </h4>

            {deficiencies.map((def, idx) => (
              <div key={def.id} className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Item 0{idx + 1}: {def.category} Deficiency</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                    def.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {def.severity}
                  </span>
                </div>

                <div className="p-2.5 bg-white border border-slate-200 rounded text-slate-700 italic">
                  "{def.description}"
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Point-by-Point Institutional Clarification *
                  </label>
                  <textarea
                    rows={2}
                    value={explanations[def.id] || ''}
                    onChange={e => handleExplanationChange(def.id, e.target.value)}
                    placeholder="Describe specific rectification measures taken..."
                    className="w-full border border-slate-300 rounded p-2 bg-white text-slate-900 focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Rectification Proof Document Title (PDF)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={documentTitles[def.id] || ''}
                      onChange={e => handleDocTitleChange(def.id, e.target.value)}
                      placeholder="e.g., Endorsed Municipal Occupancy Approval 2026.pdf"
                      className="flex-1 border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900"
                    />
                    <div className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded flex items-center gap-1 shrink-0 font-medium text-[11px]">
                      <FileUp className="w-3.5 h-3.5" />
                      <span>Attach Proof</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              General Institutional Undertaking / Concluding Statement
            </label>
            <textarea
              rows={2}
              value={generalClarification}
              onChange={e => setGeneralClarification(e.target.value)}
              placeholder="All requested deficiencies have been remedied in strict accordance with AICTE Approval Norms..."
              className="w-full border border-slate-300 rounded p-2 bg-white text-slate-900 focus:ring-1 focus:ring-blue-500"
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
              <Send className="w-3.5 h-3.5" />
              <span>{loading ? 'Submitting...' : 'Submit Rectification & Resubmit'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
