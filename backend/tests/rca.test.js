// ─────────────────────────────────────────────
//  IMS Test Suite
//  Run with: npm test
// ─────────────────────────────────────────────

const { getState }       = require('../src/services/workItemStateMachine');
const { calculateMTTR }  = require('../src/services/mttrService');
const { getAlertStrategy } = require('../src/services/alertStrategy');

// ── Helper: build a fake work item ──────────────
const makeWorkItem = (status) => ({ id: 'test-id-123', status });

// ════════════════════════════════════════════════
//  1. STATE MACHINE TESTS
// ════════════════════════════════════════════════
describe('State Machine — transition rules', () => {

  // OPEN state
  test('OPEN → INVESTIGATING is allowed', async () => {
    const result = await getState(makeWorkItem('OPEN'))
      .transitionTo('INVESTIGATING', {});
    expect(result.allowed).toBe(true);
  });

  test('OPEN → RESOLVED is blocked', async () => {
    const result = await getState(makeWorkItem('OPEN'))
      .transitionTo('RESOLVED', {});
    expect(result.allowed).toBe(false);
  });

  test('OPEN → CLOSED is blocked', async () => {
    const result = await getState(makeWorkItem('OPEN'))
      .transitionTo('CLOSED', {});
    expect(result.allowed).toBe(false);
  });

  // INVESTIGATING state
  test('INVESTIGATING → RESOLVED is allowed', async () => {
    const result = await getState(makeWorkItem('INVESTIGATING'))
      .transitionTo('RESOLVED', {});
    expect(result.allowed).toBe(true);
  });

  test('INVESTIGATING → OPEN (rollback) is allowed', async () => {
    const result = await getState(makeWorkItem('INVESTIGATING'))
      .transitionTo('OPEN', {});
    expect(result.allowed).toBe(true);
  });

  test('INVESTIGATING → CLOSED is blocked', async () => {
    const result = await getState(makeWorkItem('INVESTIGATING'))
      .transitionTo('CLOSED', {});
    expect(result.allowed).toBe(false);
  });

  // RESOLVED state
  test('RESOLVED → INVESTIGATING (regression) is allowed', async () => {
    const result = await getState(makeWorkItem('RESOLVED'))
      .transitionTo('INVESTIGATING', {});
    expect(result.allowed).toBe(true);
  });

  // CLOSED state
  test('CLOSED → OPEN is blocked (terminal state)', async () => {
    const result = await getState(makeWorkItem('CLOSED'))
      .transitionTo('OPEN', {});
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('ALREADY_CLOSED');
  });

  test('CLOSED → INVESTIGATING is blocked', async () => {
    const result = await getState(makeWorkItem('CLOSED'))
      .transitionTo('INVESTIGATING', {});
    expect(result.allowed).toBe(false);
  });

  // Available transitions
  test('OPEN reports correct available transitions', () => {
    const transitions = getState(makeWorkItem('OPEN'))
      .getAvailableTransitions();
    expect(transitions).toContain('INVESTIGATING');
    expect(transitions).not.toContain('CLOSED');
  });

  test('CLOSED reports no available transitions', () => {
    const transitions = getState(makeWorkItem('CLOSED'))
      .getAvailableTransitions();
    expect(transitions).toHaveLength(0);
  });

});

