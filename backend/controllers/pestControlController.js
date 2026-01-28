const pool = require('../config/db');
const {
  reserveSectionManpower,
  releaseSectionManpower,
  SECTION_TYPES,
  ManpowerValidationError,
} = require('../services/manpowerService');

const DEFAULT_PEST_TYPES = ['Cockroach', 'Rat', 'Mosquito', 'Termite'];

const isSuperAdmin = (req) => req.user?.role === 'superadmin';
const getAssignedStationId = (req) => (req.user?.station_id ? Number(req.user.station_id) : null);

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

const normalizePestRecordDates = (record) => ({
  ...record,
  service_date: normalizeDateValue(record.service_date),
  date: normalizeDateValue(record.date),
});

// Get all pest control records - supports optional from/to filters
// GET /api/pest-control
const getAllPestControl = async (req, res) => {
  try {
    const { from, to, station_id } = req.query;

    let query =
      'SELECT pc.*, s.station_name FROM pest_control pc LEFT JOIN stations s ON pc.station_id = s.id WHERE 1=1';
    const params = [];

    if (from) {
      query +=
        ' AND (pc.service_date IS NOT NULL AND pc.service_date >= ? OR pc.date >= ?)';
      params.push(from, from);
    }

    if (to) {
      query +=
        ' AND (pc.service_date IS NOT NULL AND pc.service_date <= ? OR pc.date <= ?)';
      params.push(to, to);
    }

    if (isSuperAdmin(req)) {
      if (station_id) {
        const stationFilter = Number(station_id);
        if (!Number.isInteger(stationFilter) || stationFilter <= 0) {
          return res.status(400).json({ success: false, message: 'station_id must be a positive integer.' });
        }
        query += ' AND pc.station_id = ?';
        params.push(stationFilter);
      }
    } else {
      const assignedStation = getAssignedStationId(req);
      if (!assignedStation) {
        return res.status(403).json({ success: false, message: 'Station assignment missing.' });
      }
      query += ' AND pc.station_id = ?';
      params.push(assignedStation);
    }

    query +=
      ' ORDER BY COALESCE(pc.service_date, pc.date) DESC, pc.created_at DESC';

    const connection = await pool.getConnection();
    try {

      const [records] = await connection.query(query, params);
      const normalized = records.map(normalizePestRecordDates);

      return res.status(200).json({
        success: true,
        data: normalized,
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get pest control error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error.',
    });
  }
};

/**
 * Get pest control record by ID
 * GET /api/pest-control/:id
 */
const getPestControlById = async (req, res) => {
  try {
    const { id } = req.params;

    const connection = await pool.getConnection();
    try {
      const [records] = await connection.query(
        'SELECT * FROM pest_control WHERE id = ?',
        [id]
      );

      if (records.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Pest control record not found.'
        });
      }

      if (!isSuperAdmin(req)) {
        const assignedStation = getAssignedStationId(req);
        if (!assignedStation || assignedStation !== records[0].station_id) {
          return res.status(403).json({ success: false, message: 'You cannot view records for another station.' });
        }
      }

      return res.status(200).json({
        success: true,
        data: normalizePestRecordDates(records[0])
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get pest control error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
};

// Create new pest control record
// POST /api/pest-control
// Supports both new staff UI payload and existing admin payload
const createPestControl = async (req, res) => {
  try {
    const {
      // new UI
      shift,
      pest_type,
      control_method,
      chemical_used,
      chemical_id,
      area_covered,
      status,
      service_date,
      notes,
      // legacy/admin fields
      pest_control_type,
      measuring_unit,
      quantity_used,
      station_id,
      date,
      manpower_used,
    } = req.body;

    const finalPestType = pest_type || pest_control_type;
    let finalStationId;
    if (isSuperAdmin(req)) {
      if (!station_id) {
        return res.status(400).json({ success: false, message: 'station_id is required.' });
      }
      finalStationId = Number(station_id);
    } else {
      finalStationId = getAssignedStationId(req);
      if (!finalStationId) {
        return res.status(403).json({ success: false, message: 'Station assignment missing.' });
      }
      if (station_id && Number(station_id) !== finalStationId) {
        return res.status(403).json({ success: false, message: 'You can only submit records for your assigned station.' });
      }
    }

    if (!Number.isInteger(finalStationId) || finalStationId <= 0) {
      return res.status(400).json({ success: false, message: 'station_id must be a positive integer.' });
    }
    const finalDate = service_date || date;

    if (
      !finalPestType ||
      !finalStationId ||
      !finalDate ||
      manpower_used === undefined ||
      manpower_used === null
    ) {
      return res.status(400).json({
        success: false,
        message:
          'pest_type (or pest_control_type), station_id (or default), date/service_date and manpower_used are required.',
      });
    }

    const qty =
      quantity_used === undefined || quantity_used === null
        ? 0
        : Number(quantity_used);
    if (Number.isNaN(qty) || qty < 0) {
      return res.status(400).json({
        success: false,
        message: 'quantity_used must be a non-negative number.',
      });
    }

    if (chemical_id && qty <= 0) {
      return res.status(400).json({
        success: false,
        message: 'quantity_used must be provided when a chemical is selected.',
      });
    }

    const manpowerUsed = Number(manpower_used);
    if (!Number.isInteger(manpowerUsed) || manpowerUsed <= 0) {
      return res.status(400).json({
        success: false,
        message: 'manpower_used must be a positive integer.',
      });
    }

    let finalChemical = chemical_used;
    let unit = measuring_unit || 'N/A';
    const userId = req.user?.id || null;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      let chemicalRow = null;
      if (chemical_id) {
        const chemicalId = Number(chemical_id);
        if (!Number.isInteger(chemicalId) || chemicalId <= 0) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: 'chemical_id must be a positive integer.',
          });
        }

        const [chemicals] = await connection.query(
          'SELECT id, chemical_name, measuring_unit, total_stock FROM chemical_products WHERE id = ?',
          [chemicalId],
        );

        if (!chemicals.length) {
          await connection.rollback();
          return res.status(404).json({
            success: false,
            message: 'Chemical not found.',
          });
        }

        chemicalRow = chemicals[0];
        finalChemical = chemicalRow.chemical_name;
        unit = chemicalRow.measuring_unit || unit;
      }

      if (!finalChemical) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'chemical_used is required.',
        });
      }

      const [stations] = await connection.query(
        'SELECT id, station_name FROM stations WHERE id = ?',
        [finalStationId],
      );
      if (stations.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: 'Station not found.',
        });
      }

      const [result] = await connection.query(
        `INSERT INTO pest_control (
          pest_control_type,
          pest_type,
          control_method,
          chemical_used,
          measuring_unit,
          quantity_used,
          manpower_used,
          station_id,
          shift,
          area_covered,
          status,
          service_date,
          date,
          notes,
          created_by,
          updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          finalPestType,
          pest_type || null,
          control_method || null,
          finalChemical,
          unit,
          qty,
          manpowerUsed,
          finalStationId,
          shift || null,
          area_covered || null,
          status || null,
          service_date || null,
          finalDate,
          notes || null,
          userId,
          userId,
        ],
      );

      if (chemicalRow) {
        await connection.query(
          'UPDATE chemical_products SET total_stock = GREATEST(total_stock - ?, 0), updated_at = CURRENT_TIMESTAMP, updated_by = COALESCE(?, updated_by) WHERE id = ?',
          [qty, userId, chemicalRow.id],
        );
      }

      const manpowerTracking = await reserveSectionManpower(connection, {
        stationId: finalStationId,
        section: SECTION_TYPES.PEST,
        usageDate: finalDate,
        manpowerUsed,
        sourceType: SECTION_TYPES.PEST,
        sourceRecordId: result.insertId,
        userId,
      });

      await connection.commit();

      return res.status(201).json({
        success: true,
        message: 'Pest control record created successfully.',
        data: {
          id: result.insertId,
          pest_control_type: finalPestType,
          pest_type: pest_type || null,
          control_method: control_method || null,
          chemical_used: finalChemical,
          measuring_unit: unit,
          quantity_used: qty,
          manpower_used: manpowerUsed,
          station_id: finalStationId,
          station_name: stations[0]?.station_name || null,
          shift: shift || null,
          area_covered: area_covered || null,
          status: status || null,
          service_date: service_date || null,
          date: finalDate,
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
    console.error('Create pest control error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error.',
    });
  }
};

/**
 * Update pest control record
 * PUT /api/pest-control/:id
 */
const updatePestControl = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      pest_control_type,
      chemical_used,
      measuring_unit,
      quantity_used,
      station_id,
      date,
      shift_id,
      area_treated,
      effectiveness,
      notes
    } = req.body;

    if (!pest_control_type || !chemical_used || !measuring_unit || !quantity_used || !station_id || !date) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required.'
      });
    }

    const connection = await pool.getConnection();
    try {
      // Check if pest control record exists
      const [records] = await connection.query(
        'SELECT * FROM pest_control WHERE id = ?',
        [id]
      );

      if (records.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Pest control record not found.'
        });
      }

      // Update pest control record
      await connection.query(
        'UPDATE pest_control SET pest_control_type = ?, chemical_used = ?, measuring_unit = ?, quantity_used = ?, station_id = ?, shift_id = ?, area_treated = ?, effectiveness = ?, notes = ?, date = ?, updated_by = ? WHERE id = ?',
        [
          pest_control_type,
          chemical_used,
          measuring_unit,
          quantity_used,
          station_id,
          shift_id || null,
          area_treated || null,
          effectiveness || null,
          notes || null,
          date,
          req.user.id,
          id
        ]
      );

      return res.status(200).json({
        success: true,
        message: 'Pest control record updated successfully.'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Update pest control error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
};

/**
 * Delete pest control record
 * DELETE /api/pest-control/:id
 */
const deletePestControl = async (req, res) => {
  try {
    const { id } = req.params;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Check if pest control record exists
      const [records] = await connection.query(
        'SELECT station_id FROM pest_control WHERE id = ?',
        [id]
      );

      if (records.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: 'Pest control record not found.'
        });
      }

      if (!isSuperAdmin(req)) {
        const assignedStation = getAssignedStationId(req);
        if (!assignedStation || assignedStation !== records[0].station_id) {
          await connection.rollback();
          return res.status(403).json({ success: false, message: 'You cannot delete records for another station.' });
        }
      }

      await releaseSectionManpower(connection, SECTION_TYPES.PEST, Number(id));

      // Delete pest control record
      await connection.query(
        'DELETE FROM pest_control WHERE id = ?',
        [id]
      );

      await connection.commit();

      return res.status(200).json({
        success: true,
        message: 'Pest control record deleted successfully.'
      });
    } catch (dbError) {
      await connection.rollback();
      throw dbError;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Delete pest control error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
};

const getPestTypes = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    try {
      let selectExpr = 'pest_control_type';
      let whereExpr = 'pest_control_type IS NOT NULL';

      try {
        const [columns] = await connection.query(
          'SHOW COLUMNS FROM pest_control LIKE ?',
          ['pest_type'],
        );
        if (columns.length > 0) {
          selectExpr = 'COALESCE(pest_type, pest_control_type)';
          whereExpr = 'COALESCE(pest_type, pest_control_type) IS NOT NULL';
        }
      } catch (columnErr) {
        console.warn('Unable to inspect pest_control columns:', columnErr);
      }

      const [rows] = await connection.query(
        `SELECT DISTINCT ${selectExpr} AS pest FROM pest_control WHERE ${whereExpr}`,
      );

      const unique = new Set(DEFAULT_PEST_TYPES);

      rows
        .map((row) => row.pest)
        .filter(Boolean)
        .forEach((name) => unique.add(name));

      const list = Array.from(unique).sort((a, b) => a.localeCompare(b));

      return res.status(200).json({ success: true, data: list });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get pest types error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error.',
    });
  }
};

// GET /api/admin/pest-control - Admin-only with advanced filters and recurring issue detection
const getAdminPestControl = async (req, res) => {
  try {
    const { from, to, pest_type, area_covered, control_method, station_id } = req.query;
    const params = [];

    let query =
      'SELECT pc.*, s.station_name FROM pest_control pc LEFT JOIN stations s ON pc.station_id = s.id WHERE 1=1';

    if (from) {
      query +=
        ' AND (pc.service_date IS NOT NULL AND pc.service_date >= ? OR pc.date >= ?)';
      params.push(from, from);
    }

    if (to) {
      query +=
        ' AND (pc.service_date IS NOT NULL AND pc.service_date <= ? OR pc.date <= ?)';
      params.push(to, to);
    }

    if (pest_type) {
      query += ' AND (pc.pest_type LIKE ? OR pc.pest_control_type LIKE ?)';
      params.push(`%${pest_type}%`, `%${pest_type}%`);
    }

    if (area_covered) {
      query += ' AND pc.area_covered LIKE ?';
      params.push(`%${area_covered}%`);
    }

    if (control_method) {
      query += ' AND pc.control_method LIKE ?';
      params.push(`%${control_method}%`);
    }

    if (station_id) {
      query += ' AND pc.station_id = ?';
      params.push(station_id);
    }

    query +=
      ' ORDER BY COALESCE(pc.service_date, pc.date) DESC, pc.created_at DESC';

    const connection = await pool.getConnection();
    try {
      const [records] = await connection.query(query, params);
      const normalizedRecords = records.map(normalizePestRecordDates);

      // Detect recurring issues (same pest type in same area/station multiple times)
      const recurringQuery = `
        SELECT 
          COALESCE(pc.pest_type, pc.pest_control_type) as pest_type,
          pc.area_covered,
          pc.station_id,
          s.station_name,
          COUNT(*) as occurrence_count,
          MAX(COALESCE(pc.service_date, pc.date)) as last_occurrence
        FROM pest_control pc
        LEFT JOIN stations s ON pc.station_id = s.id
        WHERE 1=1
        ${from ? 'AND (pc.service_date >= ? OR pc.date >= ?)' : ''}
        ${to ? 'AND (pc.service_date <= ? OR pc.date <= ?)' : ''}
        ${pest_type ? 'AND (pc.pest_type LIKE ? OR pc.pest_control_type LIKE ?)' : ''}
        ${area_covered ? 'AND pc.area_covered LIKE ?' : ''}
        ${control_method ? 'AND pc.control_method LIKE ?' : ''}
        ${station_id ? 'AND pc.station_id = ?' : ''}
        GROUP BY COALESCE(pc.pest_type, pc.pest_control_type), pc.area_covered, pc.station_id, s.station_name
        HAVING COUNT(*) > 1
        ORDER BY occurrence_count DESC, last_occurrence DESC
      `;

      const [recurring] = await connection.query(recurringQuery, params);
      const normalizedRecurring = recurring.map((item) => ({
        ...item,
        last_occurrence: normalizeDateValue(item.last_occurrence),
      }));

      // Summary by pest type
      const summaryQuery = `
        SELECT 
          COALESCE(pc.pest_type, pc.pest_control_type) as pest_type,
          COUNT(*) as total_incidents,
          SUM(pc.quantity_used) as total_chemical_used,
          pc.measuring_unit
        FROM pest_control pc
        WHERE 1=1
        ${from ? 'AND (pc.service_date >= ? OR pc.date >= ?)' : ''}
        ${to ? 'AND (pc.service_date <= ? OR pc.date <= ?)' : ''}
        ${pest_type ? 'AND (pc.pest_type LIKE ? OR pc.pest_control_type LIKE ?)' : ''}
        ${area_covered ? 'AND pc.area_covered LIKE ?' : ''}
        ${control_method ? 'AND pc.control_method LIKE ?' : ''}
        ${station_id ? 'AND pc.station_id = ?' : ''}
        GROUP BY COALESCE(pc.pest_type, pc.pest_control_type), pc.measuring_unit
        ORDER BY total_incidents DESC
      `;

      const [summary] = await connection.query(summaryQuery, params);

      return res.status(200).json({
        success: true,
        data: normalizedRecords,
        summary: {
          total_records: normalizedRecords.length,
          recurring_issues: normalizedRecurring,
          pest_summary: summary,
        },
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get admin pest control error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error.',
    });
  }
};

module.exports = {
  getAllPestControl,
  getPestControlById,
  createPestControl,
  updatePestControl,
  deletePestControl,
  getPestTypes,
  getAdminPestControl,
};
