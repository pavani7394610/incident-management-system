const { withRetry } = require('../utils/retry');

// Submit RCA + close incident with retry
const submitRCA = async (pool, workItemId, rcaData) => {
  const {
    rootCauseCategory,
    fixApplied,
    preventionSteps,
    incidentStart,
    incidentEnd,
  } = rcaData;

  return await withRetry(
    async () => {
      // 1. Insert RCA
      await pool.query(
        `
        INSERT INTO rca_reports 
        (work_item_id, root_cause_category, fix_applied, prevention_steps, incident_start, incident_end)
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          workItemId,
          rootCauseCategory,
          fixApplied,
          preventionSteps,
          incidentStart,
          incidentEnd,
        ]
      );

      // 2. Update work item → CLOSED
      await pool.query(
        `
        UPDATE work_items
        SET status = 'CLOSED'
        WHERE id = $1
        `,
        [workItemId]
      );

      return {
        success: true,
        workItemId,
      };
    },
    {
      maxAttempts: 3,
      baseDelay: 500,
      label: 'RCA submission',
    }
  );
};

module.exports = {
  submitRCA,
};