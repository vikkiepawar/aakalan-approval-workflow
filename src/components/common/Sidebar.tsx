import React from 'react';
import {
  LayoutDashboard,
  FileText,
  FolderCheck,
  AlertOctagon,
  Calendar,
  Layers,
  Users,
  Webhook,
  History,
  FileCheck2,
  ShieldCheck,
  Building,
  ClipboardList
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const { user } = useAuth();
  if (!user) return null;

  const role = user.role;

  const institutionLinks = [
    { id: 'overview', label: 'Institutional Dashboard', icon: LayoutDashboard },
    { id: 'applications', label: 'My Applications', icon: FileText },
    { id: 'documents', label: 'Prescribed Documents', icon: FolderCheck },
    { id: 'deficiencies', label: 'Deficiencies & Corrections', icon: AlertOctagon },
    { id: 'compliance', label: 'Compliance Undertakings', icon: ShieldCheck }
  ];

  const scrutinyLinks = [
    { id: 'overview', label: 'Scrutiny Desk', icon: LayoutDashboard },
    { id: 'queue', label: 'Applications Queue', icon: ClipboardList },
    { id: 'returned', label: 'Returned for Correction', icon: AlertOctagon },
    { id: 'documents', label: 'Document Review Desk', icon: FolderCheck },
    { id: 'audit', label: 'Observations History', icon: History }
  ];

  const regionalLinks = [
    { id: 'overview', label: 'Regional Dashboard', icon: LayoutDashboard },
    { id: 'evc_scheduler', label: 'EVC Visit Scheduling', icon: Calendar },
    { id: 'evc_reports', label: 'Inspection Outcomes', icon: FileCheck2 },
    { id: 'sac_shc', label: 'SAC / SHC Cases', icon: Layers },
    { id: 'compliance', label: 'Regional Compliance', icon: ShieldCheck }
  ];

  const adminLinks = [
    { id: 'overview', label: 'Executive Analytics', icon: LayoutDashboard },
    { id: 'applications', label: 'Master Applications', icon: FileText },
    { id: 'templates', label: 'Workflow Templates', icon: Layers },
    { id: 'users', label: 'User & Role Access', icon: Users },
    { id: 'integrations', label: 'n8n & Webhook Hub', icon: Webhook },
    { id: 'audit', label: 'System Audit Logs', icon: History }
  ];

  let links = institutionLinks;
  if (role === 'SCRUTINY_OFFICER') links = scrutinyLinks;
  if (role === 'REGIONAL_OFFICER') links = regionalLinks;
  if (role === 'ADMIN') links = adminLinks;

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 shrink-0 min-h-[calc(100vh-57px)] flex flex-col justify-between border-r border-slate-800">
      <div className="p-4">
        {/* Active Organization / Role Context */}
        <div className="mb-6 p-3 bg-slate-800/60 rounded-lg border border-slate-700/60">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            {role === 'INSTITUTION' ? 'Institution Account' : 'Authority Desk'}
          </div>
          <div className="text-xs font-semibold text-slate-200 mt-1 truncate">
            {role === 'INSTITUTION'
              ? user.institution?.name || 'Technical Institute'
              : `${user.department || user.region + ' Bureau'}`}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
            {role === 'INSTITUTION' ? `PID: ${user.institution?.permanent_id || '1-3321456789'}` : `Region: ${user.region || 'National'}`}
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1">
          {links.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
        <div className="flex items-center justify-between">
          <span>AICTE Approval Reg.</span>
          <span className="font-mono text-slate-300">2026-27</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Server Engine</span>
          <span className="text-emerald-400 font-mono">Healthy</span>
        </div>
      </div>
    </aside>
  );
};
