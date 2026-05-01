require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');

const connectMongo       = require('./config/mongodb');
const { initDB }         = require('./models/workItem');
const signalRoutes       = require('./routes/signals');

const app  = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));  // Accept large signal payloads

// --- Routes ---
app.use('/api/signals', signalRoutes);

// --- Health endpoint ---
app.get('/health', (req, res) => {
  const signalQueue = require('./workers/signalQueue');
  res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    queue:     signalQueue.getStats(),
  });
});

app.get('/', (req, res) => {
  res.json({ message: 'IMS Backend running 🚀' });
});

// --- Start everything ---
const startServer = async () => {
  await connectMongo();  // Connect MongoDB
  await initDB();        // Create PostgreSQL tables

  app.listen(PORT, () => {
    console.log(`\n🚀 IMS Backend running on http://localhost:${PORT}`);
    console.log(`📊 Health: http://localhost:${PORT}/health\n`);
  });

  // Throughput metrics every 5 seconds
  let signalCount = 0;
  global.incrementSignalCount = () => signalCount++;
  setInterval(() => {
    console.log(`📈 Throughput: ${signalCount} signals/sec (last 5s)`);
    signalCount = 0;
  }, 5000);
};

startServer();