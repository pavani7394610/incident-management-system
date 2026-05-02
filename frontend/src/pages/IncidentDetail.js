import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getWorkItemById, updateStatus, getRCA } from '../api';
import { formatDistanceToNow, format } from 'date-fns';
import RCAForm from '../components/RCAForm';

const IncidentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [incident,    setIncident]    = useState(null);
  const [rca,         setRca]         = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [actionError, setActionError] = useState('');
  const [showRCAForm, setShowRCAForm] = useState(false);
  const [updating,    setUpdating]    = useState(false);

  // Load incident + RCA
  const fetchData = async () => {
    try {
      const res = await getWorkItemById(id);
      setIncident(res.data.data);

      // If closed, also load the RCA
      if (res.data.data.status === 'CLOSED') {
        try {
          const rcaRes = await getRCA(id);
          setRca(rcaRes.data.data);
        } catch { /* no RCA yet */ }
      }
    } catch (err) {
      setError('Could not load incident.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  // Handle status transition buttons
  const handleTransition = async (newStatus) => {
    setUpdating(true);
    setActionError('');
    try {
      await updateStatus(id, newStatus);
      await fetchData();
    } catch (err) {
      const msg = err.response?.data?.error || 'Transition failed';
      setActionError(msg);
    } finally {
      setUpdating(false);
    }
  };

  // Which buttons to show based on current status
  const getActions = (status) => {
    switch (status) {
      case 'OPEN':
        return [{ label: 'Start Investigating', status: 'INVESTIGATING',
                  cls: 'btn-warning' }];
      case 'INVESTIGATING':
        return [{ label: 'Mark Resolved', status: 'RESOLVED',
                  cls: 'btn-success' }];
      case 'RESOLVED':
        return [{ label: 'Submit RCA & Close', action: 'rca',
                  cls: 'btn-danger' }];
      default:
        return [];
    }
  };

  if (loading) return (
    <div className="page" style={{ textAlign: 'center', paddingTop: 80 }}>
      <p style={{ color: '#a0aec0' }}>Loading incident...</p>
    </div>
  );

  if (error) return (
    <div className="page">
      <div className="error-msg">{error}</div>
      <button className="btn btn-ghost" onClick={() => navigate('/')}>
        ← Back
      </button>
    </div>
  );

  if (!incident) return null;

  const actions = getActions(incident.status);

  return (
    <div className="page">

      {/* Back button */}
      <button className="btn btn-ghost" onClick={() => navigate('/')}
        style={{ marginBottom: 20 }}>
        ← Back to Feed
      </button>

      {/* Header card */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between',
                      flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 8,
                          flexWrap: 'wrap', alignItems: 'center' }}>
              <span className={`badge-${incident.severity}`}>
                {incident.severity}
              </span>
              <span className={`status-${incident.status}`}>
                {incident.status}
              </span>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
              {incident.component_id}
            </h2>
            <p style={{ color: '#a0aec0', fontSize: 14 }}>
              {incident.alert_type}
            </p>
          </div>

          {/* MTTR if closed */}
          {incident.mttr_seconds && (
            <div style={{ textAlign: 'right' }}>
              <p style={{ color: '#a0aec0', fontSize: 12 }}>MTTR</p>
              <p style={{ fontSize: 22, fontWeight: 600, color: '#68d391' }}>
                {Math.floor(incident.mttr_seconds / 60)}m{' '}
                {incident.mttr_seconds % 60}s
              </p>
            </div>
          )}
        </div>

        {/* Meta info */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                      gap: 12, marginTop: 8 }}>
          {[
            { label: 'Signals received',
              value: incident.signal_count || 1 },
            { label: 'Created',
              value: incident.created_at
                ? formatDistanceToNow(new Date(incident.created_at),
                    { addSuffix: true })
                : '—' },
            { label: 'Last updated',
              value: incident.updated_at
                ? formatDistanceToNow(new Date(incident.updated_at),
                    { addSuffix: true })
                : '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: '#0f1117', borderRadius: 8,
                                      padding: '12px 16px' }}>
              <p style={{ color: '#718096', fontSize: 12, marginBottom: 4 }}>
                {label}
              </p>
              <p style={{ fontWeight: 500, fontSize: 15 }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      {actions.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {actionError && <div className="error-msg">{actionError}</div>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {actions.map(action => (
              <button
                key={action.label}
                className={`btn ${action.cls}`}
                disabled={updating}
                onClick={() =>
                  action.action === 'rca'
                    ? setShowRCAForm(true)
                    : handleTransition(action.status)
                }
              >
                {updating ? 'Updating...' : action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* RCA Form (slides in when Submit RCA clicked) */}
      {showRCAForm && (
        <RCAForm
          workItemId={id}
          incident={incident}
          onSuccess={() => { setShowRCAForm(false); fetchData(); }}
          onCancel={() => setShowRCAForm(false)}
        />
      )}

      {/* RCA record (shown after closure) */}
      {rca && (
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
            Root Cause Analysis
          </h3>
          {[
            { label: 'Root cause category', value: rca.root_cause_category },
            { label: 'Fix applied',         value: rca.fix_applied         },
            { label: 'Prevention steps',    value: rca.prevention_steps    },
            { label: 'Incident start',
              value: rca.incident_start
                ? format(new Date(rca.incident_start), 'PPpp')
                : '—' },
            { label: 'Incident end',
              value: rca.incident_end
                ? format(new Date(rca.incident_end), 'PPpp')
                : '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 12, color: '#718096', marginBottom: 4 }}>
                {label}
              </p>
              <p style={{ fontSize: 14 }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Raw signals from MongoDB */}
      <div className="card">
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
          Raw Signals ({incident.signals?.length || 0})
        </h3>
        {!incident.signals || incident.signals.length === 0 ? (
          <p style={{ color: '#718096', fontSize: 14 }}>No signals yet.</p>
        ) : (
          incident.signals.map((sig, i) => (
            <div key={sig._id || i} style={{
              background: '#0f1117', borderRadius: 8,
              padding: '12px 16px', marginBottom: 10,
              borderLeft: `3px solid ${
                sig.severity === 'P0' ? '#fc8181'
                : sig.severity === 'P1' ? '#f6ad55'
                : sig.severity === 'P2' ? '#68d391'
                : '#90cdf4'}`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between',
                            flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span className={`badge-${sig.severity}`}>{sig.severity}</span>
                  <span style={{ fontSize: 13, color: '#a0aec0' }}>{sig.type}</span>
                </div>
                <span style={{ fontSize: 12, color: '#718096' }}>
                  {sig.receivedAt
                    ? formatDistanceToNow(new Date(sig.receivedAt),
                        { addSuffix: true })
                    : ''}
                </span>
              </div>
              {sig.payload && Object.keys(sig.payload).length > 0 && (
                <pre style={{ fontSize: 12, color: '#a0aec0',
                              overflowX: 'auto', margin: 0 }}>
                  {JSON.stringify(sig.payload, null, 2)}
                </pre>
              )}
            </div>
          ))
        )}
      </div>

    </div>
  );
};

export default IncidentDetail;