import React, { useState } from 'react';
import { X, UserPlus, AlertCircle, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface UserManagementModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ onClose, onSuccess }) => {
  const { token } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('aicte@demo123');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'SCRUTINY_OFFICER' | 'REGIONAL_OFFICER' | 'ADMIN'>('SCRUTINY_OFFICER');
  const [designation, setDesignation] = useState('Scrutiny Officer (Technical Desk)');
  const [department, setDepartment] = useState('Approval Bureau');
  const [region, setRegion] = useState('Western');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
          role,
          designation,
          department,
          region
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create privileged user.');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error creating user.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold">Provision Privileged Official Account</h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Admin-authorized account creation for scrutiny & regional officers
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Officer Full Name *
            </label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="e.g., Dr. Arvind K. Mehta"
              className="w-full border border-slate-300 rounded px-3 py-2 bg-white text-slate-900"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Official Email Address *
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="officer@aicte-india.org"
                className="w-full border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 font-mono"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Temporary Password *
              </label>
              <input
                type="text"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 font-mono"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Assigned Role *
              </label>
              <select
                value={role}
                onChange={e => {
                  const r = e.target.value as any;
                  setRole(r);
                  if (r === 'SCRUTINY_OFFICER') setDesignation('Senior Scrutiny Officer');
                  if (r === 'REGIONAL_OFFICER') setDesignation('Regional Officer & EVC Coordinator');
                  if (r === 'ADMIN') setDesignation('Director (Approval Bureau)');
                }}
                className="w-full border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 font-semibold"
              >
                <option value="SCRUTINY_OFFICER">Scrutiny Officer</option>
                <option value="REGIONAL_OFFICER">Regional / EVC Officer</option>
                <option value="ADMIN">System Administrator</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Assigned Region *
              </label>
              <select
                value={region}
                onChange={e => setRegion(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 bg-white text-slate-900"
              >
                <option value="Western">Western</option>
                <option value="Northern">Northern</option>
                <option value="South-Western">South-Western</option>
                <option value="Southern">Southern</option>
                <option value="Eastern">Eastern</option>
                <option value="Central">Central</option>
                <option value="National">National (HQ)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Designation</label>
              <input
                type="text"
                value={designation}
                onChange={e => setDesignation(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 bg-white text-slate-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Department</label>
              <input
                type="text"
                value={department}
                onChange={e => setDepartment(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 bg-white text-slate-900"
              />
            </div>
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
              <UserPlus className="w-3.5 h-3.5" />
              <span>{loading ? 'Creating...' : 'Provision Officer Account'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
