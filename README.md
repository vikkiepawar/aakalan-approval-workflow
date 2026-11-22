# aakalan — Approval Workflow Automation & Compliance Monitoring Platform

**aakalan** is a full-stack web application designed for automating and monitoring technical education approval-related workflows based on configurable rules inspired by the AICTE problem statement.

> **Disclaimer**: This is a prototype system developed for demonstration purposes. All institution records, officer names, and document attachments are synthetic demonstration data and not connected to official Council servers.

---

## Architecture Overview

```
                      +---------------------------------------+
                      |       React 19 + TypeScript SPA       |
                      |  Tailwind CSS v4 · Lucide · JetBrains |
                      +-------------------+-------------------+
                                          | JSON REST APIs (JWT Auth)
                                          v
                      +---------------------------------------+
                      |         Node.js Express Server        |
                      |   server.ts on Port 3000 (Full-Stack) |
                      +-------------------+-------------------+
                                          |
        +---------------------------------+---------------------------------+
        |                                 |                                 |
        v                                 v                                 v
+---------------+                +-----------------+               +------------------+
| Relational DB |                | Workflow Engine |               | n8n & Webhooks   |
| SQLite / WAL  |                | State Machine   |               | Escalation Hub   |
| data/*.sqlite |                | Rule v2 Version |               | Secret: X-Header |
+---------------+                +-----------------+               +------------------+
```

### Key Modules:
- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide icons, contextual modals, timeline visualizers, and persona switcher.
- **Backend API**: Express on port 3000 with JWT authentication, role-based authorization, rate limiting, and request validations.
- **Relational Storage**: Relational SQL database (`sql.js` WebAssembly SQLite with disk write-ahead persistence in `data/aicte_flow.sqlite`).
- **Workflow State Machine**: Configurable workflow templates (Scrutiny, EVC, SAC/SHC, Final Approval), strict permission validation, SLA deadline countdowns, and immutable audit logs.
- **n8n Webhook Engine**: Authenticated polling and webhook endpoints for automated overdue escalations and notification delivery logging.

---

## User Roles & Credentials (Synthetic Demo Data)

For instant evaluation, a quick persona switcher is available in the top bar. You may also log in using the following credentials (all use password: `aicte@demo123`):

| Persona / Role | Email | Scope & Authority |
|---|---|---|
| **Institution User** | `principal@vjti-polytechnic.edu.in` | Submit EoA applications, upload statutory documents, view deficiencies, submit rectifications, track undertakings. |
| **Scrutiny Officer** | `scrutiny.western@aicte-india.org` | Review assigned applications, examine documents, return with mandatory reasons, complete scrutiny stage. |
| **Regional / EVC Officer** | `ro.mumbai@aicte-india.org` | Schedule EVC visits, detect member date conflicts, record visit inspection outcomes & scores. |
| **System Administrator** | `admin.workflows@aicte-india.org` | Manage users & roles, build workflow templates, execute final approval orders, monitor n8n webhooks and audit trail. |

> **Security Rule**: Non-privileged users registering via the self-registration form are strictly assigned the `INSTITUTION` role. Privileged accounts (Scrutiny, Regional, Admin) can only be created by an authorized Administrator.

---

## Acceptance Test Scenario Verification

The 10-step end-to-end scenario was verified via automated script (`npx tsx test-scenario.ts`):
1. **Institution Submission**: Dr. Sachin V. Patel created an intake increase application.
2. **Database Persistence**: Saved with unique reference `AICTE/2026-27/WR/{SEQ}` and rule version 2.
3. **Officer Assignment**: Administrator assigned Dr. Rajesh K. Sharma (Scrutiny) and Prof. S. N. Deshmukh (Regional).
4. **Scrutiny Return**: Officer returned the application with a mandatory recorded reason and itemized deficiencies.
5. **Rectification**: Institution submitted point-by-point clarifications and attached proof documents.
6. **Stage Completion**: Scrutiny officer verified rectifications and completed the scrutiny gate.
7. **Workflow Advancement**: System transitioned the application to `UNDER_EVC` with SLA deadline calculation.
8. **Approaching Deadline**: Dynamic dashboard identified upcoming deadlines within 48 hours.
9. **Overdue Case Escalation**: Overdue applications were flagged and emitted to the n8n webhook stream.
10. **Immutable Audit History**: Every state transition and decision remark was cryptographically recorded with actor details and timestamp.

---

## n8n & External Webhook Integration

### Webhook Endpoints:
- `GET /api/integrations/n8n/pending-actions`: Returns eligible upcoming deadlines (<48h) and overdue applications.
- `POST /api/integrations/n8n/record-delivery`: Records delivery status from external providers (email, SMS, WhatsApp).
- `GET /api/integrations/n8n/events`: Returns event queue (`APPLICATION_SUBMITTED`, `STAGE_CHANGED`, `CORRECTION_SUBMITTED`).
- `POST /api/integrations/n8n/trigger-cron`: Triggers on-demand evaluation of deadlines and alert generation.

### Security:
External requests must provide the integration secret via header:
```bash
curl -X GET http://localhost:3000/api/integrations/n8n/pending-actions \
  -H "X-AICTE-FLOW-SECRET: aicte-flow-n8n-secret-key-2026"
```

---

## Running the Application Locally

### Prerequisites:
- Node.js 18+
- npm or bun

### Commands:
```bash
# 1. Install dependencies
npm install

# 2. Run automated acceptance test
npx tsx test-scenario.ts

# 3. Start development server (Port 3000)
npm run dev

# 4. Build production bundle
npm run build

# 5. Start production server
npm run start
```

---

## Connecting to GitHub

1. Initialize git (if not already done):
   ```bash
   git init
   git add .
   git commit -m "feat: complete aakalan approval automation prototype"
   ```
2. Create a new repository on GitHub: `https://github.com/your-username/aicte-flow`
3. Link and push:
   ```bash
   git remote add origin https://github.com/your-username/aicte-flow.git
   git branch -M main
   git push -u origin main
   ```

---

## Status of Implemented Features

### Implemented:
- Full-stack React + TypeScript + Express architecture on port 3000.
- Relational SQLite database with schema migrations and seed records.
- 4 Role Dashboards (Institution, Scrutiny Officer, Regional Officer, Administrator).
- Configurable approval workflow engine with template builder (Scrutiny, EVC, SAC/SHC, Final Approval).
- Mandatory legal reason validation on returns and rejections.
- Point-by-point institutional correction and resubmission desk.
- EVC scheduling with committee member assignment and **real-time conflict detection**.
- EVC inspection outcome recorder with infrastructure/lab/faculty scoring.
- Prescribed documents registry with 30-day advance expiry warnings and private downloads.
- Time-bound compliance undertakings tracker with penalty indicators.
- Live n8n webhook and notification delivery simulator.
- Immutable system audit trail.

### Planned for Future Iterations:
- Real-time video conferencing link generation for Virtual EVC inspections.
- Biometric facial recognition integration for physical committee presence verification.
- Direct digital signature certificate (DSC / eSign) integration with Aadhaar/eMudhra.
