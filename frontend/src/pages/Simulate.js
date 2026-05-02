import React, { useState } from 'react';
import { sendSignal } from '../api';

const COMPONENTS = [
  'RDBMS_PRIMARY', 'CACHE_CLUSTER_01', 'API_GATEWAY',
  'MCP_HOST_01', 'QUEUE_WORKER', 'NOSQL_CLUSTER',
];

const Simulate = () => {
  const [form, setForm] = useState({
    componentId: 'RDBMS_PRIMARY',
    type:        'ERROR',
    severity:    'P0',
    payload:     '{"message": "Connection pool exhausted", "host": "db-01"}',
  });

  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);

  const update = (field, value) =>
    setForm(prev => ({ ...prev, [field]: value }));

  // Send one signal
  const handleSend = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      let payload = {};
      try { payload = JSON.parse(form.payload); } catch { payload = {}; }

      const res = await sendSignal({ ...form, payload });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send signal');
    } finally {
      setLoading(false);
    }
  };

  // Send 100 signals to trigger debounce (assignment demo)
  const handleBurstTest = async () => {
    setBulkSending(true);
    setError('');
    setResult(null);
    try {
      const promises = Array.from({ length: 100 }, () =>
        sendSignal({
          componentId: form.componentId,
          type:        'ERROR',
          severity:    form.severity,
          payload:     { message: 'Burst test signal', burst: true },
        })
      );
      await Promise.all(promises);
      setResult({
        message: '100 signals sent! Check your backend console — should create only 1 Work Item.'
      });
    } catch (err) {
      setError('Burst test failed: ' + (err.message || ''));
    } finally {
      setBulkSending(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 640 }}>

      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>
        Simulate Signal
      </h1>
      <p style={{ color: '#a0aec0', fontSize: 13, marginBottom: 24 }}>
        Send test signals to create incidents on the dashboard.
      </p>

      <div className="card">

        {/* Component */}
        <label>Component ID</label>
        <select value={form.componentId}
          onChange={e => update('componentId', e.target.value)}>
          {COMPONENTS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Type + Severity side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label>Signal type</label>
            <select value={form.type}
              onChange={e => update('type', e.target.value)}>
              {['ERROR','LATENCY_SPIKE','TIMEOUT','CRASH','DEGRADED']
                .map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label>Severity</label>
            <select value={form.severity}
              onChange={e => update('severity', e.target.value)}>
              {['P0','P1','P2','P3']
                .map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Payload */}
        <label>Payload (JSON)</label>
        <textarea
          rows={4}
          value={form.payload}
          onChange={e => update('payload', e.target.value)}
          style={{ fontFamily: 'monospace', fontSize: 13 }}
        />

        {/* Messages */}
        {error  && <div className="error-msg"   style={{ marginTop: 14 }}>{error}</div>}
        {result && (
          <div className="success-msg" style={{ marginTop: 14 }}>
            {result.message || 'Signal sent successfully!'}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" style={{ flex: 1 }}
            onClick={handleSend} disabled={loading}>
            {loading ? 'Sending...' : 'Send Signal'}
          </button>
          <button className="btn btn-warning" style={{ flex: 1 }}
            onClick={handleBurstTest} disabled={bulkSending}>
            {bulkSending ? 'Sending 100...' : '🔥 Burst Test (100 signals)'}
          </button>
        </div>

        <p style={{ fontSize: 12, color: '#718096', marginTop: 12, lineHeight: 1.6 }}>
          Burst Test sends 100 signals for the same component. Your debounce logic
          should create only 1 Work Item and link all 100 signals to it.
        </p>
      </div>
    </div>
  );
};

export default Simulate;