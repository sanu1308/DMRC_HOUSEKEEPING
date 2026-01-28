const pool = require('../config/db');

/**
 * Get Inventory Status with Stock Calculations
 * GET /admin/inventory
 * Super Admin only
 */
const getInventoryStatus = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    try {
      // Get all chemicals with usage calculations
      const query = `
        SELECT 
          cp.id,
          cp.chemical_name,
          cp.category,
          cp.measuring_unit,
          cp.total_stock,
          cp.minimum_stock_level,
          COALESCE(SUM(cu.quantity), 0) as total_used,
          (cp.total_stock - COALESCE(SUM(cu.quantity), 0)) as remaining_stock,
          CASE
            WHEN (cp.total_stock - COALESCE(SUM(cu.quantity), 0)) <= cp.minimum_stock_level THEN 'LOW'
            ELSE 'SUFFICIENT'
          END as stock_status
        FROM chemical_products cp
        LEFT JOIN chemical_usage cu ON cp.chemical_name = cu.chemical_name
        GROUP BY cp.id, cp.chemical_name, cp.category, cp.measuring_unit, 
                 cp.total_stock, cp.minimum_stock_level
        ORDER BY 
          CASE
            WHEN (cp.total_stock - COALESCE(SUM(cu.quantity), 0)) <= cp.minimum_stock_level THEN 0
            ELSE 1
          END,
          cp.chemical_name
      `;

      const [inventory] = await connection.query(query);

      // Calculate summary statistics
      const lowStockCount = inventory.filter(item => item.stock_status === 'LOW').length;
      const sufficientStockCount = inventory.filter(item => item.stock_status === 'SUFFICIENT').length;
      const totalChemicals = inventory.length;

      return res.status(200).json({
        success: true,
        data: inventory,
        summary: {
          total_chemicals: totalChemicals,
          low_stock_count: lowStockCount,
          sufficient_stock_count: sufficientStockCount
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get inventory status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory status.'
    });
  }
};

module.exports = {
  getInventoryStatus
};
