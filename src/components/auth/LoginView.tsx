import React, { useState } from 'react';
import { Shield, Lock, Mail, Building2, UserCheck, Settings, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { RegisterModal } from './RegisterModal';

interface LoginViewProps {
  onSuccess: () => void;
  onCancel?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onSuccess, onCancel }) => {
  const { login, quickSwitch, personas } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      await login(email, password);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPersona = async (id: string) => {
    try {
      setLoading(true);
      await quickSwitch(id);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Persona switch failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden text-xs">
        {/* Top Header */}
        <div className="p-6 bg-slate-900 text-white text-center">
          <div className="w-10 h-10 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-base mx-auto mb-2 shadow-sm">
            A
          </div>
          <h2 className="text-base font-bold">aakalan Portal Sign-In</h2>
          <p className="text-slate-300 text-xs mt-1">
            Approval Workflow Automation & Compliance Monitoring
          </p>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Persona Demo Switcher */}
          <div>
            <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block mb-2">
              Instant Demo Persona Sign-In:
            </span>
            <div className="grid grid-cols-2 gap-2">
              {personas.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleQuickPersona(p.id)}
                  disabled={loading}
                  className="p-2.5 text-left border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 rounded-lg transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 truncate">
                    {p.role === 'INSTITUTION' && <Building2 className="w-3.5 h-3.5 text-slate-500" />}
                    {p.role === 'SCRUTINY_OFFICER' && <UserCheck className="w-3.5 h-3.5 text-blue-500" />}
                    {p.role === 'REGIONAL_OFFICER' && <Shield className="w-3.5 h-3.5 text-amber-500" />}
                    {p.role === 'ADMIN' && <Settings className="w-3.5 h-3.5 text-purple-500" />}
                    <span className="truncate">{p.role.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate mt-0.5">
                    {p.full_name}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-2 text-slate-400 font-mono text-[10px] uppercase">
              Or sign in with email
            </span>
          </div>

          {/* Standard Login Form */}
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="registered.user@domain.edu"
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900 font-mono"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900 font-mono"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold cursor-pointer shadow-xs disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          <div className="pt-2 text-center text-slate-600">
            <span>New institution applying for approval? </span>
            <button
              type="button"
              onClick={() => setShowRegister(true)}
              className="text-blue-600 hover:underline font-semibold cursor-pointer"
            >
              Register Institution
            </button>
          </div>
        </div>
      </div>

      {showRegister && (
        <RegisterModal
          onClose={() => setShowRegister(false)}
          onSuccess={() => {
            setShowRegister(false);
            onSuccess();
          }}
        />
      )}
    </div>
  );
};
