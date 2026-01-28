const pool = require('../config/db');
const {
  reserveSectionManpower,
  releaseSectionManpower,
  SECTION_TYPES,
  ManpowerValidationError,
} = require('../services/manpowerService');

const VALID_STATUS = ['Working', 'Operational', 'Maintenance', 'Breakdown'];
const VALID_SHIFT = ['Day', 'Evening', 'Night'];

const formatDateParts = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeDateValue = (value) => {
  if (!value) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.includes('T')) {
      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) {
        return formatDateParts(parsed);
      }
      return trimmed.split('T')[0];
    }
    if (trimmed.includes(' ')) {
      return trimmed.split(' ')[0];
    }
    return trimmed;
  }

  if (value instanceof Date) {
    return formatDateParts(value);
  }

  return value;
};

const isSuperAdmin = (req) => req.user?.role === 'superadmin';
const getAssignedStationId = (req) => (req.user?.station_id ? Number(req.user.station_id) : null);

// GET /api/machinery-usage
const getMachineryUsage = async (req, res) => {
  try {
    const { from, to, station_id } = req.query;
    const params = [];
    let query =
      'SELECT mu.id, mu.machine_type, mu.machine_name, mu.area_used, mu.usage_hours, mu.manpower_used, mu.status, mu.usage_date, mu.shift, mu.notes, mu.station_id, s.station_name ' +
      'FROM machinery_usage mu LEFT JOIN stations s ON mu.station_id = s.id WHERE 1=1';

    if (from) {
      query += ' AND usage_date >= ?';
      params.push(from);
    }

    if (to) {
      query += ' AND usage_date <= ?';
      params.push(to);
    }

    if (isSuperAdmin(req)) {
      if (station_id) {
        const stationFilter = Number(station_id);
        if (!Number.isInteger(stationFilter) || stationFilter <= 0) {
          return res.status(400).json({ success: false, message: 'station_id must be a positive integer.' });
        }
        query += ' AND mu.station_id = ?';
        params.push(stationFilter);
      }
    } else {
      const assignedStation = getAssignedStationId(req);
      if (!assignedStation) {
        return res.status(403).json({ success: false, message: 'Station assignment missing.' });
      }
      query += ' AND mu.station_id = ?';
      params.push(assignedStation);
    }

    query += ' ORDER BY mu.usage_date DESC, mu.created_at DESC';

    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(query, params);
      const normalized = rows.map((row) => ({
        ...row,
        usage_date: normalizeDateValue(row.usage_date),
      }));
      return res.status(200).json({ success: true, data: normalized });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get machinery usage error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Server error.' });
  }
};

// POST /api/machinery-usage
const createMachineryUsage = async (req, res) => {
  try {
    const {
      machine_type,
      machine_name,
      usage_hours,
      area_used,
      status,
      usage_date,
      shift,
      notes,
      station_id,
      manpower_used,
    } = req.body;

    if (
      !machine_type ||
      !machine_name ||
      !area_used ||
      usage_hours === undefined ||
      usage_hours === null ||
      !status ||
      !usage_date ||
      !shift ||
      manpower_used === undefined ||
      manpower_used === null
    ) {
      return res.status(400).json({
        success: false,
        message:
          'machine_type, machine_name, area_used, usage_hours, status, usage_date, shift and manpower_used are required.',
      });
    }

    const hoursNum = Number(usage_hours);
    if (Number.isNaN(hoursNum) || hoursNum < 0) {
      return res.status(400).json({
        success: false,
        message: 'usage_hours must be a non-negative number.',
      });
    }

    const manpowerUsed = Number(manpower_used);
    if (!Number.isInteger(manpowerUsed) || manpowerUsed <= 0) {
      return res.status(400).json({
        success: false,
        message: 'manpower_used must be a positive integer.',
      });
    }

    if (!VALID_STATUS.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value.',
      });
    }

    if (!VALID_SHIFT.includes(shift)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid shift value.',
      });
    }

    let stationIdNum;
    if (isSuperAdmin(req)) {
      if (!station_id) {
        return res.status(400).json({ success: false, message: 'station_id is required for this operation.' });
      }
      stationIdNum = Number(station_id);
    } else {
      stationIdNum = getAssignedStationId(req);
      if (!stationIdNum) {
        return res.status(403).json({ success: false, message: 'Station assignment missing.' });
      }
      if (station_id && Number(station_id) !== stationIdNum) {
        return res.status(403).json({ success: false, message: 'You can only submit records for your assigned station.' });
      }
    }

    if (!Number.isInteger(stationIdNum) || stationIdNum <= 0) {
      return res.status(400).json({ success: false, message: 'station_id must be a positive integer.' });
    }

    const userId = req.user?.id || null;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [stations] = await connection.query(
        'SELECT id, station_name FROM stations WHERE id = ?',
        [stationIdNum],
      );

      if (!stations.length) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: 'Station not found.',
        });
      }

      const [result] = await connection.query(
        'INSERT INTO machinery_usage (station_id, user_id, machine_type, machine_name, area_used, usage_hours, manpower_used, status, usage_date, shift, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          stationIdNum,
          userId,
          machine_type,
          machine_name,
          area_used,
          hoursNum,
          manpowerUsed,
          status,
          usage_date,
          shift,
          notes || null,
        ],
      );

      const manpowerTracking = await reserveSectionManpower(connection, {
        stationId: stationIdNum,
        section: SECTION_TYPES.MACHINERY,
        usageDate: usage_date,
        manpowerUsed,
        sourceType: SECTION_TYPES.MACHINERY,
        sourceRecordId: result.insertId,
        userId,
      });

      await connection.commit();

      return res.status(201).json({
        success: true,
        message: 'Machinery usage record created successfully.',
        data: {
          id: result.insertId,
          station_id: stationIdNum,
          station_name: stations[0].station_name,
          machine_type,
          machine_name,
          area_used,
          usage_hours: hoursNum,
          manpower_used: manpowerUsed,
          status,
          usage_date,
          shift,
          notes: notes || null,
        },
        meta: {
          manpowerTracking: manpowerTracking || { tracked: true },
        },
      });
    } catch (dbError) {
      await connection.rollback();
      throw dbError;
    } finally {
      connection.release();
    }
  } catch (error) {
    if (error instanceof ManpowerValidationError) {
      return res.status(error.statusCode || 400).json({ success: false, message: error.message });
    }
    console.error('Create machinery usage error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Server error.' });
  }
};

