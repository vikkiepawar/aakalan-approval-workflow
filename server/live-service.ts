// @ts-ignore Dependency types are supplied by the server runtime installation.
import { WebSocketServer, WebSocket } from 'ws';
// @ts-ignore Dependency types are supplied by the server runtime installation.
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { queryOne, queryAll } from './db.js';

const SYSTEM_INSTRUCTION = `You are the aakalan Voice Assistant (आकलन वॉयस असिस्टेंट / आकलन आवाज सहाय्यक), the voice-enabled guide for the aakalan approval workflow and compliance monitoring platform.

You provide concise, natural, polite spoken answers.
You fluently support:
1. English
2. Hindi (हिंदी)
3. Marathi (मराठी)

Respond in the language the user is speaking or requests. If the user greets in Hindi or Marathi, respond warmly in that language.

Key Knowledge & Capabilities:
- Application Navigation: Guide users across Institution, Scrutiny Officer, Regional/EVC, and Administrator desks.
- Application Submission: Explain how to create an application (EoA, Increase Intake, New Course), specify academic year 2026-27, and attach documents.
- Workflow Stages: Explain the current stage of an application (STAGE_SCRUTINY, STAGE_EVC, STAGE_SAC_SHC, STAGE_FINAL_APPROVAL).
- Documents & Expiries: Check statutory documents (Land Title, Building Plan, Fire Safety NOC, AICTE Affidavit), validity periods, and identify documents expiring within 30 days.
- Deficiency & Return Reasons: Explain why an application was returned with mandatory reasons recorded by scrutiny officers, and guide the institution on submitting rectifications.
- Authorized Tasks & SLA: Explain pending actions, SLA approaching deadlines (<48 hours), and overdue tasks.
- Compliance Checklists: Explain time-bound undertakings and commitments.
- Deficiency Notice Drafting: Explain how scrutiny officers record observations with categories and severity levels (CRITICAL, MAJOR, MINOR).

Keep your spoken replies concise (2 to 4 sentences maximum), conversational, and easy to listen to. Use the available database tools to look up real-time facts about applications and documents when asked.`;

const LIVE_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'getApplicationStatus',
        description: 'Lookup the current workflow stage, approval status, SLA deadline, and assigned officer for an AICTE application number.',
        parameters: {
          type: 'OBJECT' as const,
          properties: {
            application_number: {
              type: 'STRING' as const,
              description: 'AICTE Application Reference Number, e.g., AICTE/2026-27/WR/8236 or part of it'
            }
          },
          required: ['application_number']
        }
      },
      {
        name: 'getExpiringDocuments',
        description: 'Get list of statutory institutional documents expiring soon (within 30 days) or already expired.',
        parameters: {
          type: 'OBJECT' as const,
          properties: {}
        }
      },
      {
        name: 'getDeficiencyDetails',
        description: 'Lookup recorded deficiencies, return reasons, and rectification responses for an application.',
        parameters: {
          type: 'OBJECT' as const,
          properties: {
            application_number: {
              type: 'STRING' as const,
              description: 'AICTE Application Reference Number'
            }
          },
          required: ['application_number']
        }
      },
      {
        name: 'getPendingTasksSummary',
        description: 'Retrieve pending applications count, overdue cases, and active SLA statistics.',
        parameters: {
          type: 'OBJECT' as const,
          properties: {
            role: {
              type: 'STRING' as const,
              description: 'Role of the user (INSTITUTION, SCRUTINY_OFFICER, REGIONAL_OFFICER, ADMIN)'
            }
          }
        }
      }
    ]
  }
];

function handleToolExecution(name: string, args: any): Record<string, any> {
  try {
    if (name === 'getApplicationStatus') {
      const query = `%${args.application_number || ''}%`;
      const app = queryOne<any>(
        `SELECT a.application_number, a.academic_year, a.application_type, a.status,
                a.current_stage_code, a.stage_deadline_at, i.name as institution_name,
                a.assigned_region, wt.name as workflow_template_name
         FROM applications a
         JOIN institutions i ON a.institution_id = i.id
         LEFT JOIN workflow_templates wt ON a.workflow_template_id = wt.id
         WHERE a.application_number LIKE ? LIMIT 1`,
        [query]
      );
      if (!app) {
        return { found: false, message: `No application matching "${args.application_number}" found.` };
      }
      return {
        found: true,
        application_number: app.application_number,
        institution: app.institution_name,
        type: app.application_type,
        status: app.status,
        current_stage: app.current_stage_code,
        workflow: app.workflow_template_name,
        deadline: app.stage_deadline_at
      };
    }

    if (name === 'getExpiringDocuments') {
      const now = new Date();
      const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const docs = queryAll<any>(
        `SELECT d.title, d.document_type, d.valid_to, d.verification_status, i.name as institution_name
         FROM documents d
         JOIN institutions i ON d.institution_id = i.id
         WHERE d.valid_to <= ?
         ORDER BY d.valid_to ASC
         LIMIT 6`,
        [in30Days]
      );
      return {
        expiringDocuments: docs.map(d => ({
          title: d.title,
          type: d.document_type,
          valid_to: d.valid_to,
          status: d.verification_status,
          institution: d.institution_name
        }))
      };
    }

    if (name === 'getDeficiencyDetails') {
      const query = `%${args.application_number || ''}%`;
      const app = queryOne<any>('SELECT id, application_number, status FROM applications WHERE application_number LIKE ? LIMIT 1', [query]);
      if (!app) {
        return { found: false, message: 'Application not found.' };
      }
      const deficiencies = queryAll<any>(
        'SELECT category, description, severity, status, institutional_response, raised_by_name FROM application_deficiencies WHERE application_id = ?',
        [app.id]
      );
      return {
        application_number: app.application_number,
        status: app.status,
        deficienciesCount: deficiencies.length,
        deficiencies: deficiencies.map(d => ({
          category: d.category,
          severity: d.severity,
          status: d.status,
          description: d.description,
          response: d.institutional_response,
          raisedBy: d.raised_by_name
        }))
      };
    }

    if (name === 'getPendingTasksSummary') {
      const now = new Date().toISOString();
      const totalPending = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM applications WHERE status NOT IN ("APPROVED", "REJECTED")')?.count || 0;
      const overdue = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM applications WHERE stage_deadline_at < ? AND status NOT IN ("APPROVED", "REJECTED")', [now])?.count || 0;
      const correction = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM applications WHERE status = "CORRECTION_REQUIRED"')?.count || 0;
      const evc = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM applications WHERE status = "UNDER_EVC"')?.count || 0;

      return {
        totalPendingApplications: totalPending,
        overdueCases: overdue,
        awaitingInstitutionalCorrection: correction,
        awaitingEvcScheduling: evc
      };
    }

    return { error: 'Unknown tool function' };
  } catch (err: any) {
    return { error: err.message || 'Tool execution failed' };
  }
}

