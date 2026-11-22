import React from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

export const PrototypeDisclaimer: React.FC = () => {
  return (
    <div className="bg-slate-900 text-slate-300 text-xs py-1.5 px-4 border-b border-slate-800 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        <span className="font-medium text-slate-200">Prototype Environment:</span>
        <span className="text-slate-400">
          aakalan automated approval & compliance system prototype. All records are synthetic demonstrations.
        </span>
      </div>
      <div className="hidden md:flex items-center gap-3 text-slate-400">
        <span>Rule Engine v2.0 Active</span>
        <span aria-hidden="true">·</span>
        <span>Isolated Postgres/SQLite WAL Store</span>
      </div>
    </div>
  );
};
