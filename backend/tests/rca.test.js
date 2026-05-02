const { getState } = require('../src/services/workItemStateMachine');

// --- Unit Tests: RCA Validation ---
// Tests that the state machine correctly enforces RCA rules

describe('RCA Validation — ResolvedState', () => {

  // Build a fake RESOLVED work item for testing
  const resolvedWorkItem = { id: 'test-123', status: 'RESOLVED' };

  test('rejects closure with no RCA at all', async () => {
    const state  = getState(resolvedWorkItem);
    const result = await state.transitionTo('CLOSED', {});
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('RCA_MISSING');
  });

  test('rejects closure when rootCauseCategory is missing', async () => {
    const state  = getState(resolvedWorkItem);
    const result = await state.transitionTo('CLOSED', {
      rca: {
        rootCauseCategory: '',          // empty!
        fixApplied:        'Restarted DB',
        preventionSteps:   'Add monitoring',
        incidentStart:     '2026-05-01T10:00:00Z',
        incidentEnd:       '2026-05-01T11:00:00Z',
      }
    });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('RCA_INCOMPLETE');
    expect(result.missingFields).toContain('rootCauseCategory');
  });

  test('rejects closure when fixApplied is missing', async () => {
    const state  = getState(resolvedWorkItem);
    const result = await state.transitionTo('CLOSED', {
      rca: {
        rootCauseCategory: 'Infrastructure',
        fixApplied:        '',           // empty!
        preventionSteps:   'Add monitoring',
        incidentStart:     '2026-05-01T10:00:00Z',
        incidentEnd:       '2026-05-01T11:00:00Z',
      }
    });
    expect(result.allowed).toBe(false);
    expect(result.missingFields).toContain('fixApplied');
  });

  test('rejects closure when end time is before start time', async () => {
    const state  = getState(resolvedWorkItem);
    const result = await state.transitionTo('CLOSED', {
      rca: {
        rootCauseCategory: 'Infrastructure',
        fixApplied:        'Restarted DB',
        preventionSteps:   'Add monitoring',
        incidentStart:     '2026-05-01T12:00:00Z',
        incidentEnd:       '2026-05-01T10:00:00Z',  // BEFORE start!
      }
    });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('RCA_INVALID_DATES');
  });

  test('allows closure with complete, valid RCA', async () => {
    const state  = getState(resolvedWorkItem);
    const result = await state.transitionTo('CLOSED', {
      rca: {
        rootCauseCategory: 'Infrastructure',
        fixApplied:        'Restarted database, increased connection pool',
        preventionSteps:   'Add connection pool monitoring and auto-scaling',
        incidentStart:     '2026-05-01T10:00:00Z',
        incidentEnd:       '2026-05-01T11:30:00Z',
      }
    });
    expect(result.allowed).toBe(true);
    expect(result.nextStatus).toBe('CLOSED');
  });

});

describe('State Machine — transition rules', () => {

  test('OPEN cannot jump directly to CLOSED', async () => {
    const state  = getState({ status: 'OPEN' });
    const result = await state.transitionTo('CLOSED', {});
    expect(result.allowed).toBe(false);
  });

  test('OPEN can go to INVESTIGATING', async () => {
    const state  = getState({ status: 'OPEN' });
    const result = await state.transitionTo('INVESTIGATING', {});
    expect(result.allowed).toBe(true);
  });

  test('CLOSED cannot go anywhere', async () => {
    const state  = getState({ status: 'CLOSED' });
    const result = await state.transitionTo('OPEN', {});
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('ALREADY_CLOSED');
  });

  test('INVESTIGATING can go back to OPEN', async () => {
    const state  = getState({ status: 'INVESTIGATING' });
    const result = await state.transitionTo('OPEN', {});
    expect(result.allowed).toBe(true);
  });

});

describe('MTTR Calculation', () => {
  const { calculateMTTR } = require('../src/services/mttrService');

  test('calculates correct MTTR in seconds', () => {
    const result = calculateMTTR(
      '2026-05-01T10:00:00Z',
      '2026-05-01T11:30:00Z'
    );
    expect(result.mttrSeconds).toBe(5400); // 90 minutes = 5400 seconds
  });

  test('formats duration correctly', () => {
    const result = calculateMTTR(
      '2026-05-01T10:00:00Z',
      '2026-05-01T11:30:00Z'
    );
    expect(result.mttrFormatted).toBe('1h 30m');
  });

  test('throws error if end is before start', () => {
    expect(() => calculateMTTR(
      '2026-05-01T11:00:00Z',
      '2026-05-01T10:00:00Z'
    )).toThrow();
  });

});