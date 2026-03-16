const pool = require('../config/db');
const {
  APP_TIMEZONE,
  normalizeDateParam,
  todayString,
  nextDateString,
} = require('../utils/dateUtils');

const parseCount = (value, defaultValue = 0) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    return defaultValue;
  }
  return Math.floor(parsed);
};

const validateCounts = (total, inUse, faulty, maintenance) => {
  if (total <= 0) {
    throw new Error('quantity_total must be greater than zero.');
  }
  if (inUse + faulty + maintenance > total) {
    throw new Error('The sum of in use, faulty, and maintenance counts cannot exceed total quantity.');
  }
};

const withAvailability = (row) => ({
  ...row,
  available_quantity: Math.max(
    row.quantity_total - row.quantity_in_use - row.quantity_faulty - row.quantity_maintenance,
    0,
  ),
});

const mapStationInventory = (row) => {
  const total = Number(row.quantity_total) || 0;
  const faulty = Number(row.quantity_faulty) || 0;
  const maintenance = Number(row.quantity_maintenance) || 0;
  const workingPool = Math.max(total - faulty - maintenance, 0);

  return {
    station_id: row.station_id,
    station_name: row.station_name,
    quantity_total: total,
    quantity_in_use: 0,
    quantity_working: workingPool,
    quantity_faulty: faulty,
    quantity_maintenance: maintenance,
    utilization: total > 0 ? Number(((workingPool / total) * 100).toFixed(1)) : 0,
  };
};

/*
 * Get all machinery
 * GET /api/machinery
 */
