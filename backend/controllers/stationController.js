const pool = require('../config/db');

/**
 * Get all stations
 * GET /api/stations
 */
const getAllStations = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    try {
      const [stations] = await connection.query(
        'SELECT s.*, u.name as created_by_name FROM stations s LEFT JOIN users u ON s.created_by = u.id ORDER BY s.created_at DESC'
      );

      return res.status(200).json({
        success: true,
        data: stations
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get stations error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
};

/**
 * Get station by ID
 * GET /api/stations/:id
 */
const getStationById = async (req, res) => {
  try {
    const { id } = req.params;

    const connection = await pool.getConnection();
    try {
      const [stations] = await connection.query(
        'SELECT * FROM stations WHERE id = ?',
        [id]
      );

      if (stations.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Station not found.'
        });
      }

      return res.status(200).json({
        success: true,
        data: stations[0]
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get station error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
};

/**
 * Create new station
 * POST /api/stations
 */
const createStation = async (req, res) => {
  try {
    const { station_name, station_code } = req.body;

    // Validate input
    if (!station_name || !station_code) {
      return res.status(400).json({
        success: false,
        message: 'Station name and code are required.'
      });
    }

    const connection = await pool.getConnection();
    try {
      // Check if station code already exists
      const [existingStations] = await connection.query(
        'SELECT * FROM stations WHERE station_code = ?',
        [station_code]
      );

      if (existingStations.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Station with this code already exists.'
        });
      }

      // Create station
      const [result] = await connection.query(
        'INSERT INTO stations (station_name, station_code, created_by, updated_by) VALUES (?, ?, ?, ?)',
        [station_name, station_code, req.user.id, req.user.id]
      );

      return res.status(201).json({
        success: true,
        message: 'Station created successfully.',
        data: {
          id: result.insertId,
          station_name,
          station_code,
          created_by: req.user.id
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Create station error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
};

/**
 * Update station
 * PUT /api/stations/:id
 */
const updateStation = async (req, res) => {
  try {
    const { id } = req.params;
    const { station_name, station_code } = req.body;

    if (!station_name || !station_code) {
      return res.status(400).json({
        success: false,
        message: 'Station name and code are required.'
      });
    }

    const connection = await pool.getConnection();
    try {
      // Check if station exists
      const [stations] = await connection.query(
        'SELECT * FROM stations WHERE id = ?',
        [id]
      );

      if (stations.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Station not found.'
        });
      }

      // Update station
      await connection.query(
        'UPDATE stations SET station_name = ?, station_code = ?, updated_by = ? WHERE id = ?',
        [station_name, station_code, req.user.id, id]
      );

      return res.status(200).json({
        success: true,
        message: 'Station updated successfully.'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Update station error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
};

/**
 * Delete station
 * DELETE /api/stations/:id
 */
const deleteStation = async (req, res) => {
  try {
    const { id } = req.params;

    const connection = await pool.getConnection();
    try {
      // Check if station exists
      const [stations] = await connection.query(
        'SELECT * FROM stations WHERE id = ?',
        [id]
      );

      if (stations.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Station not found.'
        });
      }

      // Delete station
      await connection.query(
        'DELETE FROM stations WHERE id = ?',
        [id]
      );

      return res.status(200).json({
        success: true,
        message: 'Station deleted successfully.'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Delete station error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
};

module.exports = {
  getAllStations,
  getStationById,
  createStation,
  updateStation,
  deleteStation
};
