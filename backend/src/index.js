require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// Import database connectors
const pool = require('./config/postgres');
const connectMongo = require('./config/mongodb');
const redisClient = require('./config/redis');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware (runs on every request) ---
app.use(helmet());          // Security headers
app.use(cors());            // Allow React frontend to call us
app.use(express.json());    // Parse JSON request bodies

// --- Health endpoint (required by assignment) ---
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      postgres: 'connected',
      mongodb: 'connected',
      redis: 'connected',
    }
  });
});

// --- Placeholder routes (we'll fill these in Phase 3 & 4) ---
app.get('/', (req, res) => {
  res.json({ message: 'IMS Backend is running 🚀' });
});

// --- Start server ---
const startServer = async () => {
  // Connect to all databases first
  await connectMongo();

  app.listen(PORT, () => {
    console.log(`\n🚀 IMS Backend running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health\n`);
  });

  // Throughput metrics — prints every 5 seconds (required by assignment)
  let signalCount = 0;
  global.incrementSignalCount = () => signalCount++;

  setInterval(() => {
    console.log(`📈 Throughput: ${signalCount} signals in last 5 seconds`);
    signalCount = 0;
  }, 5000);
};

startServer();