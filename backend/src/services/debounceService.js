const { v4: uuidv4 } = require('uuid');
const { WorkItem } = require('../models/workItem');
const Signal = require('../models/Signal');
const { getAlertStrategy } = require('./alertStrategy');
const redisClient = require('../config/redis');

// In-memory map: componentId → { workItemId, signalCount, timer }
// This is our debounce tracking table
const debounceMap = new Map();

const DEBOUNCE_WINDOW  = parseInt(process.env.DEBOUNCE_WINDOW_MS)  || 10000; // 10 seconds
const DEBOUNCE_THRESHOLD = parseInt(process.env.DEBOUNCE_THRESHOLD) || 100;  // 100 signals

const debounceSignal = async (signal) => {
  const { componentId } = signal;

  // Do we already have an active debounce window for this component?
  if (debounceMap.has(componentId)) {
    const entry = debounceMap.get(componentId);
    entry.signalCount++;

    // Link this signal to the existing Work Item
    await Signal.findByIdAndUpdate(signal._id, {
      workItemId: entry.workItemId
    });

    // Increment the Work Item's signal count in PostgreSQL
    await WorkItem.incrementSignalCount(entry.workItemId);

    console.log(
      `🔗 Signal grouped → WorkItem ${entry.workItemId} ` +
      `(${entry.signalCount}/${DEBOUNCE_THRESHOLD} signals for ${componentId})`
    );

    return entry.workItemId;
  }

  // --- No active window — create a new Work Item ---
  const strategy  = getAlertStrategy(componentId);
  const workItemId = uuidv4();

  // Create Work Item in PostgreSQL
  const workItem = await WorkItem.create({
    id:          workItemId,
    componentId: componentId,
    severity:    signal.severity || strategy.getSeverity(),
    alertType:   strategy.getAlertType(),
  });

  // Link signal to Work Item in MongoDB
  await Signal.findByIdAndUpdate(signal._id, {
    workItemId: workItemId
  });

  // Track in our in-memory map
  debounceMap.set(componentId, {
    workItemId,
    signalCount: 1,
    // After DEBOUNCE_WINDOW ms, clear this entry
    // (next signal from same component creates a new Work Item)
    timer: setTimeout(() => {
      debounceMap.delete(componentId);
      console.log(`⏰ Debounce window closed for ${componentId}`);
    }, DEBOUNCE_WINDOW),
  });

  // Update Redis cache with new incident
  try {
    await redisClient.hSet('active_incidents', workItemId, JSON.stringify({
      workItemId,
      componentId,
      severity: workItem.severity,
      status: 'OPEN',
      createdAt: new Date().toISOString(),
    }));
  } catch (err) {
    // Cache failure is non-fatal — log and continue
    console.warn('Redis cache update failed:', err.message);
  }

  console.log(
    `🆕 New WorkItem created: ${workItemId} ` +
    `for ${componentId} [${strategy.getSeverity()}]`
  );

  return workItemId;
};

module.exports = { debounceSignal };