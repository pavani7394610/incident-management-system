const pool = require('../config/postgres');

// First, create the table if it doesn't exist yet
const createTableQuery = `
  CREATE TABLE IF NOT EXISTS work_items (
    id            UUID PRIMARY KEY,
    component_id  VARCHAR(100) NOT NULL,
    status        VARCHAR(20)  NOT NULL DEFAULT 'OPEN',
    severity      VARCHAR(5)   NOT NULL,
    alert_type    VARCHAR(50)  NOT NULL,
    signal_count  INTEGER      NOT NULL DEFAULT 1,
    start_time    TIMESTAMP    NOT NULL DEFAULT NOW(),
    end_time      TIMESTAMP,
    mttr_seconds  INTEGER,
    rca_id        UUID,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS rca_records (
    id                UUID PRIMARY KEY,
    work_item_id      UUID NOT NULL REFERENCES work_items(id),
    root_cause_category VARCHAR(100) NOT NULL,
    fix_applied       TEXT NOT NULL,
    prevention_steps  TEXT NOT NULL,
    incident_start    TIMESTAMP NOT NULL,
    incident_end      TIMESTAMP NOT NULL,
    submitted_at      TIMESTAMP NOT NULL DEFAULT NOW()
  );
`;

// Run this when the app starts
const initDB = async () => {
  try {
    await pool.query(createTableQuery);
    console.log('✅ PostgreSQL tables ready');
  } catch (err) {
    console.error('Table creation error:', err.message);
  }
};

// --- WorkItem database functions ---

const WorkItem = {

  // Create a new Work Item
  create: async (data) => {
    const { id, componentId, severity, alertType } = data;
    const result = await pool.query(
      `INSERT INTO work_items
        (id, component_id, severity, alert_type, status, start_time)
       VALUES ($1, $2, $3, $4, 'OPEN', NOW())
       RETURNING *`,
      [id, componentId, severity, alertType]
    );
    return result.rows[0];
  },

  // Find a work item by ID
  findById: async (id) => {
    const result = await pool.query(
      'SELECT * FROM work_items WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  },

  // Get all work items, newest first
  findAll: async () => {
    const result = await pool.query(
      'SELECT * FROM work_items ORDER BY created_at DESC'
    );
    return result.rows;
  },

  // Update status with full transaction safety
  updateStatus: async (id, newStatus) => {
    const result = await pool.query(
      `UPDATE work_items
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [newStatus, id]
    );
    return result.rows[0];
  },

  // Increment signal count when more signals link to same work item
  incrementSignalCount: async (id) => {
    await pool.query(
      `UPDATE work_items
       SET signal_count = signal_count + 1, updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
  },

};

module.exports = { WorkItem, initDB };