import React, { useState, useEffect } from 'react';
import { X, UserCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Application, WorkflowTemplate, User } from '../../types';

interface AssignOfficerModalProps {
  application: Application;
  onClose: () => void;
  onSuccess: () => void;
}

export const AssignOfficerModal: React.FC<AssignOfficerModalProps> = ({ application, onClose, onSuccess }) => {
  const { token } = useAuth();
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [officers, setOfficers] = useState<User[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState(application.workflow_template_id);
  const [selectedScrutiny, setSelectedScrutiny] = useState(application.assigned_scrutiny_officer_id || '');
  const [selectedRegional, setSelectedRegional] = useState(application.assigned_regional_officer_id || '');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch('/api/admin/workflow-templates', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
    ])
      .then(async ([tmplRes, userRes]) => {
        if (tmplRes.ok) {
          const d = await tmplRes.json();
          setTemplates(d.templates || []);
        }
        if (userRes.ok) {
          const d = await userRes.json();
          setOfficers(d.users || []);
        }
      })
      .catch(err => console.error('Failed to load assignments data:', err));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/applications/${application.id}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          workflow_template_id: selectedTemplate,
          scrutiny_officer_id: selectedScrutiny,
          regional_officer_id: selectedRegional,
          notes
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update assignments.');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error updating assignment.');
    } finally {
      setLoading(false);
    }
  };

  const scrutinyOfficers = officers.filter(u => u.role === 'SCRUTINY_OFFICER');
  const regionalOfficers = officers.filter(u => u.role === 'REGIONAL_OFFICER');

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden text-xs">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold">Assign Workflow Template & Officers</h3>
            <p className="text-xs text-slate-300 mt-0.5">
              {application.application_number} · {application.institution_name}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Workflow Pipeline Template *
            </label>
            <select
              value={selectedTemplate}
              onChange={e => setSelectedTemplate(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 font-medium"
            >
              {templates.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} (v{t.version})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Assigned Scrutiny Officer *
            </label>
            <select
              value={selectedScrutiny}
              onChange={e => setSelectedScrutiny(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 bg-white text-slate-900"
            >
              <option value="">-- Select Scrutiny Officer --</option>
              {scrutinyOfficers.map(o => (
                <option key={o.id} value={o.id}>
                  {o.full_name} ({o.region} Region)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Assigned Regional / EVC Coordinator *
            </label>
            <select
              value={selectedRegional}
              onChange={e => setSelectedRegional(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 bg-white text-slate-900"
            >
              <option value="">-- Select Regional Officer --</option>
              {regionalOfficers.map(o => (
                <option key={o.id} value={o.id}>
                  {o.full_name} ({o.region} Region)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Administrative Assignment Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Reason for assignment or workload rebalancing..."
              className="w-full border border-slate-300 rounded p-2 bg-white text-slate-900"
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
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{loading ? 'Updating...' : 'Confirm Assignments'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