const getAllMachinery = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    try {
      const [machinery] = await connection.query(
        `SELECT m.*, s.station_name FROM machinery m 
         LEFT JOIN stations s ON m.station_id = s.id 
         ORDER BY m.created_at DESC`
      );

      const enriched = machinery.map(withAvailability);

      return res.status(200).json({
        success: true,
        data: enriched
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get machinery error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
};

/**
 * Get machinery by ID
 * GET /api/machinery/:id
 */
const getMachineryById = async (req, res) => {
  try {
    const { id } = req.params;

    const connection = await pool.getConnection();
    try {
      const [machinery] = await connection.query(
        'SELECT * FROM machinery WHERE id = ?',
        [id]
      );

      if (machinery.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Machinery not found.'
        });
      }

        return res.status(200).json({
        success: true,
          data: withAvailability(machinery[0])
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get machinery error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
};

/**
 * Create new machinery
 * POST /api/machinery
 */
const createMachinery = async (req, res) => {
  try {
    const {
      machinery_name,
      machine_type,
      number_of_days,
      station_id,
      quantity_total,
      quantity_in_use,
      quantity_faulty,
      quantity_maintenance,
    } = req.body;

    // Validate input
    if (!machinery_name || !machine_type || !number_of_days || !station_id) {
      return res.status(400).json({
        success: false,
        message: 'Machinery name, machine type, number of days, and station are required.'
      });
    }

    const total = parseCount(quantity_total, 1);
    const inUse = parseCount(quantity_in_use);
    const faulty = parseCount(quantity_faulty);
    const maintenance = parseCount(quantity_maintenance);

    try {
      validateCounts(total, inUse, faulty, maintenance);
    } catch (validationError) {
      return res.status(400).json({ success: false, message: validationError.message });
    }

    const connection = await pool.getConnection();
    try {
      // Check if station exists
      const [stations] = await connection.query(
        'SELECT * FROM stations WHERE id = ?',
        [station_id]
      );

      if (stations.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Station not found.'
        });
      }

      // Create machinery
      const [result] = await connection.query(
        `INSERT INTO machinery (
          machinery_name,
          machine_type,
          number_of_days,
          station_id,
          quantity_total,
          quantity_in_use,
          quantity_faulty,
          quantity_maintenance,
          created_by,
          updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          machinery_name,
          machine_type,
          number_of_days,
          station_id,
          total,
          inUse,
          faulty,
          maintenance,
          req.user.id,
          req.user.id,
        ]
      );

      return res.status(201).json({
        success: true,
        message: 'Machinery created successfully.',
        data: {
          id: result.insertId,
          machinery_name,
          machine_type,
          number_of_days,
          station_id,
          quantity_total: total,
          quantity_in_use: inUse,
          quantity_faulty: faulty,
          quantity_maintenance: maintenance,
          available_quantity: Math.max(total - inUse - faulty - maintenance, 0),
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Create machinery error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
};

/**
 * Update machinery
 * PUT /api/machinery/:id
 */
const updateMachinery = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      machinery_name,
      machine_type,
      number_of_days,
      station_id,
      quantity_total,
      quantity_in_use,
      quantity_faulty,
      quantity_maintenance,
    } = req.body;

    if (!machinery_name || !machine_type || !number_of_days || !station_id) {
      return res.status(400).json({
        success: false,
        message: 'Machinery name, machine type, number of days, and station are required.'
      });
    }

    const total = parseCount(quantity_total, 1);
    const inUse = parseCount(quantity_in_use);
    const faulty = parseCount(quantity_faulty);
    const maintenance = parseCount(quantity_maintenance);

    try {
      validateCounts(total, inUse, faulty, maintenance);
    } catch (validationError) {
      return res.status(400).json({ success: false, message: validationError.message });
    }

    const connection = await pool.getConnection();
    try {
      // Check if machinery exists
      const [machinery] = await connection.query(
        'SELECT * FROM machinery WHERE id = ?',
        [id]
      );

      if (machinery.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Machinery not found.'
        });
      }

      // Update machinery
      await connection.query(
        `UPDATE machinery SET 
          machinery_name = ?,
          machine_type = ?,
          number_of_days = ?,
          station_id = ?,
          quantity_total = ?,
          quantity_in_use = ?,
          quantity_faulty = ?,
          quantity_maintenance = ?,
          updated_by = ?
        WHERE id = ?`,
        [
          machinery_name,
          machine_type,
          number_of_days,
          station_id,
          total,
          inUse,
          faulty,
          maintenance,
          req.user.id,
          id,
        ]
      );

      return res.status(200).json({
        success: true,
        message: 'Machinery updated successfully.'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Update machinery error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
};

/**
 * Delete machinery
 * DELETE /api/machinery/:id
 */
const deleteMachinery = async (req, res) => {
  try {
    const { id } = req.params;

    const connection = await pool.getConnection();
    try {
      // Check if machinery exists
      const [machinery] = await connection.query(
        'SELECT * FROM machinery WHERE id = ?',
        [id]
      );

      if (machinery.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Machinery not found.'
        });
      }

      // Delete machinery
      await connection.query(
        'DELETE FROM machinery WHERE id = ?',
        [id]
      );

      return res.status(200).json({
        success: true,
        message: 'Machinery deleted successfully.'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Delete machinery error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
};

/**
 * Admin inventory summary by station
 * GET /api/admin/machinery-inventory
 */
const STATUS_BUCKETS = {
  working: 'in_use',
  operational: 'available',
  breakdown: 'faulty',
  maintenance: 'maintenance',
};

const getMachineryInventorySummary = async (req, res) => {
  let snapshotDate;
  try {
    snapshotDate = normalizeDateParam(req.query?.date);
  } catch (dateError) {
    return res
      .status(dateError.statusCode || 400)
      .json({ success: false, message: dateError.message });
  }

  try {
    const { from, to, station_id: stationIdParam } = req.query;
    const stationId = stationIdParam ? Number(stationIdParam) : null;

    if (stationId && (!Number.isInteger(stationId) || stationId <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'station_id must be a positive integer.',
      });
    }

    const connection = await pool.getConnection();
    try {
      const stationFilterClause = stationId ? 'WHERE s.id = ?' : '';
      const stationParams = stationId ? [stationId] : [];

      const [rows] = await connection.query(
        `SELECT 
          s.id AS station_id,
          s.station_name,
          COALESCE(SUM(m.quantity_total), 0) AS quantity_total,
          COALESCE(SUM(m.quantity_faulty), 0) AS quantity_faulty,
          COALESCE(SUM(m.quantity_maintenance), 0) AS quantity_maintenance
        FROM stations s
        LEFT JOIN machinery m ON m.station_id = s.id
        ${stationFilterClause}
        GROUP BY s.id, s.station_name
        ORDER BY s.station_name ASC`,
        stationParams,
      );

      const stationIds = rows.map((row) => row.station_id);
      const usageConditions = [];
      const usageParams = [];
      const hasRange = Boolean(from || to);

      if (hasRange) {
        if (from) {
          usageConditions.push('usage_date >= ?');
          usageParams.push(from);
        }
        if (to) {
          usageConditions.push('usage_date <= ?');
          usageParams.push(to);
        }
      } else {
        usageConditions.push('usage_date = ?');
        usageParams.push(snapshotDate);
      }

      if (stationId) {
        usageConditions.push('station_id = ?');
        usageParams.push(stationId);
      } else if (stationIds.length) {
        usageConditions.push(`station_id IN (${stationIds.map(() => '?').join(',')})`);
        usageParams.push(...stationIds);
      }

      let usageMap = new Map();
      if (usageConditions.length) {
        const usageQuery = `
          SELECT station_id, COUNT(DISTINCT machine_name) AS assigned_count
          FROM machinery_usage
          WHERE ${usageConditions.join(' AND ')}
          GROUP BY station_id
        `;

        const [usageRows] = await connection.query(usageQuery, usageParams);
        usageMap = new Map(
          usageRows.map((row) => [row.station_id, Number(row.assigned_count) || 0]),
        );
      }

      const stations = rows
        .map(mapStationInventory)
        .filter((station) => station.quantity_total > 0)
        .map((station) => {
          const workingPool = Math.max(
            station.quantity_total - station.quantity_faulty - station.quantity_maintenance,
            0,
          );
          const assignedCount = Number(usageMap.get(station.station_id) || 0);
          const quantity_in_use = Math.min(workingPool, assignedCount);
          const quantity_working = Math.max(workingPool - quantity_in_use, 0);

          return {
            ...station,
            quantity_in_use,
            quantity_working,
            available_today: quantity_working,
            used_today: quantity_in_use,
            snapshot_date: hasRange ? null : snapshotDate,
          };
        });

      const totals = stations.reduce(
        (acc, station) => {
          acc.quantity_total += station.quantity_total;
          acc.quantity_in_use += station.quantity_in_use;
          acc.quantity_working += station.quantity_working;
          acc.quantity_faulty += station.quantity_faulty;
          acc.quantity_maintenance += station.quantity_maintenance;
          return acc;
        },
        {
          quantity_total: 0,
          quantity_in_use: 0,
          quantity_working: 0,
          quantity_faulty: 0,
          quantity_maintenance: 0,
        },
      );

      const workingPoolTotal = totals.quantity_in_use + totals.quantity_working;
      const summary = {
        ...totals,
        utilization:
          workingPoolTotal > 0
            ? Number(((totals.quantity_in_use / workingPoolTotal) * 100).toFixed(1))
            : 0,
        stations_with_inventory: stations.length,
        snapshot_date: hasRange ? null : snapshotDate,
        next_reset_date: hasRange ? null : nextDateString(snapshotDate),
      };

      return res.status(200).json({
        success: true,
        data: {
          stations,
          summary,
        },
        meta: {
          snapshot_date: hasRange ? null : snapshotDate,
          next_reset_date: hasRange ? null : nextDateString(snapshotDate),
          filter_mode: hasRange ? 'range' : 'single-day',
          timezone: APP_TIMEZONE,
        },
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get machinery inventory summary error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
};

module.exports = {
  getAllMachinery,
  getMachineryById,
  createMachinery,
  updateMachinery,
  deleteMachinery,
  getMachineryInventorySummary,
};/* End Patch */
