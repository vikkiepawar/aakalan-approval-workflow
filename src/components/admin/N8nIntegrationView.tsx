import React, { useState, useEffect } from 'react';
import {
  Webhook,
  Key,
  Play,
  CheckCircle2,
  AlertCircle,
  Copy,
  Clock,
  Send,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const N8nIntegrationView: React.FC = () => {
  const { token } = useAuth();
  const [pendingActions, setPendingActions] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [secret, setSecret] = useState('aicte-flow-n8n-secret-key-2026');
  const [copied, setCopied] = useState(false);
  const [cronResult, setCronResult] = useState<any>(null);

  // Simulated delivery trigger test
  const [deliveryRecipient, setDeliveryRecipient] = useState('principal@vjti-polytechnic.edu.in');
  const [deliveryChannel, setDeliveryChannel] = useState('EMAIL');
  const [deliveryStatus, setDeliveryStatus] = useState('DELIVERED');
  const [deliveryMessage, setDeliveryMessage] = useState('Your Extension of Approval application requires immediate attention.');
  const [testResult, setTestResult] = useState<string | null>(null);

  const fetchIntegrationData = async () => {
    try {
      setLoading(true);
      const [pendingRes, eventsRes] = await Promise.all([
        fetch('/api/integrations/n8n/pending-actions', {
          headers: { 'X-AICTE-FLOW-SECRET': secret }
        }),
        fetch('/api/integrations/n8n/events', {
          headers: { 'X-AICTE-FLOW-SECRET': secret }
        })
      ]);

      if (pendingRes.ok) {
        const data = await pendingRes.json();
        setPendingActions(data);
      }
      if (eventsRes.ok) {
        const data = await eventsRes.json();
        setEvents(data.events || []);
      }
    } catch (err) {
      console.error('Failed to fetch integration data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrationData();
  }, [secret]);

  const triggerCronCheck = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/integrations/n8n/trigger-cron', {
        method: 'POST',
        headers: { 'X-AICTE-FLOW-SECRET': secret }
      });
      const data = await res.json();
      setCronResult(data);
      fetchIntegrationData();
    } catch (err) {
      console.error('Failed to run cron check:', err);
    } finally {
      setLoading(false);
    }
  };

  const testRecordDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/integrations/n8n/record-delivery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AICTE-FLOW-SECRET': secret
        },
        body: JSON.stringify({
          recipient_email: deliveryRecipient,
          channel: deliveryChannel,
          status: deliveryStatus,
          notification_title: 'Automated aakalan Notification',
          notification_body: deliveryMessage
        })
      });
      const data = await res.json();
      if (res.ok) {
        setTestResult(`Successfully recorded delivery attempt. Delivery ID: ${data.delivery_id}`);
        fetchIntegrationData();
      } else {
        setTestResult(`Failed: ${data.error}`);
      }
    } catch (err: any) {
      setTestResult(`Error: ${err.message}`);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 text-xs">
      {/* Intro Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Webhook className="w-4 h-4 text-purple-600" />
              <h2 className="text-base font-bold text-slate-900">
                n8n Webhook & External Notification Architecture
              </h2>
            </div>
            <p className="text-slate-600 mt-1 max-w-3xl">
              aakalan exposes production-grade REST webhooks and idempotency-guaranteed event queues for orchestration with n8n, SendGrid, Twilio SMS and WhatsApp notifications.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={triggerCronCheck}
              disabled={loading}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Simulate Cron Job Check</span>
            </button>
            <button
              onClick={fetchIntegrationData}
              className="p-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Secret & Credentials Card */}
        <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-slate-500" />
            <span className="font-semibold text-slate-700">Integration Secret Key (Header: X-AICTE-FLOW-SECRET):</span>
            <code className="font-mono bg-white px-2 py-0.5 rounded border border-slate-300 text-slate-900">
              {secret}
            </code>
          </div>
          <button
            onClick={copySecret}
            className="px-3 py-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded flex items-center gap-1 font-medium cursor-pointer"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Header'}</span>
          </button>
        </div>
      </div>

      {/* Cron Result Banner */}
      {cronResult && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg text-purple-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-purple-600" />
            <span>
              <strong>Cron Verification Successful:</strong> Scanned {cronResult.overdue_count} overdue applications, dispatched {cronResult.alerts_generated} automated warnings.
            </span>
          </div>
          <button onClick={() => setCronResult(null)} className="text-purple-600 font-bold cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Grid: Pending Actions & Realtime Events */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Pending Actions Eligible for Escalation */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="font-semibold text-slate-900 uppercase tracking-wider text-[11px]">
              GET /api/integrations/n8n/pending-actions
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              {pendingActions?.counts?.overdue_applications || 0} Overdue Cases
            </span>
          </div>

          <div className="p-4 space-y-3">
            <p className="text-slate-600 text-[11px]">
              This endpoint is polled by n8n scheduled nodes every 15 minutes to trigger escalations for cases approaching or exceeding stage deadlines.
            </p>

            <div className="space-y-2">
              {pendingActions?.actions?.overdue_applications?.map((app: any) => (
                <div key={app.id} className="p-3 bg-rose-50/50 border border-rose-200 rounded text-xs space-y-1">
                  <div className="flex justify-between items-center font-bold text-rose-900">
                    <span>{app.application_number}</span>
                    <span className="text-[10px] bg-rose-100 px-1.5 py-0.5 rounded font-mono">OVERDUE</span>
                  </div>
                  <p className="text-slate-800">{app.institution_name}</p>
                  <div className="text-[11px] text-slate-500 flex justify-between">
                    <span>Responsible: {app.assigned_officer_name || 'Dr. Rajesh K. Sharma'}</span>
                    <span className="font-mono">Deadline: {new Date(app.stage_deadline_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}

              {(!pendingActions?.actions?.overdue_applications || pendingActions.actions.overdue_applications.length === 0) && (
                <div className="p-6 text-center text-slate-400">
                  No overdue applications currently pending.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Integration Event Queue */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="font-semibold text-slate-900 uppercase tracking-wider text-[11px]">
              GET /api/integrations/n8n/events (Event Stream)
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              {events.length} Recorded Events
            </span>
          </div>

          <div className="p-4 divide-y divide-slate-100 max-h-96 overflow-y-auto space-y-2">
            {events.map((evt: any) => (
              <div key={evt.id} className="pt-2 first:pt-0 space-y-1 text-xs">
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span className="font-bold text-slate-800">{evt.event_type}</span>
                  <span className="text-slate-400">{new Date(evt.created_at).toLocaleTimeString()}</span>
                </div>
                <div className="p-2 bg-slate-900 text-slate-200 rounded font-mono text-[10px] overflow-x-auto">
                  {JSON.stringify(evt.payload, null, 2)}
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Status: <strong className="text-emerald-700">{evt.status}</strong></span>
                  <span>Attempts: {evt.delivery_attempts}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Simulator: Record Delivery Attempt */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
        <h3 className="font-semibold text-slate-900 uppercase tracking-wider text-[11px] mb-3">
          n8n Delivery Receipt Webhook Simulator (POST /api/integrations/n8n/record-delivery)
        </h3>
        <p className="text-slate-600 mb-4 text-[11px]">
          Simulate an incoming webhook callback from n8n or an external communication channel when an email or SMS notification is delivered to an applicant.
        </p>

        <form onSubmit={testRecordDelivery} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Recipient Email</label>
            <input
              type="email"
              value={deliveryRecipient}
              onChange={e => setDeliveryRecipient(e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900 font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Channel</label>
            <select
              value={deliveryChannel}
              onChange={e => setDeliveryChannel(e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900"
            >
              <option value="EMAIL">Email (SendGrid)</option>
              <option value="SMS">SMS (NIC Gateway)</option>
              <option value="WHATSAPP">WhatsApp Business</option>
              <option value="N8N_WEBHOOK">n8n Custom Webhook</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Status</label>
            <select
              value={deliveryStatus}
              onChange={e => setDeliveryStatus(e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900"
            >
              <option value="DELIVERED">DELIVERED (200 OK)</option>
              <option value="SENT">SENT (In Transit)</option>
              <option value="FAILED">FAILED (Bounce/Invalid)</option>
            </select>
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Dispatch Webhook</span>
          </button>
        </form>

        {testResult && (
          <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded text-slate-800 font-mono text-[11px]">
            {testResult}
          </div>
        )}
      </div>
    </div>
  );
};