// ════════════════════════════════════════════════
//  2. RCA VALIDATION TESTS
// ════════════════════════════════════════════════
describe('RCA Validation', () => {

  // Helper: a complete valid RCA
  const validRCA = {
    rootCauseCategory: 'Infrastructure',
    fixApplied:        'Restarted the database and increased connection pool',
    preventionSteps:   'Add monitoring alerts for connection pool usage',
    incidentStart:     '2026-05-01T10:00:00Z',
    incidentEnd:       '2026-05-01T12:00:00Z',
  };

  test('allows CLOSED with a complete valid RCA', async () => {
    const result = await getState(makeWorkItem('RESOLVED'))
      .transitionTo('CLOSED', { rca: validRCA });
    expect(result.allowed).toBe(true);
    expect(result.nextStatus).toBe('CLOSED');
  });

  test('blocks CLOSED with no RCA at all', async () => {
    const result = await getState(makeWorkItem('RESOLVED'))
      .transitionTo('CLOSED', {});
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('RCA_MISSING');
  });

  test('blocks CLOSED when rootCauseCategory is empty', async () => {
    const result = await getState(makeWorkItem('RESOLVED'))
      .transitionTo('CLOSED', {
        rca: { ...validRCA, rootCauseCategory: '' }
      });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('RCA_INCOMPLETE');
    expect(result.missingFields).toContain('rootCauseCategory');
  });

  test('blocks CLOSED when fixApplied is empty', async () => {
    const result = await getState(makeWorkItem('RESOLVED'))
      .transitionTo('CLOSED', {
        rca: { ...validRCA, fixApplied: '   ' }  // whitespace only
      });
    expect(result.allowed).toBe(false);
    expect(result.missingFields).toContain('fixApplied');
  });

  test('blocks CLOSED when preventionSteps is empty', async () => {
    const result = await getState(makeWorkItem('RESOLVED'))
      .transitionTo('CLOSED', {
        rca: { ...validRCA, preventionSteps: '' }
      });
    expect(result.allowed).toBe(false);
    expect(result.missingFields).toContain('preventionSteps');
  });

  test('blocks CLOSED when incidentStart is missing', async () => {
    const result = await getState(makeWorkItem('RESOLVED'))
      .transitionTo('CLOSED', {
        rca: { ...validRCA, incidentStart: null }
      });
    expect(result.allowed).toBe(false);
    expect(result.missingFields).toContain('incidentStart');
  });

  test('blocks CLOSED when incidentEnd is missing', async () => {
    const result = await getState(makeWorkItem('RESOLVED'))
      .transitionTo('CLOSED', {
        rca: { ...validRCA, incidentEnd: null }
      });
    expect(result.allowed).toBe(false);
    expect(result.missingFields).toContain('incidentEnd');
  });

  test('blocks CLOSED when end time is before start time', async () => {
    const result = await getState(makeWorkItem('RESOLVED'))
      .transitionTo('CLOSED', {
        rca: {
          ...validRCA,
          incidentStart: '2026-05-01T12:00:00Z',
          incidentEnd:   '2026-05-01T10:00:00Z', // before start!
        }
      });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('RCA_INVALID_DATES');
  });

  test('blocks CLOSED when end time equals start time', async () => {
    const result = await getState(makeWorkItem('RESOLVED'))
      .transitionTo('CLOSED', {
        rca: {
          ...validRCA,
          incidentStart: '2026-05-01T10:00:00Z',
          incidentEnd:   '2026-05-01T10:00:00Z', // same!
        }
      });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('RCA_INVALID_DATES');
  });

  test('reports all missing fields at once (not just the first)', async () => {
    const result = await getState(makeWorkItem('RESOLVED'))
      .transitionTo('CLOSED', {
        rca: {
          rootCauseCategory: '',
          fixApplied:        '',
          preventionSteps:   '',
          incidentStart:     '2026-05-01T10:00:00Z',
          incidentEnd:       '2026-05-01T12:00:00Z',
        }
      });
    expect(result.allowed).toBe(false);
    expect(result.missingFields.length).toBeGreaterThanOrEqual(3);
  });

});

