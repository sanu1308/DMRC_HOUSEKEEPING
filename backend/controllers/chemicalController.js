const pool = require('../config/db');

/**
 * Get all chemicals
 * GET /api/chemicals
 */
const getAllChemicals = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    try {
      const [chemicals] = await connection.query(
        'SELECT * FROM chemical_products ORDER BY created_at DESC'
      );

      return res.status(200).json({
        success: true,
        data: chemicals
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get chemicals error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
};

/**
 * Get chemical by ID
 * GET /api/chemicals/:id
 */
const getChemicalById = async (req, res) => {
  try {
    const { id } = req.params;

    const connection = await pool.getConnection();
    try {
      const [chemicals] = await connection.query(
        'SELECT * FROM chemical_products WHERE id = ?',
        [id]
      );

      if (chemicals.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Chemical not found.'
        });
      }

      return res.status(200).json({
        success: true,
        data: chemicals[0]
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get chemical error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
};

/**
 * Create new chemical
 * POST /api/chemicals
 */
const createChemical = async (req, res) => {
  try {
    const {
      chemical_name,
      category,
      measuring_unit,
      quantity,
      total_stock,
      minimum_stock_level,
      monthly_quantity,
      daily_utilized,
    } = req.body;

    if (
      !chemical_name ||
      !category ||
      !measuring_unit ||
      quantity === undefined ||
      total_stock === undefined ||
      minimum_stock_level === undefined ||
      monthly_quantity === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          'chemical_name, category, measuring_unit, quantity, total_stock, minimum_stock_level and monthly_quantity are required.',
      });
    }

    const qty = Number(quantity);
    const total = Number(total_stock);
    const minLevel = Number(minimum_stock_level);
    const monthlyQty = Number(monthly_quantity);
    const dailyUtilized = daily_utilized === undefined ? 0 : Number(daily_utilized);

    if ([qty, total, minLevel, monthlyQty, dailyUtilized].some((num) => Number.isNaN(num) || num < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Stock and quantity values must be non-negative numbers.',
      });
    }

    const connection = await pool.getConnection();
    try {
      const [result] = await connection.query(
        'INSERT INTO chemical_products (chemical_name, category, measuring_unit, quantity, total_stock, minimum_stock_level, monthly_quantity, daily_utilized, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          chemical_name,
          category,
          measuring_unit,
          qty,
          total,
          minLevel,
          monthlyQty,
          dailyUtilized,
          req.user.id,
          req.user.id,
        ],
      );

      return res.status(201).json({
        success: true,
        message: 'Chemical created successfully.',
        data: {
          id: result.insertId,
          chemical_name,
          category,
          measuring_unit,
          quantity: qty,
          total_stock: total,
          minimum_stock_level: minLevel,
          monthly_quantity: monthlyQty,
          daily_utilized: dailyUtilized,
        },
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Create chemical error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
};

/**
 * Update chemical
 * PUT /api/chemicals/:id
 */
const updateChemical = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      chemical_name,
      category,
      measuring_unit,
      quantity,
      total_stock,
      minimum_stock_level,
      monthly_quantity,
      daily_utilized,
    } = req.body;

    if (
      !chemical_name ||
      !category ||
      !measuring_unit ||
      quantity === undefined ||
      total_stock === undefined ||
      minimum_stock_level === undefined ||
      monthly_quantity === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          'chemical_name, category, measuring_unit, quantity, total_stock, minimum_stock_level and monthly_quantity are required.',
      });
    }

    const qty = Number(quantity);
    const total = Number(total_stock);
    const minLevel = Number(minimum_stock_level);
    const monthlyQty = Number(monthly_quantity);
    const dailyUtilized = daily_utilized === undefined ? 0 : Number(daily_utilized);

    if ([qty, total, minLevel, monthlyQty, dailyUtilized].some((num) => Number.isNaN(num) || num < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Stock and quantity values must be non-negative numbers.',
      });
    }

    const connection = await pool.getConnection();
    try {
      const [chemicals] = await connection.query(
        'SELECT id FROM chemical_products WHERE id = ?',
        [id],
      );

      if (!chemicals.length) {
        return res.status(404).json({
          success: false,
          message: 'Chemical not found.'
        });
      }

      await connection.query(
        'UPDATE chemical_products SET chemical_name = ?, category = ?, measuring_unit = ?, quantity = ?, total_stock = ?, minimum_stock_level = ?, monthly_quantity = ?, daily_utilized = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [
          chemical_name,
          category,
          measuring_unit,
          qty,
          total,
          minLevel,
          monthlyQty,
          dailyUtilized,
          req.user.id,
          id,
        ],
      );

      return res.status(200).json({
        success: true,
        message: 'Chemical updated successfully.'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Update chemical error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
};

/**
 * Delete chemical
 * DELETE /api/chemicals/:id
 */
const deleteChemical = async (req, res) => {
  try {
    const { id } = req.params;

    const connection = await pool.getConnection();
    try {
      // Check if chemical exists
      const [chemicals] = await connection.query(
        'SELECT * FROM chemical_products WHERE id = ?',
        [id]
      );

      if (chemicals.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Chemical not found.'
        });
      }

      // Delete chemical
      await connection.query(
        'DELETE FROM chemical_products WHERE id = ?',
        [id]
      );

      return res.status(200).json({
        success: true,
        message: 'Chemical deleted successfully.'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Delete chemical error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
};

module.exports = {
  getAllChemicals,
  getChemicalById,
  createChemical,
  updateChemical,
  deleteChemical
};
