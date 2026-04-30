const { Pool } = require('pg');
require('dotenv').config();

// Pool = a group of reusable database connections
// Much faster than opening a new connection every time
const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  max: 20,           // max 20 connections in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test the connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('PostgreSQL connection error:', err.message);
  } else {
    console.log('✅ PostgreSQL connected');
    release();
  }
});

module.exports = pool;