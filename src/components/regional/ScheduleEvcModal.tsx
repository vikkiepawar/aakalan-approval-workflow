import React, { useState, useEffect } from 'react';
import { X, Calendar, Users, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Application } from '../../types';

interface ScheduleEvcModalProps {
  application: Application;
  onClose: () => void;
  onSuccess: () => void;
}

export const ScheduleEvcModal: React.FC<ScheduleEvcModalProps> = ({ application, onClose, onSuccess }) => {
  const { token } = useAuth();
  const [visitType, setVisitType] = useState<'SCHEDULED' | 'SURPRISE' | 'VIRTUAL'>('SCHEDULED');

  const defaultVisitDate = new Date();
  defaultVisitDate.setDate(defaultVisitDate.getDate() + 4);
  const [visitDate, setVisitDate] = useState(defaultVisitDate.toISOString().split('T')[0]);

  const [members, setMembers] = useState([
    {
      member_name: 'Dr. Anand M. Joshi',
      role_in_committee: 'CHAIRMAN',
      affiliation: 'Former Dean, IIT Bombay',
      email: 'a.joshi@iitb.ac.in',
      phone: '+91 9820112233'
    },
    {
      member_name: 'Prof. Sunita Deshpande',
      role_in_committee: 'SUBJECT_EXPERT',
      affiliation: 'HOD Computer Engineering, COEP Pune',
      email: 's.deshpande@coep.ac.in',
      phone: '+91 9422334455'
    },
    {
      member_name: 'Er. Nitin G. Kale',
      role_in_committee: 'PWD_ARCHITECT_EXPERT',
      affiliation: 'Chief Architect, State PWD Division',
      email: 'ng.kale@pwd.state.gov.in',
      phone: '+91 9890123456'
    }
  ]);

  const [conflicts, setConflicts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check conflicts whenever visitDate or members change
  useEffect(() => {
    if (!token || !visitDate) return;
    const emails = members.map(m => m.email).filter(Boolean).join(',');
    fetch(`/api/evc/check-conflict?date=${visitDate}&member_emails=${encodeURIComponent(emails)}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setConflicts(data.conflicts || []);
      })
      .catch(err => console.error('Failed to check conflict:', err));
  }, [visitDate, members, token]);

  const handleMemberChange = (index: number, field: string, val: string) => {
    setMembers(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (conflicts.length > 0) {
      setError(`Cannot schedule: ${conflicts[0].member_name} already has an inspection scheduled at ${conflicts[0].institution_name} on ${visitDate}.`);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/evc/visits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          application_id: application.id,
          visit_type: visitType,
          proposed_date: visitDate,
          confirmed_date: visitDate,
          committee_members: members
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to schedule EVC visit.');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error scheduling visit.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-2xl w-full my-8 shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-sm font-bold">Schedule Expert Visiting Committee (EVC)</h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Application: {application.application_number} · {application.institution_name}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Conflict Alert Banner */}
          {conflicts.length > 0 && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Scheduling Conflict Detected!</span>
              </div>
              <p className="text-xs">
                {conflicts[0].member_name} is already booked on {visitDate} at {conflicts[0].institution_name}. Please pick another date or substitute member.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Inspection Type *
              </label>
              <select
                value={visitType}
                onChange={e => setVisitType(e.target.value as any)}
                className="w-full border border-slate-300 rounded px-3 py-2 bg-white text-slate-900"
              >
                <option value="SCHEDULED">Standard Scheduled Physical Visit</option>
                <option value="SURPRISE">Surprise Inspection Visit</option>
                <option value="VIRTUAL">Virtual / Remote Verification</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Visit Inspection Date *
              </label>
              <input
                type="date"
                value={visitDate}
                onChange={e => setVisitDate(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 font-mono"
                required
              />
            </div>
          </div>

          {/* Committee Members Assignment */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>Assigned Expert Committee (3 Members)</span>
              </h4>
              <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Conflict Auto-Check Active
              </span>
            </div>

            {members.map((m, idx) => (
              <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="font-semibold text-slate-800">
                  Role: {m.role_in_committee.replace(/_/g, ' ')}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={m.member_name}
                    onChange={e => handleMemberChange(idx, 'member_name', e.target.value)}
                    placeholder="Expert Full Name"
                    className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900"
                    required
                  />
                  <input
                    type="text"
                    value={m.affiliation}
                    onChange={e => handleMemberChange(idx, 'affiliation', e.target.value)}
                    placeholder="Affiliation / University"
                    className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="email"
                    value={m.email}
                    onChange={e => handleMemberChange(idx, 'email', e.target.value)}
                    placeholder="Email Address"
                    className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900 font-mono"
                    required
                  />
                  <input
                    type="text"
                    value={m.phone}
                    onChange={e => handleMemberChange(idx, 'phone', e.target.value)}
                    placeholder="Contact Number"
                    className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900 font-mono"
                    required
                  />
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
              disabled={loading || conflicts.length > 0}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{loading ? 'Scheduling...' : 'Confirm & Dispatch Notice'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
