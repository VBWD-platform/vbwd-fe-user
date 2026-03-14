import express from 'express';
import cors from 'cors';
import { createHmacAuth } from './middleware/hmac-auth.js';
import { pluginRateLimit } from './middleware/rate-limit.js';
import { createPluginRoutes } from './routes/plugins.js';
import { PluginConfigService } from './services/plugin-config.js';

const PLUGIN_API_SECRET = process.env.PLUGIN_API_SECRET || '';
const PLUGIN_API_PORT = parseInt(process.env.PLUGIN_API_PORT || '3001', 10);
const PLUGINS_DIR = process.env.PLUGINS_DIR || '/app/plugins';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:8081';

if (!PLUGIN_API_SECRET || PLUGIN_API_SECRET.length < 32) {
  console.error('[Plugin API] PLUGIN_API_SECRET must be set and at least 32 characters long');
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1);

app.use(cors({
  origin: CORS_ORIGIN,
  methods: ['GET', 'PUT', 'POST'],
  allowedHeaders: ['Content-Type', 'X-Plugin-Timestamp', 'X-Plugin-Signature']
}));

app.use(express.json());

app.use(pluginRateLimit);
app.use(createHmacAuth(PLUGIN_API_SECRET));

const service = new PluginConfigService(PLUGINS_DIR);
app.use('/_plugins', createPluginRoutes(service));

app.listen(PLUGIN_API_PORT, '0.0.0.0', () => {
  console.warn(`[Plugin API] Listening on port ${PLUGIN_API_PORT}`);
});

export { app };
