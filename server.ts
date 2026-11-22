// @ts-nocheck

import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDatabase } from './server/db.js';
import { authRouter } from './server/routes/auth.js';
import { analyticsRouter } from './server/routes/analytics.js';
import { applicationsRouter } from './server/routes/applications.js';
import { evcRouter } from './server/routes/evc.js';
import { complianceRouter } from './server/routes/compliance.js';
import { adminRouter } from './server/routes/admin.js';
import { integrationsRouter } from './server/routes/integrations.js';
import { notificationsRouter } from './server/routes/notifications.js';
import { voiceRouter } from './server/routes/voice.js';
import { setupLiveWebSocket } from './server/live-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  await initDatabase();

  const app = express();
  const server = http.createServer(app);

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/applications', applicationsRouter);
  app.use('/api/evc', evcRouter);
  app.use('/api/compliance', complianceRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/integrations', integrationsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/voice', voiceRouter);

  // Attach Gemini Live Audio WebSocket on path /live
  setupLiveWebSocket(server);

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'healthy',
      service: 'aakalan Prototype Service',
      timestamp: new Date().toISOString()
    });
  });

  // Mount Vite middleware in development or serve built files in production
  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
    console.log('Vite middleware attached for hot development.');
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
      console.log('Serving production static build from dist directory.');
    } else {
      console.warn('dist directory not found; please run npm run build.');
    }
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`aakalan server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
