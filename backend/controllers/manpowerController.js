const pool = require('../config/db');
const { MIN_STATION_MANPOWER } = require('../services/manpowerService');
const {
  APP_TIMEZONE,
  normalizeDateParam,
  todayString,
  nextDateString,
} = require('../utils/dateUtils');

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

const sanitizeBreakdown = (value) => {
  const parsed = parsePositiveInt(value);
  return parsed === null ? 0 : parsed;
};

const getStationManpower = async (req, res) => {
  let snapshotDate;
  try {
    snapshotDate = normalizeDateParam(req.query?.date);
  } catch (dateError) {
    return res
      .status(dateError.statusCode || 400)
      .json({ success: false, message: dateError.message });
  }

  const todaySnapshot = todayString();
  const nextResetDate = nextDateString(snapshotDate);

  try {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(
        `SELECT
           sm.id,
           sm.station_id,
           st.station_name,
           st.station_code,
           sm.total_manpower,
           sm.supervisors,
           sm.technicians,
           sm.cleaners,
           sm.notes,
           sm.created_at,
           sm.updated_at
         FROM station_manpower sm
         INNER JOIN stations st ON st.id = sm.station_id
         ORDER BY st.station_name ASC`,
      );

      const stationIds = rows.map((row) => row.station_id);
      let usageMap = new Map();

      if (stationIds.length) {
        const placeholders = stationIds.map(() => '?').join(',');
        const [usageRows] = await connection.query(
          `SELECT station_id, COALESCE(SUM(manpower_used), 0) AS used_today
           FROM section_manpower_usage
           WHERE usage_date = ? AND station_id IN (${placeholders})
           GROUP BY station_id`,
          [snapshotDate, ...stationIds],
        );

        usageMap = new Map(
          usageRows.map((usage) => [usage.station_id, Number(usage.used_today) || 0]),
        );
      }

      const enriched = rows.map((row) => {
        const usedToday = Number(usageMap.get(row.station_id) || 0);
        const availableToday = Math.max(row.total_manpower - usedToday, 0);

        return {
          ...row,
          snapshot_date: snapshotDate,
          used_today: usedToday,
          available_today: availableToday,
          reset_state: snapshotDate === todaySnapshot ? 'scheduled' : 'historical',
        };
      });

      return res.status(200).json({
        success: true,
        data: enriched,
        meta: {
          snapshot_date: snapshotDate,
          next_reset_date: nextResetDate,
          timezone: APP_TIMEZONE,
        },
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get station manpower error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const upsertStationManpower = async (req, res) => {
  try {
    const stationId = parsePositiveInt(req.body.station_id);
    const totalManpower = parsePositiveInt(req.body.total_manpower);
    const supervisors = sanitizeBreakdown(req.body.supervisors);
    const technicians = sanitizeBreakdown(req.body.technicians);
    const cleaners = sanitizeBreakdown(req.body.cleaners);
    const notes = (req.body.notes || '').trim() || null;

    if (!stationId || !totalManpower) {
      return res.status(400).json({ success: false, message: 'station_id and total_manpower are required.' });
    }

    if (totalManpower < MIN_STATION_MANPOWER) {
      return res.status(400).json({
        success: false,
        message: `total_manpower must be at least ${MIN_STATION_MANPOWER}.`,
      });
    }

    const breakdownSum = supervisors + technicians + cleaners;
    if (breakdownSum && breakdownSum > totalManpower) {
      return res.status(400).json({
        success: false,
        message: 'Sum of supervisors, technicians, and cleaners cannot exceed total_manpower.',
      });
    }

    const connection = await pool.getConnection();
    try {
      const [stations] = await connection.query('SELECT id FROM stations WHERE id = ?', [stationId]);
      if (!stations.length) {
        return res.status(404).json({ success: false, message: 'Station not found.' });
      }

      await connection.query(
        `INSERT INTO station_manpower (station_id, total_manpower, supervisors, technicians, cleaners, notes)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           total_manpower = VALUES(total_manpower),
           supervisors = VALUES(supervisors),
           technicians = VALUES(technicians),
           cleaners = VALUES(cleaners),
           notes = VALUES(notes),
           updated_at = CURRENT_TIMESTAMP`,
        [stationId, totalManpower, supervisors, technicians, cleaners, notes],
      );

      return res.status(200).json({ success: true, message: 'Station manpower allocation saved.' });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Upsert station manpower error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getSectionUsage = async (req, res) => {
  try {
    const { station_id, section, from, to } = req.query;
    const params = [];
    let query = `
      SELECT
        smu.id,
        smu.station_id,
        st.station_name,
        smu.section,
        smu.usage_date,
        smu.manpower_used,
        smu.source_type,
        smu.source_record_id,
        smu.created_at
      FROM section_manpower_usage smu
      INNER JOIN stations st ON st.id = smu.station_id
      WHERE 1=1`;

    if (station_id) {
      const stationId = parsePositiveInt(station_id);
      if (!stationId) {
        return res.status(400).json({ success: false, message: 'station_id must be a positive integer.' });
      }
      query += ' AND smu.station_id = ?';
      params.push(stationId);
    }

    if (section) {
      query += ' AND smu.section = ?';
      params.push(section);
    }

    if (from) {
      query += ' AND smu.usage_date >= ?';
      params.push(from);
    }

    if (to) {
      query += ' AND smu.usage_date <= ?';
      params.push(to);
    }

    query += ' ORDER BY smu.usage_date DESC, smu.created_at DESC';

    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(query, params);
      return res.status(200).json({ success: true, data: rows });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get section manpower usage error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  getStationManpower,
  upsertStationManpower,
  getSectionUsage,
};
