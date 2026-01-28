const pool = require('../config/db');

const formatRow = (row) => ({
  id: row.id,
  area_name: row.area_name,
  description: row.description,
  is_active: !!row.is_active,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

async function getAreas(req, res) {
  try {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(
        'SELECT id, area_name, description, is_active, created_at, updated_at FROM areas ORDER BY area_name ASC',
      );
      return res.status(200).json({ success: true, data: rows.map(formatRow) });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get areas error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function getAreaById(req, res) {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(
        'SELECT id, area_name, description, is_active, created_at, updated_at FROM areas WHERE id = ?',
        [id],
      );

      if (!rows.length) {
        return res.status(404).json({ success: false, message: 'Area not found.' });
      }

      return res.status(200).json({ success: true, data: formatRow(rows[0]) });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get area by id error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function createArea(req, res) {
  try {
    const { area_name: rawName, description, is_active } = req.body;
    const areaName = (rawName || '').trim();

    if (!areaName) {
      return res
        .status(400)
        .json({ success: false, message: 'area_name is required.' });
    }

    const connection = await pool.getConnection();
    try {
      const [result] = await connection.query(
        'INSERT INTO areas (area_name, description, is_active) VALUES (?, ?, ?)',
        [areaName, description || null, is_active === undefined ? 1 : is_active ? 1 : 0],
      );

      const [rows] = await connection.query(
        'SELECT id, area_name, description, is_active, created_at, updated_at FROM areas WHERE id = ?',
        [result.insertId],
      );

      return res.status(201).json({ success: true, data: formatRow(rows[0]) });
    } finally {
      connection.release();
    }
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      return res
        .status(409)
        .json({ success: false, message: 'Area name already exists.' });
    }

    console.error('Create area error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function updateArea(req, res) {
  try {
    const { id } = req.params;
    const { area_name: rawName, description, is_active } = req.body;

    if (
      rawName === undefined &&
      description === undefined &&
      is_active === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: 'Provide at least one field to update.',
      });
    }

    const fields = [];
    const values = [];

    if (rawName !== undefined) {
      const name = String(rawName).trim();
      if (!name) {
        return res
          .status(400)
          .json({ success: false, message: 'area_name cannot be empty.' });
      }
      fields.push('area_name = ?');
      values.push(name);
    }

    if (description !== undefined) {
      fields.push('description = ?');
      values.push(description || null);
    }

    if (is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }

    const connection = await pool.getConnection();
    try {
      const [result] = await connection.query(
        `UPDATE areas SET ${fields.join(', ')} WHERE id = ?`,
        [...values, id],
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Area not found.' });
      }

      const [rows] = await connection.query(
        'SELECT id, area_name, description, is_active, created_at, updated_at FROM areas WHERE id = ?',
        [id],
      );

      return res.status(200).json({ success: true, data: formatRow(rows[0]) });
    } finally {
      connection.release();
    }
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      return res
        .status(409)
        .json({ success: false, message: 'Area name already exists.' });
    }

    console.error('Update area error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function deleteArea(req, res) {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.query('DELETE FROM areas WHERE id = ?', [id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Area not found.' });
      }

      return res
        .status(200)
        .json({ success: true, message: 'Area deleted successfully.' });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Delete area error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = {
  getAreas,
  getAreaById,
  createArea,
  updateArea,
  deleteArea,
};
