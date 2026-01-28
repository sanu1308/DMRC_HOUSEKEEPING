const mysql = require('mysql2/promise');
require('dotenv').config();

// Create connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dmrc_housekeeping',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true, // ensure DATE/TIMESTAMP values stay as plain strings to avoid timezone shifts
});

module.exports = pool;
