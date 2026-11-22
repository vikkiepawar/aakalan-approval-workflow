import React, { useState } from 'react';
import { X, Building2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface RegisterModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const RegisterModal: React.FC<RegisterModalProps> = ({ onClose, onSuccess }) => {
  const { registerInstitution } = useAuth();
  const [permanentId, setPermanentId] = useState('1-9876543210');
  const [instName, setInstName] = useState('Pune College of Engineering & Technology');
  const [region, setRegion] = useState('Western');
  const [institutionType, setInstitutionType] = useState('Engineering & Technology');
  const [principalName, setPrincipalName] = useState('Dr. Sanjay Patil');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('aicte@demo123');
  const [phone, setPhone] = useState('+91 20 25507000');
  const [landArea, setLandArea] = useState('14.5');
  const [builtUpArea, setBuiltUpArea] = useState('36000');
  const [city, setCity] = useState('Pune');
  const [state, setState] = useState('Maharashtra');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      await registerInstitution({
        permanent_id: permanentId,
        institution_name: instName,
        region,
        institution_type: institutionType,
        principal_name: principalName,
        email,
        password,
        phone,
        land_area_acres: Number(landArea),
        built_up_area_sqm: Number(builtUpArea),
        city,
        state
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-xl w-full my-8 shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-sm font-bold">Institution Portal Self-Registration</h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Strictly for Authorized Technical Institutions (Privileged officer accounts are provisioned by Admin)
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                AICTE Permanent ID *
              </label>
              <input
                type="text"
                value={permanentId}
                onChange={e => setPermanentId(e.target.value)}
                placeholder="1-3321456789"
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900 font-mono"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Affiliated Region *
              </label>
              <select
                value={region}
                onChange={e => setRegion(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900"
              >
                <option value="Western">Western Region</option>
                <option value="Northern">Northern Region</option>
                <option value="South-Western">South-Western Region</option>
                <option value="Southern">Southern Region</option>
                <option value="Eastern">Eastern Region</option>
                <option value="Central">Central Region</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Full Legal Name of Institution *
            </label>
            <input
              type="text"
              value={instName}
              onChange={e => setInstName(e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Principal / Authorized Head *
              </label>
              <input
                type="text"
                value={principalName}
                onChange={e => setPrincipalName(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Official Contact Phone
              </label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Portal Login Email *
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="principal@college.edu.in"
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900 font-mono"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Password *
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900 font-mono"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">State</label>
              <input
                type="text"
                value={state}
                onChange={e => setState(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600">
            <strong>Security Enforced:</strong> New self-registered accounts are restricted strictly to the <em>Institution</em> role. Scrutiny, Regional Officer and Admin accounts can only be provisioned by authorized administrators.
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
              <Building2 className="w-3.5 h-3.5" />
              <span>{loading ? 'Creating...' : 'Register Institutional Account'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
