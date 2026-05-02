import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboard, getAllWorkItems } from '../api';
import { formatDistanceToNow } from 'date-fns';

const LiveFeed = () => {
  const [incidents, setIncidents] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [filter,    setFilter]    = useState('ALL');
  const navigate = useNavigate();

  // Fetch incidents from backend
  const fetchIncidents = useCallback(async () => {
    try {
      // Try dashboard (Redis cache) first
      const res = await getAllWorkItems();
      setIncidents(res.data.data || []);
      setError('');
    } catch (err) {
      setError('Failed to load incidents. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh every 5 seconds (live feed)
  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 5000);
    return () => clearInterval(interval);
  }, [fetchIncidents]);

  // Filter by status
  const filtered = filter === 'ALL'
    ? incidents
    : incidents.filter(i => i.status === filter);

  // Count by severity for the summary row
  const counts = {
    P0: incidents.filter(i => i.severity === 'P0').length,
    P1: incidents.filter(i => i.severity === 'P1').length,
    P2: incidents.filter(i => i.severity === 'P2').length,
  };

  if (loading) return (
    <div className="page" style={{ textAlign: 'center', paddingTop: 80 }}>
      <p style={{ color: '#a0aec0' }}>Loading incidents...</p>
    </div>
  );

  return (
    <div className="page">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>
            Live Incident Feed
          </h1>
          <p style={{ color: '#a0aec0', fontSize: 13 }}>
            Auto-refreshes every 5 seconds
          </p>
        </div>
        <button className="btn btn-primary" onClick={fetchIncidents}>
          Refresh
        </button>
      </div>

      {/* Severity summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 12, marginBottom: 24 }}>
        {[
          { label: 'P0 Critical', count: counts.P0, color: '#fc8181', bg: '#742a2a' },
          { label: 'P1 High',     count: counts.P1, color: '#f6ad55', bg: '#7b341e' },
          { label: 'P2 Medium',   count: counts.P2, color: '#68d391', bg: '#1c4532' },
        ].map(({ label, count, color, bg }) => (
          <div key={label} style={{ background: bg, border: `1px solid ${color}33`,
              borderRadius: 12, padding: '16px 20px' }}>
            <p style={{ color, fontSize: 28, fontWeight: 700 }}>{count}</p>
            <p style={{ color, fontSize: 13, opacity: 0.8 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Error message */}
      {error && <div className="error-msg">{error}</div>}

      {/* Filter buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['ALL', 'OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED'].map(s => (
          <button
            key={s}
            className="btn btn-ghost"
            onClick={() => setFilter(s)}
            style={filter === s ? { background: '#4c6ef5', color: '#fff' } : {}}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Incidents list */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ color: '#a0aec0', fontSize: 15 }}>
            {filter === 'ALL'
              ? 'No incidents yet. Use Simulate Signal to create one.'
              : `No incidents with status: ${filter}`}
          </p>
        </div>
      ) : (
        filtered.map(incident => (
          <div
            key={incident.id}
            className="card"
            onClick={() => navigate(`/incident/${incident.id}`)}
            style={{ cursor: 'pointer', transition: 'border-color 0.15s' }}
            onMouseEnter={e =>
              e.currentTarget.style.borderColor = '#4c6ef5'}
            onMouseLeave={e =>
              e.currentTarget.style.borderColor = '#2d3748'}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start',
                          justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>

              {/* Left: component + details */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center',
                              gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span className={`badge-${incident.severity}`}>
                    {incident.severity}
                  </span>
                  <span className={`status-${incident.status}`}>
                    {incident.status}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>
                    {incident.component_id || incident.componentId}
                  </span>
                </div>
                <p style={{ color: '#a0aec0', fontSize: 13 }}>
                  {incident.alert_type || incident.alertType}
                </p>
              </div>

              {/* Right: stats */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: 13, color: '#a0aec0' }}>
                  {incident.signal_count || 1} signal
                  {(incident.signal_count || 1) > 1 ? 's' : ''}
                </p>
                <p style={{ fontSize: 12, color: '#718096', marginTop: 4 }}>
                  {incident.created_at
                    ? formatDistanceToNow(new Date(incident.created_at),
                        { addSuffix: true })
                    : ''}
                </p>
              </div>

            </div>
          </div>
        ))
      )}

    </div>
  );
};

export default LiveFeed;