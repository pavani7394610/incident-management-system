const express          = require('express');
const router           = express.Router();
const WorkItemService  = require('../services/workItemService');

// GET /api/workitems
// Get all incidents for the dashboard
router.get('/', async (req, res) => {
  try {
    const items = await WorkItemService.getAll();
    res.json({ success: true, data: items, count: items.length });
  } catch (err) {
    console.error('Get all error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/workitems/dashboard
// Get live dashboard (from Redis cache, sorted by severity)
router.get('/dashboard', async (req, res) => {
  try {
    const data = await WorkItemService.getDashboard();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/workitems/:id
// Get one incident with all its raw signals
router.get('/:id', async (req, res) => {
  try {
    const item = await WorkItemService.getById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Work item not found' });
    }
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/workitems/:id/status
// Transition status (OPEN → INVESTIGATING → RESOLVED)
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'status field is required' });
    }

    const validStatuses = ['OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const result = await WorkItemService.transition(req.params.id, status, req.body);

    if (!result.success) {
      // State machine rejected the transition
      return res.status(422).json({
        error:        result.reason,
        code:         result.code,
        missingFields: result.missingFields,
      });
    }

    res.json({ success: true, data: result });

  } catch (err) {
    console.error('Status transition error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workitems/:id/rca
// Submit RCA and auto-close the incident
router.post('/:id/rca', async (req, res) => {
  try {
    const rcaData = req.body;

    // Required fields check
    const required = [
      'rootCauseCategory',
      'fixApplied',
      'preventionSteps',
      'incidentStart',
      'incidentEnd'
    ];

    const missing = required.filter(f => !rcaData[f]);
    if (missing.length > 0) {
      return res.status(400).json({
        error: `Missing required fields: ${missing.join(', ')}`,
        required,
      });
    }

    const result = await WorkItemService.submitRCA(req.params.id, rcaData);

    if (!result.success) {
      return res.status(422).json({
        error:        result.reason,
        missingFields: result.missingFields,
      });
    }

    res.json({
      success: true,
      message: 'RCA submitted. Incident closed.',
      data:    result,
    });

  } catch (err) {
    console.error('RCA submission error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/workitems/:id/rca
// Fetch RCA for a closed incident
router.get('/:id/rca', async (req, res) => {
  try {
    const rca = await WorkItemService.getRCA(req.params.id);
    if (!rca) {
      return res.status(404).json({ error: 'No RCA found for this incident' });
    }
    res.json({ success: true, data: rca });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;