// DELETE /api/machinery-usage/:id
const deleteMachineryUsage = async (req, res) => {
  try {
    const { id } = req.params;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [records] = await connection.query('SELECT station_id FROM machinery_usage WHERE id = ?', [id]);
      if (!records.length) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'Machinery usage record not found.' });
      }

      if (!isSuperAdmin(req)) {
        const assignedStation = getAssignedStationId(req);
        if (!assignedStation || assignedStation !== records[0].station_id) {
          await connection.rollback();
          return res.status(403).json({ success: false, message: 'You cannot delete records for another station.' });
        }
      }

      await releaseSectionManpower(connection, SECTION_TYPES.MACHINERY, Number(id));

      await connection.query('DELETE FROM machinery_usage WHERE id = ?', [id]);

      await connection.commit();

      return res.status(200).json({
        success: true,
        message: 'Machinery usage record deleted successfully.',
      });
    } catch (dbError) {
      await connection.rollback();
      throw dbError;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Delete machinery usage error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Server error.' });
  }
};

// GET /api/admin/machinery-usage - Admin-only with advanced filters and performance analysis
const getAdminMachineryUsage = async (req, res) => {
  try {
    const { from, to, machine_type, station_id } = req.query;
    const params = [];
    let query =
      'SELECT mu.id, mu.machine_type, mu.machine_name, mu.area_used, mu.usage_hours, mu.manpower_used, mu.status, mu.usage_date, mu.shift, mu.notes, mu.station_id, s.station_name ' +
      'FROM machinery_usage mu LEFT JOIN stations s ON mu.station_id = s.id WHERE 1=1';

    if (from) {
      query += ' AND usage_date >= ?';
      params.push(from);
    }

    if (to) {
      query += ' AND usage_date <= ?';
      params.push(to);
    }

    if (machine_type) {
      query += ' AND mu.machine_type LIKE ?';
      params.push(`%${machine_type}%`);
    }

    if (station_id) {
      query += ' AND mu.station_id = ?';
      params.push(station_id);
    }

    query += ' ORDER BY mu.usage_date DESC, mu.created_at DESC';

    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(query, params);
      const normalizedRows = rows.map((row) => ({
        ...row,
        usage_date: normalizeDateValue(row.usage_date),
      }));

      // Calculate performance metrics by machine type
      const performanceQuery = `
        SELECT 
          mu.machine_type,
          mu.machine_name,
          COUNT(*) as usage_count,
          SUM(mu.usage_hours) as total_hours,
          AVG(mu.usage_hours) as avg_hours_per_use,
          SUM(CASE WHEN mu.status = 'Breakdown' THEN 1 ELSE 0 END) as breakdown_count,
          SUM(CASE WHEN mu.status = 'Maintenance' THEN 1 ELSE 0 END) as maintenance_count,
          SUM(CASE WHEN mu.status IN ('Working', 'Operational') THEN 1 ELSE 0 END) as operational_count
        FROM machinery_usage mu
        LEFT JOIN stations s ON mu.station_id = s.id
        WHERE 1=1
        ${from ? 'AND mu.usage_date >= ?' : ''}
        ${to ? 'AND mu.usage_date <= ?' : ''}
        ${machine_type ? 'AND mu.machine_type LIKE ?' : ''}
        ${station_id ? 'AND mu.station_id = ?' : ''}
        GROUP BY mu.machine_type, mu.machine_name
        ORDER BY total_hours DESC
      `;

      const [performance] = await connection.query(performanceQuery, params);

      // Station-wise analysis
      const stationQuery = `
        SELECT 
          mu.station_id,
          s.station_name,
          COUNT(*) as total_usage,
          SUM(mu.usage_hours) as total_hours,
          COUNT(DISTINCT mu.machine_type) as distinct_machines
        FROM machinery_usage mu
        LEFT JOIN stations s ON mu.station_id = s.id
        WHERE 1=1
        ${from ? 'AND mu.usage_date >= ?' : ''}
        ${to ? 'AND mu.usage_date <= ?' : ''}
        ${machine_type ? 'AND mu.machine_type LIKE ?' : ''}
        ${station_id ? 'AND mu.station_id = ?' : ''}
        GROUP BY mu.station_id, s.station_name
        ORDER BY total_hours DESC
      `;

      const [stationStats] = await connection.query(stationQuery, params);

      return res.status(200).json({
        success: true,
        data: normalizedRows,
        summary: {
          total_records: normalizedRows.length,
          total_usage_hours: normalizedRows.reduce((sum, r) => sum + (r.usage_hours || 0), 0),
          machine_performance: performance,
          station_analysis: stationStats,
        },
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get admin machinery usage error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  getMachineryUsage,
  createMachineryUsage,
  deleteMachineryUsage,
  getAdminMachineryUsage,
};
