import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar          from './components/Navbar';
import LiveFeed        from './pages/LiveFeed';
import IncidentDetail  from './pages/IncidentDetail';
import Simulate        from './pages/Simulate';
import { getHealth }   from './api';

const App = () => {
  const [health, setHealth] = useState('checking');

  // Poll /health every 30 seconds
  useEffect(() => {
    const check = async () => {
      try {
        const res = await getHealth();
        setHealth(res.data.status);
      } catch {
        setHealth('error');
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <BrowserRouter>
      <Navbar health={health} />
      <Routes>
        <Route path="/"               element={<LiveFeed />} />
        <Route path="/incident/:id"   element={<IncidentDetail />} />
        <Route path="/simulate"       element={<Simulate />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;