import React, { useState } from 'react';
import { X, Send, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface NewApplicationModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const NewApplicationModal: React.FC<NewApplicationModalProps> = ({ onClose, onSuccess }) => {
  const { token, user } = useAuth();
  const [appType, setAppType] = useState('EOA');
  const [academicYear, setAcademicYear] = useState('2026-27');
  const [workflowTemplateId, setWorkflowTemplateId] = useState('tmpl-scrutiny-evc');
  const [programDetails, setProgramDetails] = useState('B.Tech in Artificial Intelligence & Machine Learning (Intake: 60)');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          application_type: appType,
          academic_year: academicYear,
          workflow_template_id: workflowTemplateId,
          program_details: programDetails,
          notes
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit application.');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error creating application.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold">New Institutional Approval Application</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Initiate formal submission under AICTE Approval Process Handbook
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Application Type *
              </label>
              <select
                value={appType}
                onChange={e => setAppType(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:ring-1 focus:ring-blue-500"
              >
                <option value="EOA">Extension of Approval (EoA)</option>
                <option value="INCREASE_INTAKE">Increase in Intake Capacity</option>
                <option value="NEW_COURSE">Introduction of New Course/Program</option>
                <option value="NEW_INSTITUTION">New Technical Institution</option>
                <option value="CLOSURE">Closure of Program/Course</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Academic Year *
              </label>
              <input
                type="text"
                value={academicYear}
                readOnly
                className="w-full border border-slate-300 rounded px-3 py-2 bg-slate-100 text-slate-600 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Applicable Approval Workflow Pipeline *
            </label>
            <select
              value={workflowTemplateId}
              onChange={e => setWorkflowTemplateId(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:ring-1 focus:ring-blue-500"
            >
              <option value="tmpl-scrutiny-evc">Scrutiny + EVC (Comprehensive physical verification)</option>
              <option value="tmpl-only-scrutiny">Only Scrutiny (Routine clean-history EoA)</option>
              <option value="tmpl-scrutiny-evc-sac">Full Scrutiny + EVC + SAC/SHC Hearing</option>
              <option value="tmpl-only-evc">Only EVC (Special Inspection)</option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Determines stages, SLAs, and required committee milestones according to rule book.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Proposed Program / Intake Scope *
            </label>
            <textarea
              rows={2}
              value={programDetails}
              onChange={e => setProgramDetails(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 text-slate-900 focus:ring-1 focus:ring-blue-500"
              placeholder="e.g., B.Tech in Artificial Intelligence & Machine Learning (Intake: 60)"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Institutional Remarks & Undertaking Statement
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 text-slate-900 focus:ring-1 focus:ring-blue-500"
              placeholder="Any specific justifications or notes for the scrutiny officer..."
            />
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600">
            <strong>Rule Specification Notice:</strong> All linked statutory documents currently on file (Land Deed, Occupancy Certificate, Fire NOC) will be bundled and timestamped into this dossier.
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
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
              <Send className="w-3.5 h-3.5" />
              <span>{loading ? 'Submitting...' : 'Submit Application'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
