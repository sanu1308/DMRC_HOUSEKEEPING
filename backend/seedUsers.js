
const bcrypt = require('bcryptjs');
const pool = require('./config/db');

// Pre-generated bcrypt hashes for known passwords
// Admin password: Admin@123
// User password:  User@123
const ADMIN_HASH = '$2a$10$5qQnu8pWrAXSta6EETl6FeJrGWl9YzdmHlmNbrZTxfPhlyoHBp7UC';
const USER_HASH = '$2a$10$f4PE0NK7N0lSd8W6TeWbaO8pD76FCv0uCJEUXi.YUaNexqNrW2f0.';

const STATION_ACCOUNTS = [
  {
    stationCode: 'KG-004',
    name: 'Kashmiri Gate Supervisor',
    email: 'kashmirigate.ops@dmrc.gov.in',
  },
  {
    stationCode: 'D-005',
    name: 'Dwarka Supervisor',
    email: 'dwarka.ops@dmrc.gov.in',
  },
  {
    stationCode: 'RC-001',
    name: 'Rajiv Chowk Supervisor',
    email: 'rajivchowk.ops@dmrc.gov.in',
  },
  {
    stationCode: 'CS-002',
    name: 'Central Secretariat Supervisor',
    email: 'cs.ops@dmrc.gov.in',
  },
  {
    stationCode: 'PN-003',
    name: 'Patel Nagar Supervisor',
    email: 'patelnagar.ops@dmrc.gov.in',
  },
];

async function seedUsers() {
  const connection = await pool.getConnection();

  try {
    console.log('Seeding default users...');

    // Ensure super admin user exists
    await connection.query(
      `INSERT INTO users (name, email, password, role, station_id)
       VALUES ('Super Admin', 'admin@dmrc.gov.in', ?, 'superadmin', NULL)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         password = VALUES(password),
         role = VALUES(role),
         station_id = VALUES(station_id)`,
      [ADMIN_HASH],
    );

    // Map station codes to ids
    const stationCodes = STATION_ACCOUNTS.map((account) => account.stationCode);
    const [stations] = await connection.query(
      `SELECT id, station_code FROM stations WHERE station_code IN (${stationCodes.map(() => '?').join(',')})`,
      stationCodes,
    );

    const stationMap = new Map(stations.map((station) => [station.station_code, station.id]));

    for (const account of STATION_ACCOUNTS) {
      const stationId = stationMap.get(account.stationCode);
      if (!stationId) {
        console.warn(`Skipping user ${account.email} because station ${account.stationCode} was not found.`);
        continue;
      }

      await connection.query(
        `INSERT INTO users (name, email, password, role, station_id)
         VALUES (?, ?, ?, 'user', ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           password = VALUES(password),
           role = VALUES(role),
           station_id = VALUES(station_id)`,
        [account.name, account.email, USER_HASH, stationId],
      );
    }

    console.log('Seed completed. You can now log in with:');
    console.log('Super Admin -> email: admin@dmrc.gov.in  password: Admin@123');
    STATION_ACCOUNTS.forEach((account) => {
      console.log(`${account.stationCode} -> email: ${account.email}  password: User@123`);
    });
  } catch (err) {
    console.error('Error seeding users:', err);
  } finally {
    connection.release();
    process.exit(0);
  }
}

seedUsers().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
