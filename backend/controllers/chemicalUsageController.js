const pool = require('../config/db');
const {
  reserveSectionManpower,
  releaseSectionManpower,
  SECTION_TYPES,
  ManpowerValidationError,
} = require('../services/manpowerService');

const VALID_SHIFT = ['Day', 'Night'];

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

// GET /api/chemical-usage
const getChemicalUsage = async (req, res) => {
  try {
    const { from, to, station_id } = req.query;
    const params = [];
    let query =
      'SELECT cu.id, cu.chemical_name, cu.quantity, cu.unit, cu.area, cu.shift, cu.manpower_used, cu.usage_date, cu.notes, cu.station_id, s.station_name ' +
      'FROM chemical_usage cu LEFT JOIN stations s ON cu.station_id = s.id WHERE 1=1';

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
        query += ' AND cu.station_id = ?';
        params.push(stationFilter);
      }
    } else {
      const assignedStation = getAssignedStationId(req);
      if (!assignedStation) {
        return res.status(403).json({ success: false, message: 'Station assignment missing.' });
      }
      query += ' AND cu.station_id = ?';
      params.push(assignedStation);
    }

    query += ' ORDER BY cu.usage_date DESC, cu.created_at DESC';

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
    console.error('Get chemical usage error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Server error.' });
  }
};

// POST /api/chemical-usage
const createChemicalUsage = async (req, res) => {
  try {
    const {
      chemical_id,
      chemical_name,
      quantity,
      unit,
      area,
      shift,
      usage_date,
      notes,
      station_id,
      manpower_used,
    } = req.body;

    if (
      quantity === undefined ||
      quantity === null ||
      !area ||
      !shift ||
      !usage_date
    ) {
      return res.status(400).json({
        success: false,
        message:
          'quantity, area, shift and usage_date are required.',
      });
    }

    const qtyNum = Number(quantity);
    if (Number.isNaN(qtyNum) || qtyNum < 0) {
      return res.status(400).json({
        success: false,
        message: 'quantity must be a non-negative number.',
      });
    }

    if (!VALID_SHIFT.includes(shift)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid shift value.',
      });
    }

    const manpowerUsed = Number(manpower_used);
    if (!Number.isInteger(manpowerUsed) || manpowerUsed <= 0) {
      return res.status(400).json({
        success: false,
        message: 'manpower_used must be a positive integer.',
      });
    }

    const finalArea = (area || '').trim();
    if (!finalArea) {
      return res.status(400).json({
        success: false,
        message: 'area is required.',
      });
    }


    let stationId = null;
    if (isSuperAdmin(req)) {
      if (!station_id) {
        return res.status(400).json({ success: false, message: 'station_id is required.' });
      }
      stationId = Number(station_id);
    } else {
      stationId = getAssignedStationId(req);
      if (!stationId) {
        return res.status(403).json({ success: false, message: 'Station assignment missing.' });
      }
      if (station_id && Number(station_id) !== stationId) {
        return res.status(403).json({ success: false, message: 'You can only submit records for your assigned station.' });
      }
    }

    if (!Number.isInteger(stationId) || stationId <= 0) {
      return res.status(400).json({ success: false, message: 'station_id must be a positive integer.' });
    }

    let finalChemicalName = (chemical_name || '').trim();
    let finalUnit = (unit || '').trim();
    const userId = req.user?.id || null;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [stationRows] = await connection.query(
        'SELECT id FROM stations WHERE id = ?',
        [stationId],
      );
      if (!stationRows.length) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: 'Station not found.',
        });
      }

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
        finalChemicalName = chemicalRow.chemical_name;
        finalUnit = chemicalRow.measuring_unit;
      }

      if (!finalChemicalName) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'chemical_name is required.',
        });
      }

      if (!finalUnit) {
        finalUnit = 'units';
      }

      const [result] = await connection.query(
        'INSERT INTO chemical_usage (chemical_name, quantity, unit, area, shift, manpower_used, usage_date, notes, station_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          finalChemicalName,
          qtyNum,
          finalUnit,
          finalArea,
          shift,
          manpowerUsed,
          usage_date,
          notes || null,
          stationId,
          userId,
        ],
      );

      if (chemicalRow) {
        await connection.query(
          'UPDATE chemical_products SET total_stock = GREATEST(total_stock - ?, 0), updated_at = CURRENT_TIMESTAMP, updated_by = COALESCE(?, updated_by) WHERE id = ?',
          [qtyNum, userId, chemicalRow.id],
        );
      }

      const manpowerTracking = await reserveSectionManpower(connection, {
        stationId,
        section: SECTION_TYPES.CHEMICAL,
        usageDate: usage_date,
        manpowerUsed,
        sourceType: SECTION_TYPES.CHEMICAL,
        sourceRecordId: result.insertId,
        userId,
      });

      await connection.commit();

      return res.status(201).json({
        success: true,
        message: 'Chemical usage record created successfully.',
        data: {
          id: result.insertId,
          chemical_name: finalChemicalName,
          quantity: qtyNum,
          unit: finalUnit,
          area: finalArea,
          shift,
          manpower_used: manpowerUsed,
          usage_date,
          notes: notes || null,
          station_id: stationId,
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
    console.error('Create chemical usage error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Server error.' });
  }
};

