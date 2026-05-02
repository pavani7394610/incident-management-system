// --- State Pattern for Incident Lifecycle ---
// Each state class controls what transitions are allowed from it

class OpenState {
  constructor(workItem) {
    this.workItem = workItem;
    this.name = 'OPEN';
  }

  // From OPEN you can only go to INVESTIGATING
  async transitionTo(newStatus, context = {}) {
    if (newStatus === 'INVESTIGATING') {
      return { allowed: true, nextStatus: 'INVESTIGATING' };
    }
    // Block anything else
    return {
      allowed: false,
      reason: `Cannot move from OPEN to ${newStatus}. Must go to INVESTIGATING first.`
    };
  }

  getAvailableTransitions() {
    return ['INVESTIGATING'];
  }
}

class InvestigatingState {
  constructor(workItem) {
    this.workItem = workItem;
    this.name = 'INVESTIGATING';
  }

  // From INVESTIGATING you can go to RESOLVED
  async transitionTo(newStatus, context = {}) {
    if (newStatus === 'RESOLVED') {
      return { allowed: true, nextStatus: 'RESOLVED' };
    }
    // Allow going back to OPEN if investigation reveals it's not fixed
    if (newStatus === 'OPEN') {
      return { allowed: true, nextStatus: 'OPEN' };
    }
    return {
      allowed: false,
      reason: `Cannot move from INVESTIGATING to ${newStatus}.`
    };
  }

  getAvailableTransitions() {
    return ['RESOLVED', 'OPEN'];
  }
}

class ResolvedState {
  constructor(workItem) {
    this.workItem = workItem;
    this.name = 'RESOLVED';
  }

  // From RESOLVED you can only go to CLOSED — but ONLY with a complete RCA
  async transitionTo(newStatus, context = {}) {
    if (newStatus === 'CLOSED') {

      // --- RCA Validation (assignment requirement) ---
      // Reject closure if RCA is missing or incomplete
      const { rca } = context;

      if (!rca) {
        return {
          allowed: false,
          reason: 'Cannot close incident. RCA is required before closing.',
          code: 'RCA_MISSING'
        };
      }

      // Check every required RCA field
      const missingFields = [];

      if (!rca.rootCauseCategory || rca.rootCauseCategory.trim() === '') {
        missingFields.push('rootCauseCategory');
      }
      if (!rca.fixApplied || rca.fixApplied.trim() === '') {
        missingFields.push('fixApplied');
      }
      if (!rca.preventionSteps || rca.preventionSteps.trim() === '') {
        missingFields.push('preventionSteps');
      }
      if (!rca.incidentStart) {
        missingFields.push('incidentStart');
      }
      if (!rca.incidentEnd) {
        missingFields.push('incidentEnd');
      }

      // If any field is missing — reject
      if (missingFields.length > 0) {
        return {
          allowed: false,
          reason: `Cannot close. Incomplete RCA. Missing fields: ${missingFields.join(', ')}`,
          code: 'RCA_INCOMPLETE',
          missingFields,
        };
      }

      // Validate dates make sense
      const start = new Date(rca.incidentStart);
      const end   = new Date(rca.incidentEnd);

      if (end <= start) {
        return {
          allowed: false,
          reason: 'Incident end time must be after start time.',
          code: 'RCA_INVALID_DATES'
        };
      }

      // All checks passed — allow closure
      return { allowed: true, nextStatus: 'CLOSED' };
    }

    // Allow going back to INVESTIGATING if issue recurs
    if (newStatus === 'INVESTIGATING') {
      return { allowed: true, nextStatus: 'INVESTIGATING' };
    }

    return {
      allowed: false,
      reason: `Cannot move from RESOLVED to ${newStatus}.`
    };
  }

  getAvailableTransitions() {
    return ['CLOSED', 'INVESTIGATING'];
  }
}

class ClosedState {
  constructor(workItem) {
    this.workItem = workItem;
    this.name = 'CLOSED';
  }

  // Terminal state — no transitions allowed from CLOSED
  async transitionTo(newStatus, context = {}) {
    return {
      allowed: false,
      reason: 'Incident is CLOSED. No further transitions allowed.',
      code: 'ALREADY_CLOSED'
    };
  }

  getAvailableTransitions() {
    return [];
  }
}

// --- State Factory ---
// Given a status string, return the right state object
const getState = (workItem) => {
  const status = workItem.status || 'OPEN';

  switch (status) {
    case 'OPEN':          return new OpenState(workItem);
    case 'INVESTIGATING': return new InvestigatingState(workItem);
    case 'RESOLVED':      return new ResolvedState(workItem);
    case 'CLOSED':        return new ClosedState(workItem);
    default:
      throw new Error(`Unknown status: ${status}`);
  }
};

module.exports = { getState };