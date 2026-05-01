// --- Strategy Pattern for Alerting ---
// Each component type has its own alert strategy
// You can add new ones without changing existing code

// P0 = Critical (database down = everything breaks)
class RDBMSAlertStrategy {
  getAlertType()  { return 'CRITICAL_DB_FAILURE'; }
  getSeverity()   { return 'P0'; }
  getAction()     { return 'Page on-call engineer immediately'; }
}

// P1 = High (API gateway affects all users)
class APIGatewayAlertStrategy {
  getAlertType()  { return 'API_GATEWAY_FAILURE'; }
  getSeverity()   { return 'P1'; }
  getAction()     { return 'Alert team lead within 5 minutes'; }
}

// P2 = Medium (cache failure degrades but doesn't stop service)
class CacheAlertStrategy {
  getAlertType()  { return 'CACHE_DEGRADATION'; }
  getSeverity()   { return 'P2'; }
  getAction()     { return 'Create ticket, fix within 1 hour'; }
}

// P2 = Medium (queue backup causes delays)
class QueueAlertStrategy {
  getAlertType()  { return 'QUEUE_BACKUP'; }
  getSeverity()   { return 'P2'; }
  getAction()     { return 'Monitor and scale consumers'; }
}

// P3 = Low (default for unknown components)
class DefaultAlertStrategy {
  getAlertType()  { return 'GENERIC_FAILURE'; }
  getSeverity()   { return 'P3'; }
  getAction()     { return 'Log and monitor'; }
}

// --- The Strategy Selector ---
// Looks at the componentId and picks the right strategy
const getAlertStrategy = (componentId = '') => {
  const id = componentId.toUpperCase();

  if (id.includes('RDBMS') || id.includes('POSTGRES') || id.includes('MYSQL')) {
    return new RDBMSAlertStrategy();
  }
  if (id.includes('API') || id.includes('GATEWAY') || id.includes('MCP')) {
    return new APIGatewayAlertStrategy();
  }
  if (id.includes('CACHE') || id.includes('REDIS')) {
    return new CacheAlertStrategy();
  }
  if (id.includes('QUEUE') || id.includes('KAFKA') || id.includes('RABBIT')) {
    return new QueueAlertStrategy();
  }

  return new DefaultAlertStrategy();
};

module.exports = { getAlertStrategy };