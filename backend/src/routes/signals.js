const express  = require('express');
const router   = express.Router();
const signalQueue    = require('../workers/signalQueue');
const { signalRateLimiter } = require('../middleware/rateLimiter');

// POST /api/signals
// This is the endpoint that receives incoming error signals
router.post('/', signalRateLimiter, async (req, res) => {
  try {
    const { componentId, type, severity, payload } = req.body;

    // --- Input validation ---
    if (!componentId || !type || !severity) {
      return res.status(400).json({
        error: 'Missing required fields: componentId, type, severity'
      });
    }

    const validSeverities = ['P0', 'P1', 'P2', 'P3'];
    const validTypes = ['ERROR', 'LATENCY_SPIKE', 'TIMEOUT', 'CRASH', 'DEGRADED'];

    if (!validSeverities.includes(severity)) {
      return res.status(400).json({
        error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}`
      });
    }

    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    // --- Add to queue (returns immediately — no waiting!) ---
    signalQueue.enqueue({ componentId, type, severity, payload: payload || {} });

    // Respond instantly — signal is accepted and queued
    // We don't wait for DB writes to respond (this is key for high throughput)
    return res.status(202).json({
      message: 'Signal accepted',
      queued:  true,
      queueStats: signalQueue.getStats(),
    });

  } catch (err) {
    console.error('Signal route error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/signals/queue-stats
// Check how the queue is doing
router.get('/queue-stats', (req, res) => {
  res.json(signalQueue.getStats());
});

module.exports = router;