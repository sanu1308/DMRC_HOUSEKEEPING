const pool = require('./config/db');

if (process.env.NODE_ENV === 'production') {
  console.error('Machinery seed script is disabled in production. Populate data via the UI.');
  process.exit(1);
}

const SAMPLE_MACHINES = [
  {
    machinery_name: 'Ride-on Scrubber',
    machine_type: 'Scrubber',
    quantity_total: 4,
    quantity_in_use: 3,
    quantity_faulty: 1,
    quantity_maintenance: 0,
    number_of_days: 30,
  },
  {
    machinery_name: 'Single Disc Machine',
    machine_type: 'Polisher',
    quantity_total: 3,
    quantity_in_use: 2,
    quantity_faulty: 0,
    quantity_maintenance: 1,
    number_of_days: 30,
  },
  {
    machinery_name: 'High Pressure Jet',
    machine_type: 'Washer',
    quantity_total: 2,
    quantity_in_use: 2,
    quantity_faulty: 0,
    quantity_maintenance: 0,
    number_of_days: 30,
  },
];

const USAGE_TEMPLATES = [
  {
    machine_name: 'Ride-on Scrubber',
    machine_type: 'Scrubber',
    area_used: 'Concourse',
    usage_hours: 3.5,
    manpower_used: 4,
    status: 'operational',
    shift: 'Day',
    notes: 'Deep clean of concourse and ticketing area',
  },
  {
    machine_name: 'Single Disc Machine',
    machine_type: 'Polisher',
    area_used: 'Platform',
    usage_hours: 2,
    manpower_used: 3,
    status: 'working',
    shift: 'Night',
    notes: 'Edge polishing and platform shine',
  },
  {
    machine_name: 'High Pressure Jet',
    machine_type: 'Washer',
    area_used: 'Entrance Plaza',
    usage_hours: 1.5,
    manpower_used: 2,
    status: 'maintenance',
    shift: 'Evening',
    notes: 'Nozzle tune-up and hose inspection',
  },
  {
    machine_name: 'Single Disc Machine',
    machine_type: 'Polisher',
    area_used: 'Parking Link',
    usage_hours: 2.5,
    manpower_used: 3,
    status: 'breakdown',
    shift: 'Day',
    notes: 'Motor overheated mid-shift',
  },
];

async function seedMachinery() {
  const connection = await pool.getConnection();

  try {
    const [stations] = await connection.query('SELECT id, station_name FROM stations');
    if (!stations.length) {
      throw new Error('No stations found. Seed stations before running this script.');
    }

    const [[superAdmin]] = await connection.query(
      "SELECT id FROM users WHERE role = 'superadmin' ORDER BY id ASC LIMIT 1",
    );
    if (!superAdmin) {
      throw new Error('Super admin user not found.');
    }

    const [stationUsers] = await connection.query(
      "SELECT id, station_id FROM users WHERE role = 'user' AND station_id IS NOT NULL",
    );
    const userByStation = new Map(stationUsers.map((row) => [row.station_id, row.id]));

    for (const station of stations) {
      const [[machineryCount]] = await connection.query(
        'SELECT COUNT(*) as count FROM machinery WHERE station_id = ?',
        [station.id],
      );

      if (machineryCount.count === 0) {
        console.log(`Creating machinery inventory for ${station.station_name}`);
        for (const machine of SAMPLE_MACHINES) {
          await connection.query(
            `INSERT INTO machinery (
              machinery_name,
              machine_type,
              quantity_total,
              quantity_in_use,
              quantity_faulty,
              quantity_maintenance,
              number_of_days,
              station_id,
              created_by,
              updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              machine.machinery_name,
              machine.machine_type,
              machine.quantity_total,
              machine.quantity_in_use,
              machine.quantity_faulty,
              machine.quantity_maintenance,
              machine.number_of_days,
              station.id,
              superAdmin.id,
              superAdmin.id,
            ],
          );
        }
      }

      const [[usageCount]] = await connection.query(
        'SELECT COUNT(*) as count FROM machinery_usage WHERE station_id = ?',
        [station.id],
      );

      if (usageCount.count === 0) {
        console.log(`Creating machinery usage ledger for ${station.station_name}`);
        for (let index = 0; index < USAGE_TEMPLATES.length; index += 1) {
          const template = USAGE_TEMPLATES[index];
          const usageDate = new Date(Date.now() - index * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];
          const operatorId = userByStation.get(station.id) || superAdmin.id;

          await connection.query(
            `INSERT INTO machinery_usage (
              station_id,
              user_id,
              shift_id,
              machine_name,
              machine_type,
              area_used,
              usage_hours,
              manpower_used,
              status,
              usage_date,
              shift,
              notes
            ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              station.id,
              operatorId,
              template.machine_name,
              template.machine_type,
              template.area_used,
              template.usage_hours,
              template.manpower_used,
              template.status,
              usageDate,
              template.shift,
              template.notes,
            ],
          );
        }
      }
    }

    console.log('Machinery data seed completed successfully.');
  } catch (error) {
    console.error('Machinery seed failed:', error.message);
  } finally {
    connection.release();
    process.exit(0);
  }
}

seedMachinery().catch((err) => {
  console.error('Unexpected machinery seed error:', err);
  process.exit(1);
});
