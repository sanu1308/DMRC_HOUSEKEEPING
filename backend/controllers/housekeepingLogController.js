const pool = require('../config/db');

/**
 * Get all housekeeping logs
 * GET /api/housekeeping-logs
 */
const getAllHousekeepingLogs = async (req, res) => {
  try {
    const { date, user_id, station_id } = req.query;

    let query = `SELECT hl.*, u.name as user_name, s.station_name FROM housekeeping_logs hl 
                 LEFT JOIN users u ON hl.user_id = u.id 
                 LEFT JOIN stations s ON hl.station_id = s.id WHERE 1=1`;
    const params = [];

    if (date) {
      query += ' AND hl.date = ?';
      params.push(date);
    }

    if (user_id) {
      query += ' AND hl.user_id = ?';
      params.push(user_id);
    }

    if (station_id) {
      query += ' AND hl.station_id = ?';
      params.push(station_id);
    }

    query += ' ORDER BY hl.date DESC, hl.time DESC';

    const connection = await pool.getConnection();
    try {
      const [logs] = await connection.query(query, params);

      return res.status(200).json({
        success: true,
        data: logs
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get housekeeping logs error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
};

/**
 * Get housekeeping log by ID
 * GET /api/housekeeping-logs/:id
 */
const getHousekeepingLogById = async (req, res) => {
  try {
    const { id } = req.params;

    const connection = await pool.getConnection();
    try {
      const [logs] = await connection.query(
        'SELECT * FROM housekeeping_logs WHERE id = ?',
        [id]
      );

      if (logs.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Housekeeping log not found.'
        });
      }

      return res.status(200).json({
        success: true,
        data: logs[0]
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get housekeeping log error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
};

/**
 * Create new housekeeping log
 * POST /api/housekeeping-logs
 */
const createHousekeepingLog = async (req, res) => {
  try {
    const { station_id, chemical_id, machinery_id, staff_id, pest_control_id, cleaning_area, cleaning_type, date, time, remarks } = req.body;

    // Validate required fields
    if (!station_id || !cleaning_area || !cleaning_type || !date || !time) {
      return res.status(400).json({
        success: false,
        message: 'Station, cleaning area, cleaning type, date, and time are required.'
      });
    }

    const connection = await pool.getConnection();
    try {
      // Create housekeeping log
      const [result] = await connection.query(
        `INSERT INTO housekeeping_logs (user_id, station_id, chemical_id, machinery_id, staff_id, pest_control_id, cleaning_area, cleaning_type, date, time, remarks) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          station_id,
          chemical_id || null,
          machinery_id || null,
          staff_id || null,
          pest_control_id || null,
          cleaning_area,
          cleaning_type,
          date,
          time,
          remarks || null
        ]
      );

      return res.status(201).json({
        success: true,
        message: 'Housekeeping log created successfully.',
        data: {
          id: result.insertId,
          user_id: req.user.id,
          station_id,
          cleaning_area,
          cleaning_type,
          date,
          time
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Create housekeeping log error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
};

/**
 * Update housekeeping log
 * PUT /api/housekeeping-logs/:id
 */
const updateHousekeepingLog = async (req, res) => {
  try {
    const { id } = req.params;
    const { station_id, chemical_id, machinery_id, staff_id, pest_control_id, cleaning_area, cleaning_type, date, time, remarks } = req.body;

    if (!station_id || !cleaning_area || !cleaning_type || !date || !time) {
      return res.status(400).json({
        success: false,
        message: 'Station, cleaning area, cleaning type, date, and time are required.'
      });
    }

    const connection = await pool.getConnection();
    try {
      // Check if log exists
      const [logs] = await connection.query(
        'SELECT * FROM housekeeping_logs WHERE id = ?',
        [id]
      );

      if (logs.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Housekeeping log not found.'
        });
      }

      // Update log
      await connection.query(
        `UPDATE housekeeping_logs SET station_id = ?, chemical_id = ?, machinery_id = ?, staff_id = ?, pest_control_id = ?, cleaning_area = ?, cleaning_type = ?, date = ?, time = ?, remarks = ? WHERE id = ?`,
        [
          station_id,
          chemical_id || null,
          machinery_id || null,
          staff_id || null,
          pest_control_id || null,
          cleaning_area,
          cleaning_type,
          date,
          time,
          remarks || null,
          id
        ]
      );

      return res.status(200).json({
        success: true,
        message: 'Housekeeping log updated successfully.'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Update housekeeping log error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
};

/**
 * Delete housekeeping log
 * DELETE /api/housekeeping-logs/:id
 */
const deleteHousekeepingLog = async (req, res) => {
  try {
    const { id } = req.params;

    const connection = await pool.getConnection();
    try {
      // Check if log exists
      const [logs] = await connection.query(
        'SELECT * FROM housekeeping_logs WHERE id = ?',
        [id]
      );

      if (logs.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Housekeeping log not found.'
        });
      }

      // Delete log
      await connection.query(
        'DELETE FROM housekeeping_logs WHERE id = ?',
        [id]
      );

      return res.status(200).json({
        success: true,
        message: 'Housekeeping log deleted successfully.'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Delete housekeeping log error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
};

/**
 * Get user's own housekeeping logs
 * GET /api/housekeeping-logs/user/my-logs
 */
const getMyHousekeepingLogs = async (req, res) => {
  try {
    const userId = req.user.id;
    const { date } = req.query;

    let query = 'SELECT * FROM housekeeping_logs WHERE user_id = ?';
    const params = [userId];

    if (date) {
      query += ' AND date = ?';
      params.push(date);
    }

    query += ' ORDER BY date DESC, time DESC';

    const connection = await pool.getConnection();
    try {
      const [logs] = await connection.query(query, params);

      return res.status(200).json({
        success: true,
        data: logs
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get user housekeeping logs error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
};

module.exports = {
  getAllHousekeepingLogs,
  getHousekeepingLogById,
  createHousekeepingLog,
  updateHousekeepingLog,
  deleteHousekeepingLog,
  getMyHousekeepingLogs
};
