import React, { useState } from 'react';
import { submitRCA } from '../api';

const ROOT_CAUSE_CATEGORIES = [
  'Infrastructure',
  'Network',
  'Application Bug',
  'Configuration Error',
  'Database',
  'Third-party Service',
  'Human Error',
  'Capacity / Scaling',
  'Security Incident',
  'Unknown',
];

const RCAForm = ({ workItemId, incident, onSuccess, onCancel }) => {
  const [form, setForm] = useState({
    rootCauseCategory: '',
    fixApplied:        '',
    preventionSteps:   '',
    incidentStart:     '',
    incidentEnd:       '',
  });

  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const update = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user types
    setFieldErrors(prev => ({ ...prev, [field]: false }));
  };

  // Client-side validation before submitting
  const validate = () => {
    const errors = {};
    if (!form.rootCauseCategory) errors.rootCauseCategory = true;
    if (!form.fixApplied.trim()) errors.fixApplied         = true;
    if (!form.preventionSteps.trim()) errors.preventionSteps = true;
    if (!form.incidentStart)  errors.incidentStart          = true;
    if (!form.incidentEnd)    errors.incidentEnd             = true;

    if (form.incidentStart && form.incidentEnd) {
      if (new Date(form.incidentEnd) <= new Date(form.incidentStart)) {
        errors.incidentEnd = true;
        setError('Incident end time must be after start time.');
        setFieldErrors(errors);
        return false;
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    setError('');
    if (!validate()) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    try {
      await submitRCA(workItemId, form);
      onSuccess();
    } catch (err) {
      const msg = err.response?.data?.error
        || err.response?.data?.message
        || 'Failed to submit RCA. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field) => ({
    borderColor: fieldErrors[field] ? '#fc8181' : undefined
  });

  return (
    <div className="card" style={{ border: '1px solid #4c6ef5' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>
          Submit Root Cause Analysis
        </h3>
        <button className="btn btn-ghost"
          style={{ padding: '4px 12px', fontSize: 13 }}
          onClick={onCancel}>
          Cancel
        </button>
      </div>

      {/* Incident context */}
      <div style={{ background: '#0f1117', borderRadius: 8,
                    padding: '10px 16px', marginBottom: 4 }}>
        <p style={{ fontSize: 12, color: '#718096' }}>
          Closing incident for:{' '}
          <span style={{ color: '#e2e8f0' }}>
            {incident?.component_id} — {incident?.alert_type}
          </span>
        </p>
      </div>

      {error && <div className="error-msg" style={{ marginTop: 14 }}>{error}</div>}

      {/* Root cause category */}
      <label>Root cause category *</label>
      <select
        value={form.rootCauseCategory}
        onChange={e => update('rootCauseCategory', e.target.value)}
        style={inputStyle('rootCauseCategory')}
      >
        <option value="">Select a category...</option>
        {ROOT_CAUSE_CATEGORIES.map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {/* Fix applied */}
      <label>Fix applied *</label>
      <textarea
        rows={3}
        placeholder="Describe exactly what was done to fix the issue..."
        value={form.fixApplied}
        onChange={e => update('fixApplied', e.target.value)}
        style={inputStyle('fixApplied')}
      />

      {/* Prevention steps */}
      <label>Prevention steps *</label>
      <textarea
        rows={3}
        placeholder="What changes will prevent this from happening again?"
        value={form.preventionSteps}
        onChange={e => update('preventionSteps', e.target.value)}
        style={inputStyle('preventionSteps')}
      />

      {/* Date/time pickers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <label>Incident start time *</label>
          <input
            type="datetime-local"
            value={form.incidentStart}
            onChange={e => update('incidentStart', e.target.value)}
            style={inputStyle('incidentStart')}
          />
        </div>
        <div>
          <label>Incident end time *</label>
          <input
            type="datetime-local"
            value={form.incidentEnd}
            onChange={e => update('incidentEnd', e.target.value)}
            style={inputStyle('incidentEnd')}
          />
        </div>
      </div>

      {/* Submit */}
      <button
        className="btn btn-danger"
        style={{ marginTop: 24, width: '100%', padding: 12, fontSize: 15 }}
        onClick={handleSubmit}
        disabled={loading}
      >
        {loading ? 'Submitting RCA...' : 'Submit RCA & Close Incident'}
      </button>

    </div>
  );
};

export default RCAForm;