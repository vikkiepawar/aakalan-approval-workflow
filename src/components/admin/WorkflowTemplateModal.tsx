import React, { useState } from 'react';
import { X, Layers, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { WorkflowTemplate, WorkflowStageDef } from '../../types';

interface WorkflowTemplateModalProps {
  onClose: () => void;
  onSuccess: () => void;
  template?: WorkflowTemplate | null;
}

export const WorkflowTemplateModal: React.FC<WorkflowTemplateModalProps> = ({
  onClose,
  onSuccess,
  template
}) => {
  const { token } = useAuth();
  const [name, setName] = useState(template?.name || '');
  const [code, setCode] = useState(template?.code || '');
  const [description, setDescription] = useState(template?.description || '');

  const [stages, setStages] = useState<WorkflowStageDef[]>(
    template?.stages || [
      {
        code: 'STAGE_SCRUTINY',
        name: 'Desk Document Scrutiny',
        required_role: 'SCRUTINY_OFFICER',
        deadline_days: 7,
        allow_return: true,
        next_stage: 'STAGE_EVC'
      },
      {
        code: 'STAGE_EVC',
        name: 'Physical EVC Inspection',
        required_role: 'REGIONAL_OFFICER',
        deadline_days: 10,
        allow_return: false,
        next_stage: 'STAGE_FINAL_APPROVAL'
      },
      {
        code: 'STAGE_FINAL_APPROVAL',
        name: 'Executive Committee Decision',
        required_role: 'ADMIN',
        deadline_days: 5,
        allow_return: false,
        next_stage: null
      }
    ]
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addStage = () => {
    setStages(prev => [
      ...prev,
      {
        code: `STAGE_${Date.now().toString().slice(-4)}`,
        name: 'Additional Review Gate',
        required_role: 'REGIONAL_OFFICER',
        deadline_days: 7,
        allow_return: true,
        next_stage: null
      }
    ]);
  };

  const removeStage = (idx: number) => {
    if (stages.length <= 1) return;
    setStages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleStageChange = (idx: number, field: keyof WorkflowStageDef, val: any) => {
    setStages(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!name || !code || stages.length === 0) {
      setError('Please provide template name, code, and at least one workflow stage.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/admin/workflow-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          code: code.toUpperCase().replace(/\s+/g, '_'),
          description,
          stages
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save workflow template.');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error saving template.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-2xl w-full my-8 shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-sm font-bold">
              {template ? `Edit Workflow Template: ${template.code}` : 'Design New Workflow Template'}
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Configurable stage gates, deadline rules and return permissions
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Template Display Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., EVC + SAC/SHC Hearing"
                className="w-full border border-slate-300 rounded px-3 py-2 bg-white text-slate-900"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Unique Template Code *
              </label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="e.g., EVC_SAC_SHC"
                className="w-full border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Description & Applicability Criteria
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="State which institution categories require this specific sequence..."
              className="w-full border border-slate-300 rounded p-2.5 bg-white text-slate-900"
            />
          </div>

          {/* Configurable Stages */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-slate-900 uppercase tracking-wider text-[11px]">
                Configured Sequence Stages ({stages.length})
              </h4>
              <button
                type="button"
                onClick={addStage}
                className="px-2.5 py-1 bg-slate-900 text-white rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Gate</span>
              </button>
            </div>

            {stages.map((stage, idx) => (
              <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span className="font-bold text-slate-800">Stage 0{idx + 1} Gate</span>
                  {stages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStage(idx)}
                      className="text-rose-600 hover:text-rose-800 cursor-pointer p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={stage.name}
                    onChange={e => handleStageChange(idx, 'name', e.target.value)}
                    placeholder="Stage Display Name"
                    className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900"
                    required
                  />
                  <select
                    value={stage.required_role}
                    onChange={e => handleStageChange(idx, 'required_role', e.target.value)}
                    className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900"
                  >
                    <option value="SCRUTINY_OFFICER">Scrutiny Officer</option>
                    <option value="REGIONAL_OFFICER">Regional / EVC Officer</option>
                    <option value="ADMIN">System Administrator / Committee</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2 items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600">SLA Days:</span>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={stage.deadline_days}
                      onChange={e => handleStageChange(idx, 'deadline_days', Number(e.target.value))}
                      className="w-20 border border-slate-300 rounded px-2 py-1 bg-white text-slate-900 font-mono"
                      required
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`ret-${idx}`}
                      checked={stage.allow_return}
                      onChange={e => handleStageChange(idx, 'allow_return', e.target.checked)}
                      className="rounded text-blue-600 cursor-pointer"
                    />
                    <label htmlFor={`ret-${idx}`} className="text-slate-700 cursor-pointer">
                      Permit return for correction
                    </label>
                  </div>
                </div>
              </div>
            ))}
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
              <Layers className="w-3.5 h-3.5" />
              <span>{loading ? 'Saving...' : 'Save & Activate Template'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