// DELETE /api/chemical-usage/:id
const deleteChemicalUsage = async (req, res) => {
  try {
    const { id } = req.params;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [records] = await connection.query('SELECT station_id FROM chemical_usage WHERE id = ?', [id]);
      if (!records.length) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'Chemical usage record not found.' });
      }

      if (!isSuperAdmin(req)) {
        const assignedStation = getAssignedStationId(req);
        if (!assignedStation || assignedStation !== records[0].station_id) {
          await connection.rollback();
          return res.status(403).json({ success: false, message: 'You cannot delete records for another station.' });
        }
      }

      await releaseSectionManpower(connection, SECTION_TYPES.CHEMICAL, Number(id));

      await connection.query('DELETE FROM chemical_usage WHERE id = ?', [id]);

      await connection.commit();

      return res.status(200).json({
        success: true,
        message: 'Chemical usage record deleted successfully.',
      });
    } catch (dbError) {
      await connection.rollback();
      throw dbError;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Delete chemical usage error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Server error.' });
  }
};

// GET /api/admin/chemical-usage - Admin-only with advanced filters and totals
const getAdminChemicalUsage = async (req, res) => {
  try {
    const { from, to, station_id, area, chemical_name } = req.query;
    const params = [];
    let query =
      'SELECT cu.id, cu.chemical_name, cu.quantity, cu.unit, cu.area, cu.shift, cu.manpower_used, cu.usage_date, cu.notes, cu.station_id, s.station_name ' +
      'FROM chemical_usage cu LEFT JOIN stations s ON cu.station_id = s.id WHERE 1=1';

    if (from) {
      query += ' AND usage_date >= ?';
      params.push(from);
    }

    if (to) {
      query += ' AND usage_date <= ?';
      params.push(to);
    }

    if (station_id) {
      query += ' AND cu.station_id = ?';
      params.push(station_id);
    }

    if (area) {
      query += ' AND cu.area LIKE ?';
      params.push(`%${area}%`);
    }

    if (chemical_name) {
      query += ' AND cu.chemical_name LIKE ?';
      params.push(`%${chemical_name}%`);
    }

    query += ' ORDER BY cu.usage_date DESC, cu.created_at DESC';

    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(query, params);

      const normalizedRows = rows.map((row) => ({
        ...row,
        usage_date: normalizeDateValue(row.usage_date),
      }));

      // Calculate total usage by chemical
      const totalQuery = `
        SELECT 
          cu.chemical_name,
          cu.unit,
          SUM(cu.quantity) as total_quantity,
          COUNT(*) as usage_count
        FROM chemical_usage cu
        LEFT JOIN stations s ON cu.station_id = s.id
        WHERE 1=1
        ${from ? 'AND cu.usage_date >= ?' : ''}
        ${to ? 'AND cu.usage_date <= ?' : ''}
        ${station_id ? 'AND cu.station_id = ?' : ''}
        ${area ? 'AND cu.area LIKE ?' : ''}
        ${chemical_name ? 'AND cu.chemical_name LIKE ?' : ''}
        GROUP BY cu.chemical_name, cu.unit
        ORDER BY total_quantity DESC
      `;

      const [totals] = await connection.query(totalQuery, params);

      return res.status(200).json({
        success: true,
        data: normalizedRows,
        summary: {
          total_records: normalizedRows.length,
          usage_by_chemical: totals,
        },
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get admin chemical usage error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  getChemicalUsage,
  createChemicalUsage,
  deleteChemicalUsage,
  getAdminChemicalUsage,
};
