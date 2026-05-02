import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navbar = ({ health }) => {
  const location = useLocation();

  const isActive = (path) =>
    location.pathname === path
      ? { borderBottom: '2px solid #4c6ef5', color: '#fff' }
      : { color: '#a0aec0' };

  return (
    <nav style={{
      background: '#1a1f2e',
      borderBottom: '1px solid #2d3748',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      height: 56,
      gap: 32,
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      {/* Logo */}
      <span style={{ fontWeight: 700, fontSize: 16, color: '#fff', marginRight: 16 }}>
        🚨 IMS
      </span>

      {/* Nav links */}
      <Link to="/" style={{ textDecoration: 'none', fontSize: 14,
        paddingBottom: 2, ...isActive('/') }}>
        Live Feed
      </Link>
      <Link to="/simulate" style={{ textDecoration: 'none', fontSize: 14,
        paddingBottom: 2, ...isActive('/simulate') }}>
        Simulate Signal
      </Link>

      {/* Health indicator — right side */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: health === 'ok' ? '#68d391' : '#fc8181',
        }} />
        <span style={{ fontSize: 12, color: '#a0aec0' }}>
          {health === 'ok' ? 'System healthy' : 'Checking...'}
        </span>
      </div>
    </nav>
  );
};

export default Navbar;