import React, { useState, useEffect } from 'react';
import { History, Search, Shield, Filter, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AuditLog } from '../../types';

export const AuditLogsView: React.FC = () => {
  const { token } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('ALL');
  const [search, setSearch] = useState('');

  const fetchLogs = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch('/api/admin/audit-logs?limit=150', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.audit_logs || []);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [token]);

  const filteredLogs = logs.filter(log => {
    const matchAction = filterAction === 'ALL' || log.action === filterAction;
    const matchSearch =
      log.actor_name.toLowerCase().includes(search.toLowerCase()) ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.entity_id.toLowerCase().includes(search.toLowerCase()) ||
      (log.notes && log.notes.toLowerCase().includes(search.toLowerCase()));
    return matchAction && matchSearch;
  });

  return (
    <div className="space-y-6 text-xs">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">
              System-Wide Audit Trail & Security Ledger
            </h2>
          </div>
          <p className="text-slate-600 mt-1 max-w-3xl">
            Immutable legal event journal recording every workflow transition, decision remark, document verification, and privileged administrative act.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="px-3.5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Ledger</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        {/* Filter bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search actor, notes, entity ID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-slate-300 rounded text-xs bg-white focus:ring-1 focus:ring-blue-500 w-64"
              />
            </div>

            <select
              value={filterAction}
              onChange={e => setFilterAction(e.target.value)}
              className="border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white text-slate-700 font-mono"
            >
              <option value="ALL">All Recorded Actions</option>
              <option value="SUBMIT_APPLICATION">SUBMIT_APPLICATION</option>
              <option value="ASSIGN_WORKFLOW_AND_OFFICER">ASSIGN_WORKFLOW_AND_OFFICER</option>
              <option value="RETURN_APPLICATION_FOR_CORRECTION">RETURN_APPLICATION_FOR_CORRECTION</option>
              <option value="SUBMIT_CORRECTION">SUBMIT_CORRECTION</option>
              <option value="COMPLETE_SCRUTINY_STAGE">COMPLETE_SCRUTINY_STAGE</option>
              <option value="SCHEDULE_EVC_VISIT">SCHEDULE_EVC_VISIT</option>
              <option value="RECORD_EVC_OUTCOME">RECORD_EVC_OUTCOME</option>
              <option value="APPROVE_APPLICATION">APPROVE_APPLICATION</option>
              <option value="REJECT_APPLICATION">REJECT_APPLICATION</option>
            </select>
          </div>

          <span className="text-slate-500 font-medium">
            Showing <strong className="text-slate-800">{filteredLogs.length}</strong> events
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Target Entity</th>
                <th className="py-3 px-4">State Transition</th>
                <th className="py-3 px-4">Notes / Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                    No audit records match query.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {l.action}
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-sans">
                      <span className="font-semibold">{l.actor_name}</span>
                      <span className="text-[10px] text-slate-400 block font-mono">[{l.actor_role}]</span>
                    </td>
                    <td className="py-3 px-4 text-blue-700">
                      {l.entity_type}: {l.entity_id}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {l.previous_state || l.new_state ? (
                        <span>
                          {l.previous_state || 'None'} → <strong className="text-slate-900">{l.new_state || 'None'}</strong>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-sans max-w-xs truncate" title={l.notes || ''}>
                      {l.notes || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
