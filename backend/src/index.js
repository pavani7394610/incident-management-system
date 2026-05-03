require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const mongoose  = require('mongoose');

const connectMongo              = require('./config/mongodb');
const pool                      = require('./config/postgres');
const redisClient               = require('./config/redis');
const { initDB }                = require('./models/workItem');
const signalRoutes              = require('./routes/signals');
const workItemRoutes            = require('./routes/workItems');
const { requestLogger }         = require('./middleware/requestLogger');
const { errorHandler,
        notFoundHandler }       = require('./middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(requestLogger);

// ── Routes ──────────────────────────────────────
app.use('/api/signals',   signalRoutes);
app.use('/api/workitems', workItemRoutes);

// ── Health endpoint ──────────────────────────────
app.get('/health', async (req, res) => {
  const health = {
    status:    'ok',
    timestamp: new Date().toISOString(),
    uptime:    `${Math.floor(process.uptime())}s`,
    services:  {},
  };

  // PostgreSQL ping
  try {
    await pool.query('SELECT 1');
    health.services.postgres = { status: 'ok' };
  } catch (err) {
    health.services.postgres = { status: 'error', message: err.message };
    health.status = 'degraded';
  }

  // MongoDB readyState
  try {
    health.services.mongodb = mongoose.connection.readyState === 1
      ? { status: 'ok' }
      : { status: 'error', message: 'Not connected' };
    if (mongoose.connection.readyState !== 1) health.status = 'degraded';
  } catch (err) {
    health.services.mongodb = { status: 'error', message: err.message };
    health.status = 'degraded';
  }

  // Redis ping
  try {
    await redisClient.ping();
    health.services.redis = { status: 'ok' };
  } catch (err) {
    health.services.redis = { status: 'error', message: err.message };
    health.status = 'degraded';
  }

  const signalQueue = require('./workers/signalQueue');
  health.queue = signalQueue.getStats();

  res.status(health.status === 'ok' ? 200 : 503).json(health);
});

app.get('/', (req, res) => {
  res.json({ message: 'IMS Backend running 🚀' });
});

// ── 404 + Error handlers (must be LAST) ─────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Start ────────────────────────────────────────
const startServer = async () => {
  await connectMongo();
  await initDB();

  app.listen(PORT, () => {
    console.log(`\n🚀 IMS Backend → http://localhost:${PORT}`);
    console.log(`📊 Health check → http://localhost:${PORT}/health\n`);
  });

  // Throughput metrics every 5 seconds
  let signalCount = 0;
  let errorCount  = 0;

  global.incrementSignalCount = () => signalCount++;
  global.incrementErrorCount  = () => errorCount++;

  setInterval(async () => {
    const signalQueue = require('./workers/signalQueue');
    let openCount = 0;
    try {
      const r = await pool.query(
        `SELECT COUNT(*) FROM work_items WHERE status != 'CLOSED'`
      );
      openCount = parseInt(r.rows[0].count);
    } catch { /* non-fatal */ }

    console.log(
      `\n📈 [${new Date().toLocaleTimeString()}] ` +
      `Signals/5s: ${signalCount} | ` +
      `Errors: ${errorCount} | ` +
      `Queue: ${signalQueue.getStats().queueLength} | ` +
      `Active incidents: ${openCount}`
    );

    signalCount = 0;
    errorCount  = 0;
  }, 5000);
};

startServer();