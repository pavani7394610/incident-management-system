import axios from 'axios';

// All API calls go through this base URL
const api = axios.create({
  baseURL: 'http://localhost:3001',
  timeout: 10000,
});

// --- Signal API ---
export const sendSignal = (data) =>
  api.post('/api/signals', data);

// --- Work Item API ---
export const getAllWorkItems = () =>
  api.get('/api/workitems');

export const getDashboard = () =>
  api.get('/api/workitems/dashboard');

export const getWorkItemById = (id) =>
  api.get(`/api/workitems/${id}`);

export const updateStatus = (id, status) =>
  api.patch(`/api/workitems/${id}/status`, { status });

export const submitRCA = (id, rcaData) =>
  api.post(`/api/workitems/${id}/rca`, rcaData);

export const getRCA = (id) =>
  api.get(`/api/workitems/${id}/rca`);

export const getHealth = () =>
  api.get('/health');