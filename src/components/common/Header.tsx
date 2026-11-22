import React from 'react';
import { LogOut, UserCircle, Shield, Building2, UserCheck, Settings, Check, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { NotificationFlyout } from './NotificationFlyout';

interface HeaderProps {
  onSelectApplication?: (appId: string) => void;
  onOpenLoginModal?: () => void;
  onOpenVoiceAssistant?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onSelectApplication,
  onOpenLoginModal,
  onOpenVoiceAssistant
}) => {
  const { user, personas, quickSwitch, logout } = useAuth();

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'INSTITUTION':
        return 'Institution';
      case 'SCRUTINY_OFFICER':
        return 'Scrutiny Officer';
      case 'REGIONAL_OFFICER':
        return 'Regional / EVC';
      case 'ADMIN':
        return 'Administrator';
      default:
        return role;
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="flex items-center justify-between gap-8 px-6 py-3 max-w-full">
        {/* Zone 1: Brand title, single line wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded bg-slate-900 flex items-center justify-center text-white font-bold text-sm tracking-wider shadow-sm">
            A
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
              aakalan
            </span>
            <span className="hidden lg:inline text-xs text-slate-500 font-medium whitespace-nowrap">
              Approval & Compliance Automation
            </span>
          </div>
        </div>

        {/* Zone 2: Interactive Role Persona Switcher (Segmented Button Controls) */}
        <div className="hidden md:flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
          {personas.map(p => {
            const isActive = user?.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => quickSwitch(p.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title={`Switch persona to ${p.full_name} (${p.email})`}
              >
                {p.role === 'INSTITUTION' && <Building2 className="w-3.5 h-3.5 text-slate-500" />}
                {p.role === 'SCRUTINY_OFFICER' && <UserCheck className="w-3.5 h-3.5 text-blue-500" />}
                {p.role === 'REGIONAL_OFFICER' && <Shield className="w-3.5 h-3.5 text-amber-500" />}
                {p.role === 'ADMIN' && <Settings className="w-3.5 h-3.5 text-purple-500" />}
                <span>{getRoleLabel(p.role)}</span>
                {isActive && <Check className="w-3 h-3 text-emerald-600 ml-0.5" />}
              </button>
            );
          })}
        </div>

        {/* Zone 3: 1 Primary action cluster with Notifications and User account */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenVoiceAssistant}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer"
            title="AICTE Live Voice Assistant (English, Hindi, Marathi)"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Voice Assistant</span>
            <span className="text-[10px] bg-white/20 px-1 rounded font-mono">Live</span>
          </button>

          {user ? (
            <>
              <NotificationFlyout onSelectApplication={onSelectApplication} />

              <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200 text-right">
                <div>
                  <div className="text-xs font-semibold text-slate-900 leading-tight truncate max-w-[160px]">
                    {user.full_name}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate max-w-[160px]">
                    {user.designation || getRoleLabel(user.role)}
                  </div>
                </div>
              </div>

              <button
                onClick={logout}
                className="p-2 text-slate-500 hover:text-rose-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                title="Sign out / Switch account"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={onOpenLoginModal}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
