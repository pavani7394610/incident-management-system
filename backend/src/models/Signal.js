const mongoose = require('mongoose');

// This defines what one raw signal looks like in MongoDB
const signalSchema = new mongoose.Schema({

  // Which server/component sent this signal
  componentId: {
    type: String,
    required: true,
    // e.g. "CACHE_CLUSTER_01", "RDBMS_PRIMARY", "API_GATEWAY"
  },

  // Type of problem
  type: {
    type: String,
    enum: ['ERROR', 'LATENCY_SPIKE', 'TIMEOUT', 'CRASH', 'DEGRADED'],
    required: true,
  },

  // How serious is it
  severity: {
    type: String,
    enum: ['P0', 'P1', 'P2', 'P3'],
    required: true,
  },

  // The full error details (flexible — any JSON shape)
  payload: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },

  // Which Work Item this signal got grouped into
  // null means not yet grouped
  workItemId: {
    type: String,
    default: null,
  },

  // Exact time this signal arrived
  receivedAt: {
    type: Date,
    default: Date.now,
  },

});

// Index by componentId so we can query signals per component fast
signalSchema.index({ componentId: 1, receivedAt: -1 });
signalSchema.index({ workItemId: 1 });

module.exports = mongoose.model('Signal', signalSchema);