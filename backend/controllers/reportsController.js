const pool = require('../config/db');

/**
 * Get Daily Cleaning Report
 * GET /admin/reports/daily-cleaning
 * Super Admin only
 */
const getDailyCleaningReport = async (req, res) => {
  try {
    const { from, to, station_id } = req.query;
    
    // Default to today if no date range provided
    const startDate = from || new Date().toISOString().split('T')[0];
    const endDate = to || startDate;

    const connection = await pool.getConnection();
    try {
      // Build query with optional station filter
      let query = `
        SELECT 
          hl.id,
          hl.date,
          hl.time,
          s.station_name,
          hl.cleaning_area,
          hl.cleaning_type,
          CONCAT(u.name, ' (', u.email, ')') as performed_by,
          hl.remarks,
          hl.created_at
        FROM housekeeping_logs hl
        JOIN users u ON hl.user_id = u.id
        LEFT JOIN stations s ON hl.station_id = s.id
        WHERE hl.date BETWEEN ? AND ?
      `;
      
      const params = [startDate, endDate];
      
      if (station_id) {
        query += ' AND hl.station_id = ?';
        params.push(station_id);
      }
      
      query += ' ORDER BY hl.date DESC, hl.time DESC';
      
      const [cleaningLogs] = await connection.query(query, params);

      // Summary statistics
      const [summary] = await connection.query(
        `SELECT 
          COUNT(*) as total_cleaning_activities,
          COUNT(DISTINCT station_id) as stations_cleaned,
          COUNT(DISTINCT user_id) as staff_involved,
          COUNT(DISTINCT date) as days_covered
        FROM housekeeping_logs
        WHERE date BETWEEN ? AND ?
        ${station_id ? 'AND station_id = ?' : ''}`,
        station_id ? [startDate, endDate, station_id] : [startDate, endDate]
      );

      // Group by cleaning type
      const [byType] = await connection.query(
        `SELECT 
          cleaning_type,
          COUNT(*) as count
        FROM housekeeping_logs
        WHERE date BETWEEN ? AND ?
        ${station_id ? 'AND station_id = ?' : ''}
        GROUP BY cleaning_type
        ORDER BY count DESC`,
        station_id ? [startDate, endDate, station_id] : [startDate, endDate]
      );

      return res.status(200).json({
        success: true,
        data: cleaningLogs,
        summary: {
          total_cleaning_activities: summary[0].total_cleaning_activities || 0,
          stations_cleaned: summary[0].stations_cleaned || 0,
          staff_involved: summary[0].staff_involved || 0,
          days_covered: summary[0].days_covered || 0,
          by_cleaning_type: byType
        },
        filters: {
          from: startDate,
          to: endDate,
          station_id: station_id || null
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get daily cleaning report error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate daily cleaning report.'
    });
  }
};

/**
 * Get Monthly Chemical Consumption Report
 * GET /admin/reports/chemical-consumption
 * Super Admin only
 */
const getChemicalConsumptionReport = async (req, res) => {
  try {
    const { month, year, station_id, chemical_id } = req.query;
    
    // Default to current month if not provided
    const currentDate = new Date();
    const targetMonth = month || (currentDate.getMonth() + 1);
    const targetYear = year || currentDate.getFullYear();
    
    // Calculate date range for the month
    const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(targetYear, targetMonth, 0).getDate();
    const endDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${lastDay}`;

    const connection = await pool.getConnection();
    try {
      // Chemical consumption by chemical
      let consumptionQuery = `
        SELECT 
          cp.id as chemical_id,
          cu.chemical_name,
          cu.unit,
          SUM(cu.quantity) as total_quantity,
          COUNT(*) as usage_count,
          AVG(cu.quantity) as avg_quantity_per_use,
          MIN(cu.usage_date) as first_usage,
          MAX(cu.usage_date) as last_usage,
          COUNT(DISTINCT cu.station_id) as stations_used,
          COUNT(DISTINCT cu.area) as areas_covered,
          cp.total_stock,
          cp.minimum_stock_level,
          (cp.total_stock - COALESCE(SUM(cu.quantity), 0)) as remaining_stock
        FROM chemical_usage cu
        LEFT JOIN chemical_products cp ON cu.chemical_name = cp.chemical_name
        WHERE cu.usage_date BETWEEN ? AND ?
      `;
      
      const params = [startDate, endDate];
      
      if (station_id) {
        consumptionQuery += ' AND cu.station_id = ?';
        params.push(station_id);
      }
      
      if (chemical_id) {
        consumptionQuery += ' AND cp.id = ?';
        params.push(chemical_id);
      }
      
      consumptionQuery += `
        GROUP BY cp.id, cu.chemical_name, cu.unit, cp.total_stock, cp.minimum_stock_level
        ORDER BY total_quantity DESC
      `;
      
      const [consumption] = await connection.query(consumptionQuery, params);

      // Daily consumption trend
      const [dailyTrend] = await connection.query(
        `SELECT 
          cu.usage_date,
          COUNT(*) as total_usages,
          SUM(cu.quantity) as total_quantity
        FROM chemical_usage cu
        LEFT JOIN chemical_products cp ON cu.chemical_name = cp.chemical_name
        WHERE cu.usage_date BETWEEN ? AND ?
        ${station_id ? 'AND cu.station_id = ?' : ''}
        ${chemical_id ? 'AND cp.id = ?' : ''}
        GROUP BY cu.usage_date
        ORDER BY cu.usage_date`,
        [
          startDate,
          endDate,
          ...(station_id ? [station_id] : []),
          ...(chemical_id ? [chemical_id] : [])
        ].filter(p => p !== undefined)
      );

      // Summary statistics
      const totalQuantity = consumption.reduce((sum, item) => sum + parseFloat(item.total_quantity || 0), 0);
      const totalUsageCount = consumption.reduce((sum, item) => sum + parseInt(item.usage_count || 0), 0);
      const chemicalsUsed = consumption.length;

      return res.status(200).json({
        success: true,
        data: consumption,
        daily_trend: dailyTrend,
        summary: {
          month: `${targetYear}-${String(targetMonth).padStart(2, '0')}`,
          total_chemicals_used: chemicalsUsed,
          total_quantity_consumed: totalQuantity,
          total_usage_records: totalUsageCount,
          avg_daily_consumption: dailyTrend.length > 0 
            ? (totalQuantity / dailyTrend.length).toFixed(2)
            : 0
        },
        filters: {
          month: targetMonth,
          year: targetYear,
          station_id: station_id || null,
          chemical_id: chemical_id || null
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get chemical consumption report error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate chemical consumption report.'
    });
  }
};

/**
 * Get Staff Utilization Report
 * GET /admin/reports/staff-utilization
 * Super Admin only
 */
const getStaffUtilizationReport = async (req, res) => {
  try {
    const { from, to, station_id } = req.query;
    
    // Default to current month if no date range provided
    const currentDate = new Date();
    const startDate = from || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-01`;
    const endDate = to || currentDate.toISOString().split('T')[0];

    const connection = await pool.getConnection();
    try {
      // Staff deployment by station and date
      let staffQuery = `
        SELECT 
          st.id,
          st.date,
          st.day,
          COALESCE(s.station_name, st.station_name) as station_name,
          st.shift,
          st.manpower,
          st.number_of_persons,
          st.created_at
        FROM staff st
        LEFT JOIN stations s ON st.station_name = s.station_name
        WHERE st.date BETWEEN ? AND ?
      `;
      
      const params = [startDate, endDate];
      
      if (station_id) {
        staffQuery += ' AND s.id = ?';
        params.push(station_id);
      }
      
      staffQuery += ' ORDER BY st.date DESC, station_name';
      
      const [staffRecords] = await connection.query(staffQuery, params);

      // Summary by station
      const [byStation] = await connection.query(
        `SELECT 
          COALESCE(s.station_name, st.station_name) as station_name,
          COUNT(*) as total_entries,
          SUM(st.number_of_persons) as total_persons,
          AVG(st.number_of_persons) as avg_persons_per_day,
          COUNT(DISTINCT st.date) as days_covered
        FROM staff st
        LEFT JOIN stations s ON st.station_name = s.station_name
        WHERE st.date BETWEEN ? AND ?
        ${station_id ? 'AND s.id = ?' : ''}
        GROUP BY station_name
        ORDER BY total_persons DESC`,
        station_id ? [startDate, endDate, station_id] : [startDate, endDate]
      );

      // Summary by shift
      const [byShift] = await connection.query(
        `SELECT 
          st.shift,
          COUNT(*) as total_entries,
          SUM(st.number_of_persons) as total_persons,
          AVG(st.number_of_persons) as avg_persons
        FROM staff st
        LEFT JOIN stations s ON st.station_name = s.station_name
        WHERE st.date BETWEEN ? AND ?
        ${station_id ? 'AND s.id = ?' : ''}
        GROUP BY st.shift
        ORDER BY total_persons DESC`,
        station_id ? [startDate, endDate, station_id] : [startDate, endDate]
      );

      // Overall summary
      const [overall] = await connection.query(
        `SELECT 
          COUNT(*) as total_staff_entries,
          SUM(st.number_of_persons) as total_persons_deployed,
          AVG(st.number_of_persons) as avg_persons_per_entry,
          COUNT(DISTINCT st.station_name) as stations_covered,
          COUNT(DISTINCT st.date) as days_covered
        FROM staff st
        LEFT JOIN stations s ON st.station_name = s.station_name
        WHERE st.date BETWEEN ? AND ?
        ${station_id ? 'AND s.id = ?' : ''}`,
        station_id ? [startDate, endDate, station_id] : [startDate, endDate]
      );

      return res.status(200).json({
        success: true,
        data: staffRecords,
        summary: {
          total_staff_entries: overall[0].total_staff_entries || 0,
          total_persons_deployed: overall[0].total_persons_deployed || 0,
          avg_persons_per_entry: parseFloat(overall[0].avg_persons_per_entry || 0).toFixed(2),
          stations_covered: overall[0].stations_covered || 0,
          days_covered: overall[0].days_covered || 0,
          by_station: byStation,
          by_shift: byShift
        },
        filters: {
          from: startDate,
          to: endDate,
          station_id: station_id || null
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get staff utilization report error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate staff utilization report.'
    });
  }
};

module.exports = {
  getDailyCleaningReport,
  getChemicalConsumptionReport,
  getStaffUtilizationReport
};