export function setupLiveWebSocket(server: any) {
  const wss = new WebSocketServer({ server, path: '/live' });

  wss.on('connection', async (clientWs: WebSocket) => {
    console.log('Client connected to AICTE Live Voice WebSocket');

    const apiKey = (globalThis as any).process?.env?.GEMINI_API_KEY;
    if (!apiKey) {
      clientWs.send(JSON.stringify({
        type: 'error',
        message: 'GEMINI_API_KEY is not configured on the server. Please configure it in Settings > Secrets.'
      }));
      clientWs.close();
      return;
    }

    let liveSession: any = null;

    try {
      const ai = new GoogleGenAI({ apiKey });

      liveSession = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Aoede' }
            }
          },
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: LIVE_TOOLS as any
        },
        callbacks: {
          onmessage: async (message: LiveServerMessage) => {
            try {
              // 1. Audio stream chunks from Gemini Live
              const audioPart = message.serverContent?.modelTurn?.parts?.find((p: any) => p.inlineData);
              if (audioPart && audioPart.inlineData?.data) {
                clientWs.send(JSON.stringify({
                  type: 'audio',
                  audio: audioPart.inlineData.data
                }));
              }

              // 2. Text or transcription output if any
              const textPart = message.serverContent?.modelTurn?.parts?.find((p: any) => p.text);
              if (textPart && textPart.text) {
                clientWs.send(JSON.stringify({
                  type: 'text',
                  text: textPart.text
                }));
              }

              // 3. User speech interruption
              if (message.serverContent?.interrupted) {
                clientWs.send(JSON.stringify({
                  type: 'interrupted',
                  interrupted: true
                }));
              }

              // 4. Model turn complete
              if (message.serverContent?.turnComplete) {
                clientWs.send(JSON.stringify({
                  type: 'turnComplete'
                }));
              }

              // 5. Tool call from Gemini Live
              if (message.toolCall) {
                const functionCalls = message.toolCall.functionCalls;
                if (functionCalls && functionCalls.length > 0) {
                  for (const call of functionCalls) {
                    const funcName = call.name || '';
                    const result = handleToolExecution(funcName, call.args);
                    await liveSession.sendToolResponse({
                      functionResponses: [
                        {
                          id: call.id,
                          name: funcName,
                          response: { output: result }
                        }
                      ]
                    });
                  }
                }
              }
            } catch (msgErr) {
              console.warn('Error processing LiveServerMessage:', msgErr);
            }
          },
          onclose: () => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'sessionClosed' }));
            }
          },
          onerror: (err: any) => {
            console.warn('Gemini Live session error:', err?.message || err);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'error',
                message: err?.message || 'Live session error'
              }));
            }
          }
        }
      });

      clientWs.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to AICTE Live Voice Engine (gemini-3.8-live)'
      }));

    } catch (err: any) {
      console.warn('Failed to connect to Gemini Live API:', err?.message || err);
      clientWs.send(JSON.stringify({
        type: 'error',
        message: 'Failed to establish Gemini Live connection: ' + (err?.message || 'Unknown error')
      }));
      return;
    }

    clientWs.on('message', (data: any) => {
      try {
        const payload = JSON.parse(data.toString());

        // Stream real-time input audio chunk (PCM 16kHz)
        if (payload.audio && liveSession) {
          liveSession.sendRealtimeInput({
            audio: {
              data: payload.audio,
              mimeType: 'audio/pcm;rate=16000'
            }
          });
        }

        // Stream real-time text input (for text fallback or language prompt)
        if (payload.text && liveSession) {
          liveSession.sendRealtimeInput({
            text: payload.text
          });
        }
      } catch (clientErr) {
        console.warn('Error reading client WebSocket message:', clientErr);
      }
    });

    clientWs.on('close', () => {
      if (liveSession) {
        try {
          liveSession.close();
        } catch {
          // ignore
        }
      }
    });
  });
}
