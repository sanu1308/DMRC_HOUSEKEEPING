const pool = require('../config/db');

const STAFF_STATUS = {
  WORKING: 'Working',
  IDLE: 'Idle',
};

const MIN_ACTIVE_STAFF = 6;

const parsePositiveInt = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    return null;
  }
  return num;
};

const BASE_SELECT = `
  SELECT
    sm.id,
    sm.staff_name,
    sm.role,
    sm.shift,
    sm.station_id,
    sm.is_active,
    sm.created_at,
    sm.updated_at,
    s.station_name,
    s.station_code
  FROM staff_master sm
  INNER JOIN stations s ON s.id = sm.station_id
`;

const parseBooleanQuery = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  const lowered = String(value).toLowerCase();
  if (['1', 'true', 'yes'].includes(lowered)) return true;
  if (['0', 'false', 'no'].includes(lowered)) return false;
  return null;
};

/**
 * Get all staff master records
 * GET /api/staff
 */
const getAllStaff = async (req, res) => {
  try {
    const { stationId, shift, role, search } = req.query;
    const isActiveFilter = parseBooleanQuery(req.query.is_active);

    let query = `${BASE_SELECT} WHERE 1=1`;
    const params = [];

    if (stationId) {
      const stationIdNum = parsePositiveInt(stationId);
      if (stationIdNum === null) {
        return res.status(400).json({ success: false, message: 'stationId must be a positive integer.' });
      }
      query += ' AND sm.station_id = ?';
      params.push(stationIdNum);
    }

    if (shift) {
      query += ' AND sm.shift = ?';
      params.push(shift);
    }

    if (role) {
      query += ' AND sm.role = ?';
      params.push(role);
    }

    if (isActiveFilter !== null) {
      query += ' AND sm.is_active = ?';
      params.push(isActiveFilter ? 1 : 0);
    }

    if (search) {
      query += ' AND sm.staff_name LIKE ?';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY sm.is_active DESC, s.station_name ASC, sm.staff_name ASC';

    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(query, params);
      return res.status(200).json({ success: true, data: rows });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get staff error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * Get staff master record by ID
 * GET /api/staff/:id
 */
const getStaffById = async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(`${BASE_SELECT} WHERE sm.id = ?`, [id]);
      if (!rows.length) {
        return res.status(404).json({ success: false, message: 'Staff record not found.' });
      }
      return res.status(200).json({ success: true, data: rows[0] });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get staff error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * Create new staff master record
 * POST /api/staff
 */
const createStaff = async (req, res) => {
  try {
    const { staff_name, role, shift, station_id, is_active } = req.body;

    const trimmedName = (staff_name || '').trim();
    const trimmedRole = (role || '').trim();
    const trimmedShift = (shift || '').trim();

    if (!trimmedName || !trimmedRole || !trimmedShift || !station_id) {
      return res.status(400).json({
        success: false,
        message: 'staff_name, role, shift and station_id are required.',
      });
    }

    const stationIdNum = Number(station_id);
    if (!Number.isInteger(stationIdNum) || stationIdNum <= 0) {
      return res.status(400).json({ success: false, message: 'station_id must be a positive integer.' });
    }

    const activeValue = parseBooleanQuery(is_active);
    const activeTinyInt = activeValue === null ? 1 : activeValue ? 1 : 0;

    const connection = await pool.getConnection();
    try {
      const [stations] = await connection.query('SELECT id FROM stations WHERE id = ?', [stationIdNum]);
      if (!stations.length) {
        return res.status(404).json({ success: false, message: 'Station not found.' });
      }

      const [result] = await connection.query(
        'INSERT INTO staff_master (staff_name, role, shift, station_id, is_active, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [trimmedName, trimmedRole, trimmedShift, stationIdNum, activeTinyInt, req.user.id, req.user.id],
      );

      return res.status(201).json({
        success: true,
        message: 'Staff record created successfully.',
        data: {
          id: result.insertId,
          staff_name: trimmedName,
          role: trimmedRole,
          shift: trimmedShift,
          station_id: stationIdNum,
          is_active: !!activeTinyInt,
        },
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Create staff error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * Update staff master record
 * PUT /api/staff/:id
 */
const updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { staff_name, role, shift, station_id, is_active } = req.body;

    const trimmedName = (staff_name || '').trim();
    const trimmedRole = (role || '').trim();
    const trimmedShift = (shift || '').trim();

    if (!trimmedName || !trimmedRole || !trimmedShift || !station_id) {
      return res.status(400).json({
        success: false,
        message: 'staff_name, role, shift and station_id are required.',
      });
    }

    const stationIdNum = Number(station_id);
    if (!Number.isInteger(stationIdNum) || stationIdNum <= 0) {
      return res.status(400).json({ success: false, message: 'station_id must be a positive integer.' });
    }

    const activeValue = parseBooleanQuery(is_active);
    const activeTinyInt = activeValue === null ? 1 : activeValue ? 1 : 0;

    const connection = await pool.getConnection();
    try {
      const [existing] = await connection.query('SELECT id, station_id, is_active FROM staff_master WHERE id = ?', [id]);
      if (!existing.length) {
        return res.status(404).json({ success: false, message: 'Staff record not found.' });
      }

      const [stations] = await connection.query('SELECT id FROM stations WHERE id = ?', [stationIdNum]);
      if (!stations.length) {
        return res.status(404).json({ success: false, message: 'Station not found.' });
      }

      if (existing[0].is_active && (activeTinyInt === 0 || existing[0].station_id !== stationIdNum)) {
        const [counts] = await connection.query(
          'SELECT COUNT(*) as count FROM staff_master WHERE station_id = ? AND is_active = 1 AND id <> ?',
          [existing[0].station_id, id],
        );
        if (counts[0].count < MIN_ACTIVE_STAFF) {
          return res.status(400).json({
            success: false,
            message: `Each station must retain at least ${MIN_ACTIVE_STAFF} active staff members.`,
          });
        }
      }

      await connection.query(
        'UPDATE staff_master SET staff_name = ?, role = ?, shift = ?, station_id = ?, is_active = ?, updated_by = ? WHERE id = ?',
        [trimmedName, trimmedRole, trimmedShift, stationIdNum, activeTinyInt, req.user.id, id],
      );

      return res.status(200).json({ success: true, message: 'Staff record updated successfully.' });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Update staff error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * Delete staff master record
 * DELETE /api/staff/:id
 */
const deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    try {
      const [existing] = await connection.query('SELECT id, station_id, is_active FROM staff_master WHERE id = ?', [id]);
      if (!existing.length) {
        return res.status(404).json({ success: false, message: 'Staff record not found.' });
      }

      if (existing[0].is_active) {
        const [counts] = await connection.query(
          'SELECT COUNT(*) as count FROM staff_master WHERE station_id = ? AND is_active = 1 AND id <> ?',
          [existing[0].station_id, id],
        );
        if (counts[0].count < MIN_ACTIVE_STAFF) {
          return res.status(400).json({
            success: false,
            message: `Each station must retain at least ${MIN_ACTIVE_STAFF} active staff members.`,
          });
        }
      }

      await connection.query('DELETE FROM staff_master WHERE id = ?', [id]);

      return res.status(200).json({ success: true, message: 'Staff record deleted successfully.' });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Delete staff error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * Staff utilization status report
 * GET /admin/staff-status?date=
 */
const getStaffStatus = async (req, res) => {
  try {
    const targetDate = req.query.date || new Date().toISOString().slice(0, 10);

    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(
        `
          SELECT
            sm.id,
            sm.staff_name,
            sm.role,
            sm.shift,
            sm.station_id,
            s.station_name,
            sm.is_active,
            CASE
              WHEN EXISTS (
                SELECT 1 FROM chemical_usage cu
                WHERE cu.station_id = sm.station_id
                  AND cu.shift = sm.shift
                  AND cu.usage_date = ?
              )
              OR EXISTS (
                SELECT 1 FROM machinery_usage mu
                WHERE mu.station_id = sm.station_id
                  AND mu.shift = sm.shift
                  AND mu.usage_date = ?
              )
              OR EXISTS (
                SELECT 1 FROM pest_control pc
                WHERE pc.station_id = sm.station_id
                  AND (pc.shift IS NULL OR pc.shift = sm.shift)
                  AND COALESCE(pc.service_date, pc.date) = ?
              )
              THEN ?
              ELSE ?
            END AS status
          FROM staff_master sm
          INNER JOIN stations s ON s.id = sm.station_id
          ORDER BY sm.is_active DESC, s.station_name ASC, sm.staff_name ASC
        `,
        [targetDate, targetDate, targetDate, STAFF_STATUS.WORKING, STAFF_STATUS.IDLE],
      );

      const working = rows.filter((row) => row.status === STAFF_STATUS.WORKING).length;
      const idle = rows.filter((row) => row.status === STAFF_STATUS.IDLE).length;

      return res.status(200).json({
        success: true,
        meta: {
          date: targetDate,
          working,
          idle,
          total: rows.length,
        },
        data: rows,
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Staff status error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  getAllStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
  getStaffStatus,
};