// ════════════════════════════════════════════════
//  3. MTTR CALCULATION TESTS
// ════════════════════════════════════════════════
describe('MTTR Calculation', () => {

  test('calculates 90 minutes correctly as 5400 seconds', () => {
    const { mttrSeconds } = calculateMTTR(
      '2026-05-01T10:00:00Z',
      '2026-05-01T11:30:00Z'
    );
    expect(mttrSeconds).toBe(5400);
  });

  test('formats 5400 seconds as "1h 30m"', () => {
    const { mttrFormatted } = calculateMTTR(
      '2026-05-01T10:00:00Z',
      '2026-05-01T11:30:00Z'
    );
    expect(mttrFormatted).toBe('1h 30m');
  });

  test('formats 30 seconds correctly', () => {
    const { mttrSeconds, mttrFormatted } = calculateMTTR(
      '2026-05-01T10:00:00Z',
      '2026-05-01T10:00:30Z'
    );
    expect(mttrSeconds).toBe(30);
    expect(mttrFormatted).toBe('30s');
  });

  test('formats exactly 1 hour correctly', () => {
    const { mttrFormatted } = calculateMTTR(
      '2026-05-01T10:00:00Z',
      '2026-05-01T11:00:00Z'
    );
    expect(mttrFormatted).toBe('1h');
  });

  test('formats 2 hours 5 minutes 10 seconds correctly', () => {
    const { mttrFormatted } = calculateMTTR(
      '2026-05-01T10:00:00Z',
      '2026-05-01T12:05:10Z'
    );
    expect(mttrFormatted).toBe('2h 5m 10s');
  });

  test('throws when end is before start', () => {
    expect(() => calculateMTTR(
      '2026-05-01T12:00:00Z',
      '2026-05-01T10:00:00Z'
    )).toThrow('End time cannot be before start time');
  });

  test('returns zero seconds when start equals end', () => {
    const { mttrSeconds } = calculateMTTR(
      '2026-05-01T10:00:00Z',
      '2026-05-01T10:00:00Z'
    );
    expect(mttrSeconds).toBe(0);
  });

});

// ════════════════════════════════════════════════
//  4. ALERT STRATEGY TESTS
// ════════════════════════════════════════════════
describe('Alert Strategy — Priority Assignment', () => {

  test('RDBMS component gets P0 severity', () => {
    const strategy = getAlertStrategy('RDBMS_PRIMARY');
    expect(strategy.getSeverity()).toBe('P0');
  });

  test('POSTGRES component gets P0 severity', () => {
    const strategy = getAlertStrategy('POSTGRES_REPLICA_01');
    expect(strategy.getSeverity()).toBe('P0');
  });

  test('API_GATEWAY component gets P1 severity', () => {
    const strategy = getAlertStrategy('API_GATEWAY');
    expect(strategy.getSeverity()).toBe('P1');
  });

  test('MCP host gets P1 severity', () => {
    const strategy = getAlertStrategy('MCP_HOST_01');
    expect(strategy.getSeverity()).toBe('P1');
  });

  test('CACHE component gets P2 severity', () => {
    const strategy = getAlertStrategy('CACHE_CLUSTER_01');
    expect(strategy.getSeverity()).toBe('P2');
  });

  test('REDIS component gets P2 severity', () => {
    const strategy = getAlertStrategy('REDIS_PRIMARY');
    expect(strategy.getSeverity()).toBe('P2');
  });

  test('QUEUE component gets P2 severity', () => {
    const strategy = getAlertStrategy('QUEUE_WORKER');
    expect(strategy.getSeverity()).toBe('P2');
  });

  test('unknown component gets P3 default severity', () => {
    const strategy = getAlertStrategy('RANDOM_SERVICE_XYZ');
    expect(strategy.getSeverity()).toBe('P3');
  });

  test('strategy is case-insensitive', () => {
    const strategy = getAlertStrategy('rdbms_secondary');
    expect(strategy.getSeverity()).toBe('P0');
  });

  test('each strategy returns an alert type string', () => {
    const strategy = getAlertStrategy('RDBMS_PRIMARY');
    expect(typeof strategy.getAlertType()).toBe('string');
    expect(strategy.getAlertType().length).toBeGreaterThan(0);
  });

});