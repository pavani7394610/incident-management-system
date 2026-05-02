const { v4: uuidv4 }   = require('uuid');
const pool             = require('../config/postgres');
const { WorkItem }     = require('../models/workItem');
const Signal           = require('../models/Signal');
const { getState }     = require('./workItemStateMachine');
const { calculateMTTR } = require('./mttrService');
const redisClient      = require('../config/redis');

// --- Retry helper ---
// If a DB write fails, try again up to 3 times
const withRetry = async (fn, retries = 3, delay = 500) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`DB write failed (attempt ${attempt}/${retries}). Retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      delay *= 2; // Exponential backoff — wait longer each time
    }
  }
};

const WorkItemService = {

  // Get all work items with their signal counts
  getAll: async () => {
    const workItems = await WorkItem.findAll();
    return workItems;
  },

  // Get one work item with all its raw signals from MongoDB
  getById: async (id) => {
    // Get Work Item from PostgreSQL
    const workItem = await WorkItem.findById(id);
    if (!workItem) return null;

    // Get all linked signals from MongoDB
    const signals = await Signal.find({ workItemId: id })
      .sort({ receivedAt: -1 })
      .limit(100); // Show latest 100 signals

    return { ...workItem, signals };
  },

  // Transition status using State Pattern
  transition: async (id, newStatus, context = {}) => {

    // Load work item
    const workItem = await WorkItem.findById(id);
    if (!workItem) {
      throw new Error(`Work item ${id} not found`);
    }

    // Get current state object
    const currentState = getState(workItem);

    // Ask the state: is this transition allowed?
    const result = await currentState.transitionTo(newStatus, context);

    if (!result.allowed) {
      // Return the reason so the API can tell the user why
      return {
        success: false,
        reason:  result.reason,
        code:    result.code,
        missingFields: result.missingFields,
      };
    }

    // --- Transition is allowed — execute it ---

    // Use a PostgreSQL transaction so it's all-or-nothing
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Update work item status
      await client.query(
        `UPDATE work_items
         SET status = $1, updated_at = NOW()
         WHERE id = $2`,
        [newStatus, id]
      );

      let rcaId    = null;
      let mttrData = null;

      // If closing — save RCA and calculate MTTR
      if (newStatus === 'CLOSED' && context.rca) {
        const { rca } = context;

        // Calculate MTTR
        mttrData = calculateMTTR(rca.incidentStart, rca.incidentEnd);

        // Save RCA record
        rcaId = uuidv4();
        await client.query(
          `INSERT INTO rca_records
             (id, work_item_id, root_cause_category,
              fix_applied, prevention_steps,
              incident_start, incident_end)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            rcaId,
            id,
            rca.rootCauseCategory,
            rca.fixApplied,
            rca.preventionSteps,
            new Date(rca.incidentStart),
            new Date(rca.incidentEnd),
          ]
        );

        // Link RCA to Work Item + save MTTR
        await client.query(
          `UPDATE work_items
           SET rca_id = $1,
               end_time = $2,
               mttr_seconds = $3,
               updated_at = NOW()
           WHERE id = $4`,
          [rcaId, new Date(rca.incidentEnd), mttrData.mttrSeconds, id]
        );
      }

      await client.query('COMMIT');

      // Update Redis cache
      try {
        if (newStatus === 'CLOSED') {
          // Remove from active incidents cache
          await redisClient.hDel('active_incidents', id);
        } else {
          // Update status in cache
          const cached = await redisClient.hGet('active_incidents', id);
          if (cached) {
            const parsed = JSON.parse(cached);
            parsed.status = newStatus;
            await redisClient.hSet('active_incidents', id, JSON.stringify(parsed));
          }
        }
      } catch (cacheErr) {
        // Cache failure is non-fatal
        console.warn('Redis update failed:', cacheErr.message);
      }

      console.log(`✅ WorkItem ${id}: ${workItem.status} → ${newStatus}`);

      return {
        success: true,
        workItemId: id,
        previousStatus: workItem.status,
        newStatus,
        mttr: mttrData,
        rcaId,
        availableTransitions: getState({ status: newStatus }).getAvailableTransitions(),
      };

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // Submit RCA separately (before closing)
  submitRCA: async (workItemId, rcaData) => {
    // Validate all fields first
    const required = [
      'rootCauseCategory',
      'fixApplied',
      'preventionSteps',
      'incidentStart',
      'incidentEnd'
    ];

    const missing = required.filter(
      f => !rcaData[f] || String(rcaData[f]).trim() === ''
    );

    if (missing.length > 0) {
      return {
        success: false,
        reason: `Missing required RCA fields: ${missing.join(', ')}`,
        missingFields: missing,
      };
    }

    // Save RCA (with retry for resilience)
    return await withRetry(async () => {
      const workItem = await WorkItem.findById(workItemId);
      if (!workItem) throw new Error(`Work item ${workItemId} not found`);

      if (workItem.status !== 'RESOLVED') {
        return {
          success: false,
          reason: 'RCA can only be submitted for RESOLVED incidents.',
        };
      }

      // Auto-transition to CLOSED with RCA
      return await WorkItemService.transition(workItemId, 'CLOSED', {
        rca: rcaData
      });
    });
  },

  // Get RCA for a work item
  getRCA: async (workItemId) => {
    const result = await pool.query(
      'SELECT * FROM rca_records WHERE work_item_id = $1',
      [workItemId]
    );
    return result.rows[0] || null;
  },

  // Get live dashboard from Redis cache
  // Falls back to PostgreSQL if cache is empty
  getDashboard: async () => {
    try {
      const cached = await redisClient.hGetAll('active_incidents');
      if (cached && Object.keys(cached).length > 0) {
        return Object.values(cached)
          .map(v => JSON.parse(v))
          .sort((a, b) => {
            // Sort by severity: P0 first
            const order = { P0: 0, P1: 1, P2: 2, P3: 3 };
            return (order[a.severity] ?? 9) - (order[b.severity] ?? 9);
          });
      }
    } catch (err) {
      console.warn('Redis read failed, falling back to PostgreSQL');
    }

    // Fallback: query PostgreSQL directly
    const result = await pool.query(
      `SELECT * FROM work_items
       WHERE status != 'CLOSED'
       ORDER BY
         CASE severity
           WHEN 'P0' THEN 0
           WHEN 'P1' THEN 1
           WHEN 'P2' THEN 2
           ELSE 3
         END,
         created_at DESC`
    );
    return result.rows;
  },

};

module.exports = WorkItemService;