const pool = require('../config/db');
const { processExportRequest } = require('../services/reportExportService');

const OVERVIEW_LIMIT = 6;
const ALERT_LIMIT = 10;
const EXPORT_TTL_DAYS = 14;

const getStationPulseOverview = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    try {
      const [activeAlerts] = await connection.query(
        `SELECT 
          ae.id,
          ae.alert_type,
          ae.severity,
          ae.message,
          ae.created_at,
          s.station_name,
          ar.rule_name
        FROM alert_events ae
        LEFT JOIN stations s ON ae.station_id = s.id
        LEFT JOIN alert_rules ar ON ae.rule_id = ar.id
        WHERE ae.acknowledged = 0
        ORDER BY ae.created_at DESC
        LIMIT ?`,
        [ALERT_LIMIT]
      );

      const [recentAudits] = await connection.query(
        `SELECT 
          ca.id,
          ca.audit_date,
          ca.score,
          ca.status,
          ca.auditor_name,
          s.station_name
        FROM compliance_audits ca
        INNER JOIN stations s ON ca.station_id = s.id
        ORDER BY ca.audit_date DESC
        LIMIT ?`,
        [OVERVIEW_LIMIT]
      );

      const [openActions] = await connection.query(
        `SELECT 
          ca.id,
          ca.title,
          ca.priority,
          ca.due_date,
          ca.status,
          s.station_name
        FROM compliance_actions ca
        INNER JOIN stations s ON ca.station_id = s.id
        WHERE ca.status IN ('open', 'in_progress')
        ORDER BY 
          CASE ca.priority 
            WHEN 'high' THEN 1
            WHEN 'medium' THEN 2
            ELSE 3
          END,
          ca.due_date ASC
        LIMIT ?`,
        [OVERVIEW_LIMIT]
      );

      const [recentExports] = await connection.query(
        `SELECT 
          re.id,
          re.report_date,
          re.format,
          re.status,
          re.file_path,
          re.created_at,
          re.expires_at,
          s.station_name
        FROM report_exports re
        LEFT JOIN stations s ON re.station_id = s.id
        ORDER BY re.created_at DESC
        LIMIT ?`,
        [OVERVIEW_LIMIT]
      );

      const [[complianceScore]] = await connection.query(
        `SELECT COALESCE(AVG(score), 0) AS avgScore
        FROM compliance_audits
        WHERE audit_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)`
      );

      const [[overdueActions]] = await connection.query(
        `SELECT COUNT(*) AS total
        FROM compliance_actions
        WHERE status IN ('open', 'in_progress')
          AND due_date IS NOT NULL
          AND due_date < CURDATE()`
      );

      const [[pendingExports]] = await connection.query(
        `SELECT COUNT(*) AS total
        FROM report_exports
        WHERE status = 'pending'`
      );

      return res.status(200).json({
        success: true,
        data: {
          metrics: {
            avgComplianceScore: Number(complianceScore?.avgScore || 0),
            overdueActions: Number(overdueActions?.total || 0),
            pendingExports: Number(pendingExports?.total || 0),
            activeAlerts: activeAlerts.length,
          },
          alerts: activeAlerts,
          compliance: {
            recentAudits,
            openActions,
          },
          exports: {
            recent: recentExports,
          },
        },
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get station pulse overview error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load Station Pulse overview.',
    });
  }
};

const acknowledgeAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Alert id is required.',
      });
    }

    const [result] = await pool.query(
      `UPDATE alert_events
       SET acknowledged = 1,
           acknowledged_by = ?,
           acknowledged_at = NOW()
       WHERE id = ? AND acknowledged = 0`,
      [userId || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found or already acknowledged.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Alert acknowledged.',
    });
  } catch (error) {
    console.error('Acknowledge alert error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to acknowledge alert.',
    });
  }
};

const createExportRequest = async (req, res) => {
  try {
    const { stationId, reportDate, format } = req.body || {};
    const userId = req.user?.id;

    if (!reportDate || !format) {
      return res.status(400).json({
        success: false,
        message: 'reportDate and format are required.',
      });
    }

    if (!['pdf', 'csv'].includes(format)) {
      return res.status(400).json({
        success: false,
        message: 'format must be either pdf or csv.',
      });
    }

    const [result] = await pool.query(
      `INSERT INTO report_exports (
        station_id,
        report_date,
        format,
        status,
        created_by,
        expires_at
      ) VALUES (?, ?, ?, 'pending', ?, DATE_ADD(NOW(), INTERVAL ? DAY))`,
      [stationId || null, reportDate, format, userId || null, EXPORT_TTL_DAYS]
    );

    let exportRecord;

    try {
      await processExportRequest(result.insertId);
      const [rows] = await pool.query(
        `SELECT 
          re.id,
          re.station_id,
          s.station_name,
          re.report_date,
          re.format,
          re.status,
          re.file_path,
          re.expires_at
        FROM report_exports re
        LEFT JOIN stations s ON re.station_id = s.id
        WHERE re.id = ?
        LIMIT 1`,
        [result.insertId]
      );
      exportRecord = rows[0];
    } catch (generationError) {
      console.error('Report export generation failed:', generationError);
      await pool.query(
        'UPDATE report_exports SET status = ? WHERE id = ?',
        ['failed', result.insertId]
      );
      return res.status(500).json({
        success: false,
        message: 'Export queued but generation failed. Please retry later.',
      });
    }

    return res.status(201).json({
      success: true,
      data: exportRecord,
    });
  } catch (error) {
    console.error('Create export request error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit export request.',
    });
  }
};

module.exports = {
  getStationPulseOverview,
  acknowledgeAlert,
  createExportRequest,
};
