import React, { useState } from 'react';
import { X, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface UndertakingModalProps {
  onClose: () => void;
  onSuccess: () => void;
  applicationId?: string;
}

export const UndertakingModal: React.FC<UndertakingModalProps> = ({
  onClose,
  onSuccess,
  applicationId
}) => {
  const { token } = useAuth();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'INFRASTRUCTURE' | 'FACULTY_CADRE' | 'LAB_EQUIPMENT' | 'LIBRARY_RESOURCES' | 'SAFETY_AUDIT'>('INFRASTRUCTURE');
  const [description, setDescription] = useState('');

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const [deadlineDate, setDeadlineDate] = useState(thirtyDaysFromNow.toISOString().split('T')[0]);
  const [penaltyApplicable, setPenaltyApplicable] = useState(true);
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/compliance/undertakings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          category,
          description,
          deadline_date: deadlineDate,
          application_id: applicationId || null,
          penalty_applicable: penaltyApplicable ? 1 : 0,
          notes
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit compliance undertaking.');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error submitting undertaking.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold">New Time-Bound Compliance Undertaking</h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Submit formal institutional commitment with binding deadline
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Commitment Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Tactile paving & disabled-friendly ramp construction"
              className="w-full border border-slate-300 rounded px-3 py-2 bg-white text-slate-900"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Category *
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as any)}
                className="w-full border border-slate-300 rounded px-3 py-2 bg-white text-slate-900"
              >
                <option value="INFRASTRUCTURE">Campus Infrastructure</option>
                <option value="FACULTY_CADRE">Faculty Cadre Ratio</option>
                <option value="LAB_EQUIPMENT">Laboratory Equipment</option>
                <option value="LIBRARY_RESOURCES">Library Volumes & Journals</option>
                <option value="SAFETY_AUDIT">Campus Safety Audit</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Binding Completion Deadline *
              </label>
              <input
                type="date"
                value={deadlineDate}
                onChange={e => setDeadlineDate(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900 font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Detailed Scope & Execution Plan *
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the milestone dates, budget allocated and contracting status..."
              className="w-full border border-slate-300 rounded p-2.5 bg-white text-slate-900"
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="penalty"
              checked={penaltyApplicable}
              onChange={e => setPenaltyApplicable(e.target.checked)}
              className="rounded text-blue-600 cursor-pointer"
            />
            <label htmlFor="penalty" className="text-slate-700 font-medium cursor-pointer">
              Subject to AICTE punitive clause in case of deadline breach
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
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{loading ? 'Submitting...' : 'Register Formal Undertaking'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
