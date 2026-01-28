const pool = require('../config/db');

/**
 * Get Admin Dashboard Statistics
 * GET /admin/dashboard
 * Super Admin only
 */
const getDashboardStats = async (req, res) => {
  try {
    const {
      date,
      from,
      to,
      station_id: stationIdParam,
      area,
      shift,
    } = req.query;

    const targetDate = date || new Date().toISOString().split('T')[0];
    const useRange = Boolean(from && to);
    const stationId = stationIdParam ? Number(stationIdParam) : null;

    const connection = await pool.getConnection();
    try {
      let stationName = null;
      if (stationId) {
        const [stationRows] = await connection.query(
          'SELECT station_name FROM stations WHERE id = ? LIMIT 1',
          [stationId],
        );
        stationName = stationRows[0]?.station_name || null;
        if (!stationName) {
          return res.status(404).json({
            success: false,
            message: 'Station not found',
          });
        }
      }

      const buildDateFilter = (column) => {
        if (useRange) {
          return {
            clause: `${column} BETWEEN ? AND ?`,
            params: [from, to],
          };
        }
        return {
          clause: `${column} = ?`,
          params: [targetDate],
        };
      };

      // 1. Staff Working Today
      const staffDateFilter = buildDateFilter('date');
      const staffConditions = [staffDateFilter.clause];
      const staffParams = [...staffDateFilter.params];

      if (stationName) {
        staffConditions.push('station_name = ?');
        staffParams.push(stationName);
      }

      if (shift) {
        staffConditions.push('shift = ?');
        staffParams.push(shift);
      }

      const staffWhere = staffConditions.length ? `WHERE ${staffConditions.join(' AND ')}` : '';

      const [staffStats] = await connection.query(
        `SELECT 
          COUNT(DISTINCT id) as total_staff_entries,
          SUM(number_of_persons) as total_persons,
          COUNT(DISTINCT station_name) as stations_covered
        FROM staff
        ${staffWhere}`,
        staffParams,
      );

      // 2. Chemical Used Today
      const chemicalDateFilter = buildDateFilter('usage_date');
      const chemicalConditions = [chemicalDateFilter.clause];
      const chemicalParams = [...chemicalDateFilter.params];

      if (stationId) {
        chemicalConditions.push('station_id = ?');
        chemicalParams.push(stationId);
      }

      if (area) {
        chemicalConditions.push('area = ?');
        chemicalParams.push(area);
      }

      if (shift) {
        chemicalConditions.push('shift = ?');
        chemicalParams.push(shift);
      }

      const chemicalWhere = `WHERE ${chemicalConditions.join(' AND ')}`;

      const [chemicalStats] = await connection.query(
        `SELECT 
          COUNT(*) as total_usage_records,
          COUNT(DISTINCT chemical_name) as chemicals_used,
          SUM(quantity) as total_quantity_used
        FROM chemical_usage
        ${chemicalWhere}`,
        chemicalParams,
      );

      // 3. Inventory Status (Low Stock Items)
      const chemicalParamsForInventory = [...chemicalParams];
      const [inventoryStats] = await connection.query(
        `SELECT 
          COUNT(*) as total_chemicals,
          SUM(CASE 
            WHEN (total_stock - COALESCE(usage_totals.total_used, 0)) <= minimum_stock_level 
            THEN 1 ELSE 0 
          END) as low_stock_count,
          SUM(CASE 
            WHEN (total_stock - COALESCE(usage_totals.total_used, 0)) > minimum_stock_level 
            THEN 1 ELSE 0 
          END) as sufficient_stock_count
        FROM chemical_products
        LEFT JOIN (
          SELECT chemical_name, SUM(quantity) as total_used
          FROM chemical_usage
          ${chemicalWhere}
          GROUP BY chemical_name
        ) usage_totals ON usage_totals.chemical_name = chemical_products.chemical_name`,
        chemicalParamsForInventory,
      );

      // 4. Pest Activities Today
      let pestDateClause;
      let pestDateParams;
      if (useRange) {
        pestDateClause = '((date BETWEEN ? AND ?) OR (service_date BETWEEN ? AND ?))';
        pestDateParams = [from, to, from, to];
      } else {
        pestDateClause = '((date = ?) OR (service_date = ?))';
        pestDateParams = [targetDate, targetDate];
      }

      const pestConditions = [pestDateClause];
      const pestParams = [...pestDateParams];

      if (stationId) {
        pestConditions.push('station_id = ?');
        pestParams.push(stationId);
      }

      if (area) {
        pestConditions.push('area_covered = ?');
        pestParams.push(area);
      }

      const pestWhere = `WHERE ${pestConditions.join(' AND ')}`;

      const [pestStats] = await connection.query(
        `SELECT 
          COUNT(*) as total_activities,
          COUNT(DISTINCT pest_type) as pest_types_handled,
          COUNT(DISTINCT station_id) as stations_serviced,
          SUM(quantity_used) as total_chemical_used
        FROM pest_control
        ${pestWhere}`,
        pestParams,
      );

      // 5. Machinery Usage Today
      const machineryDateFilter = buildDateFilter('usage_date');
      const machineryConditions = [machineryDateFilter.clause];
      const machineryParams = [...machineryDateFilter.params];

      if (stationId) {
        machineryConditions.push('station_id = ?');
        machineryParams.push(stationId);
      }

      if (shift) {
        machineryConditions.push('shift = ?');
        machineryParams.push(shift);
      }

      const machineryWhere = `WHERE ${machineryConditions.join(' AND ')}`;

      const [machineryStats] = await connection.query(
        `SELECT 
          COUNT(*) as total_usage_records,
          COUNT(DISTINCT machine_type) as machine_types_used,
          SUM(usage_hours) as total_hours,
          COUNT(DISTINCT station_id) as stations_covered
        FROM machinery_usage
        ${machineryWhere}`,
        machineryParams,
      );

      return res.status(200).json({
        success: true,
        date: targetDate,
        stats: {
          staff: {
            total_staff_entries: staffStats[0].total_staff_entries || 0,
            total_persons: staffStats[0].total_persons || 0,
            stations_covered: staffStats[0].stations_covered || 0
          },
          chemicals: {
            total_usage_records: chemicalStats[0].total_usage_records || 0,
            chemicals_used: chemicalStats[0].chemicals_used || 0,
            total_quantity_used: chemicalStats[0].total_quantity_used || 0
          },
          inventory: {
            total_chemicals: inventoryStats[0].total_chemicals || 0,
            low_stock_count: inventoryStats[0].low_stock_count || 0,
            sufficient_stock_count: inventoryStats[0].sufficient_stock_count || 0
          },
          pest: {
            total_activities: pestStats[0].total_activities || 0,
            pest_types_handled: pestStats[0].pest_types_handled || 0,
            stations_serviced: pestStats[0].stations_serviced || 0,
            total_chemical_used: pestStats[0].total_chemical_used || 0
          },
          machinery: {
            total_usage_records: machineryStats[0].total_usage_records || 0,
            machine_types_used: machineryStats[0].machine_types_used || 0,
            total_hours: machineryStats[0].total_hours || 0,
            stations_covered: machineryStats[0].stations_covered || 0
          }
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics.'
    });
  }
};

module.exports = {
  getDashboardStats
};
