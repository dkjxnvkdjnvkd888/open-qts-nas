import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import apiRouter from './routes/api.js';
import { getState, STORAGE_ROOT } from './store.js';
import { startTelemetryBroadcaster, getTelemetryHistory } from './services/monitor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 8000);

// Initialize persistent store and default NAS storage directories
getState();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api', apiRouter);

// Serve built React frontend when available (single-port production mode)
const clientDist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
      next();
      return;
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  ws.send(
    JSON.stringify({
      type: 'history',
      data: getTelemetryHistory(),
    })
  );
});

startTelemetryBroadcaster(wss);

server.listen(PORT, () => {
  console.log(`\n  OpenQTS 5.2 DIY PC NAS Server running on http://localhost:${PORT}`);
  console.log(`  NAS Storage Pool: ${STORAGE_ROOT}`);
  console.log(`  Default Login:    admin / admin\n`);
});
