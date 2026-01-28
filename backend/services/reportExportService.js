const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const pool = require('../config/db');

const EXPORT_DIR = path.join(__dirname, '..', 'exports');

async function ensureExportDir() {
  await fs.promises.mkdir(EXPORT_DIR, { recursive: true });
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  });
}

function csvEscape(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

async function fetchStationName(stationId) {
  if (!stationId) {
    return 'All Stations';
  }
  const [rows] = await pool.query(
    'SELECT station_name FROM stations WHERE id = ? LIMIT 1',
    [stationId],
  );
  if (!rows.length) {
    return 'Unknown Station';
  }
  return rows[0].station_name;
}

async function gatherReportData(reportDate, stationId) {
  const connection = await pool.getConnection();
  try {
    const stationFilter = stationId ? ' AND hl.station_id = ?' : '';
    const filterParams = stationId ? [reportDate, stationId] : [reportDate];

    const [cleaningLogs] = await connection.query(
      `SELECT 
        hl.date,
        hl.time,
        s.station_name,
        hl.cleaning_area,
        hl.cleaning_type,
        COALESCE(u.name, 'Unknown') AS performed_by,
        hl.remarks
      FROM housekeeping_logs hl
      LEFT JOIN stations s ON hl.station_id = s.id
      LEFT JOIN users u ON hl.user_id = u.id
      WHERE hl.date = ?${stationFilter}
      ORDER BY hl.time ASC`,
      filterParams,
    );

    const [chemicalUsage] = await connection.query(
      `SELECT 
        cu.usage_date,
        s.station_name,
        cu.chemical_name,
        cu.area,
        cu.shift,
        cu.quantity,
        cu.unit,
        cu.manpower_used
      FROM chemical_usage cu
      LEFT JOIN stations s ON cu.station_id = s.id
      WHERE cu.usage_date = ?${stationId ? ' AND cu.station_id = ?' : ''}
      ORDER BY cu.shift, cu.station_id`,
      filterParams,
    );

    const [staffRecords] = await connection.query(
      `SELECT 
        st.date,
        COALESCE(s.station_name, st.station_name) AS station_name,
        st.shift,
        st.manpower,
        st.number_of_persons
      FROM staff st
      LEFT JOIN stations s ON st.station_name = s.station_name
      WHERE st.date = ?${stationId ? ' AND s.id = ?' : ''}
      ORDER BY st.shift`,
      filterParams,
    );

    const [pestRecords] = await connection.query(
      `SELECT 
        COALESCE(pc.service_date, pc.date) AS service_date,
        s.station_name,
        pc.pest_type,
        pc.control_method,
        pc.chemical_used,
        pc.quantity_used,
        pc.measuring_unit,
        pc.area_covered
      FROM pest_control pc
      LEFT JOIN stations s ON pc.station_id = s.id
      WHERE (pc.service_date = ? OR (pc.service_date IS NULL AND pc.date = ?))${stationId ? ' AND pc.station_id = ?' : ''}
      ORDER BY service_date DESC`,
      stationId ? [reportDate, reportDate, stationId] : [reportDate, reportDate],
    );

    const totalChemicalQty = chemicalUsage.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const totalStaff = staffRecords.reduce((sum, row) => sum + Number(row.number_of_persons || 0), 0);

    return {
      summary: {
        stationName: stationId ? (await fetchStationName(stationId)) : 'All Stations',
        reportDate,
        cleaningActivities: cleaningLogs.length,
        chemicalEntries: chemicalUsage.length,
        chemicalQuantity: totalChemicalQty,
        staffEntries: staffRecords.length,
        totalPersons: totalStaff,
        pestIncidents: pestRecords.length,
      },
      cleaningLogs,
      chemicalUsage,
      staffRecords,
      pestRecords,
    };
  } finally {
    connection.release();
  }
}

async function writeCsv(filePath, dataset) {
  const lines = [];
  const { summary } = dataset;

  lines.push('Summary');
  lines.push('Metric,Value');
  lines.push(`Station,${csvEscape(summary.stationName)}`);
  lines.push(`Report Date,${csvEscape(summary.reportDate)}`);
  lines.push(`Cleaning Activities,${summary.cleaningActivities}`);
  lines.push(`Chemical Usage Records,${summary.chemicalEntries}`);
  lines.push(`Chemical Quantity Used,${formatNumber(summary.chemicalQuantity)}`);
  lines.push(`Staff Entries,${summary.staffEntries}`);
  lines.push(`Persons Deployed,${summary.totalPersons}`);
  lines.push(`Pest Incidents,${summary.pestIncidents}`);

  lines.push('');
  lines.push('Cleaning Logs');
  lines.push('Date,Time,Station,Area,Type,Performed By,Remarks');
  dataset.cleaningLogs.forEach((log) => {
    lines.push([
      csvEscape(log.date),
      csvEscape(log.time),
      csvEscape(log.station_name),
      csvEscape(log.cleaning_area),
      csvEscape(log.cleaning_type),
      csvEscape(log.performed_by),
      csvEscape(log.remarks || ''),
    ].join(','));
  });

  lines.push('');
  lines.push('Chemical Usage');
  lines.push('Date,Station,Chemical,Area,Shift,Quantity,Unit,Manpower');
  dataset.chemicalUsage.forEach((usage) => {
    lines.push([
      csvEscape(usage.usage_date),
      csvEscape(usage.station_name),
      csvEscape(usage.chemical_name),
      csvEscape(usage.area),
      csvEscape(usage.shift),
      csvEscape(formatNumber(usage.quantity)),
      csvEscape(usage.unit),
      csvEscape(usage.manpower_used || 0),
    ].join(','));
  });

  lines.push('');
  lines.push('Staff Deployment');
  lines.push('Date,Station,Shift,Manpower Label,Persons');
  dataset.staffRecords.forEach((record) => {
    lines.push([
      csvEscape(record.date),
      csvEscape(record.station_name),
      csvEscape(record.shift),
      csvEscape(record.manpower),
      csvEscape(record.number_of_persons),
    ].join(','));
  });

  lines.push('');
  lines.push('Pest Control');
  lines.push('Date,Station,Pest Type,Method,Chemical,Quantity,Unit,Area');
  dataset.pestRecords.forEach((activity) => {
    lines.push([
      csvEscape(activity.service_date),
      csvEscape(activity.station_name),
      csvEscape(activity.pest_type || activity.pest_control_type || 'N/A'),
      csvEscape(activity.control_method || 'N/A'),
      csvEscape(activity.chemical_used),
      csvEscape(formatNumber(activity.quantity_used)),
      csvEscape(activity.measuring_unit),
      csvEscape(activity.area_covered || 'N/A'),
    ].join(','));
  });

  await fs.promises.writeFile(filePath, lines.join('\n'), 'utf8');
}

async function writePdf(filePath, dataset) {
  await ensureExportDir();
  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36 });
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    doc.fontSize(18).text('Station Pulse Daily Digest', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Station: ${dataset.summary.stationName}`);
    doc.text(`Report Date: ${dataset.summary.reportDate}`);
    doc.moveDown();

    doc.fontSize(14).text('Summary', { underline: true });
    doc.fontSize(12);
    doc.text(`Cleaning Activities: ${dataset.summary.cleaningActivities}`);
    doc.text(`Chemical Usage Records: ${dataset.summary.chemicalEntries} (${formatNumber(dataset.summary.chemicalQuantity)} units)`);
    doc.text(`Staff Entries: ${dataset.summary.staffEntries} (${formatNumber(dataset.summary.totalPersons)} persons)`);
    doc.text(`Pest Incidents: ${dataset.summary.pestIncidents}`);
    doc.moveDown();

    const renderSection = (title, rows, renderRow) => {
      doc.moveDown();
      doc.fontSize(13).text(title, { underline: true });
      doc.moveDown(0.25);
      if (!rows.length) {
        doc.fontSize(11).text('No records for the selected date.');
        return;
      }
      rows.forEach((row) => {
        renderRow(row);
        doc.moveDown(0.35);
      });
    };

    renderSection('Cleaning Logs', dataset.cleaningLogs.slice(0, 25), (log) => {
      doc.fontSize(11).text(`${log.time} - ${log.station_name} - ${log.cleaning_area}`);
      doc.text(`Type: ${log.cleaning_type} | By: ${log.performed_by}`);
      if (log.remarks) {
        doc.text(`Notes: ${log.remarks}`);
      }
    });

    renderSection('Chemical Usage', dataset.chemicalUsage.slice(0, 25), (usage) => {
      doc.fontSize(11).text(`${usage.station_name} - ${usage.chemical_name} (${usage.unit})`);
      doc.text(`Area: ${usage.area} | Shift: ${usage.shift} | Quantity: ${formatNumber(usage.quantity)}`);
    });

    renderSection('Staff Deployment', dataset.staffRecords.slice(0, 25), (record) => {
      doc.fontSize(11).text(`${record.station_name} - ${record.shift}`);
      doc.text(`Manpower: ${record.manpower} | Persons: ${record.number_of_persons}`);
    });

    renderSection('Pest Control', dataset.pestRecords.slice(0, 25), (activity) => {
      doc.fontSize(11).text(`${activity.station_name} - ${activity.pest_type || 'Pest'}`);
      doc.text(`Method: ${activity.control_method || 'N/A'} | Chemical: ${activity.chemical_used}`);
      doc.text(`Quantity: ${formatNumber(activity.quantity_used)} ${activity.measuring_unit}`);
    });

    doc.end();

    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

async function writeArtifact(format, dataset, filePath) {
  await ensureExportDir();
  if (format === 'csv') {
    await writeCsv(filePath, dataset);
    return;
  }
  await writePdf(filePath, dataset);
}

async function processExportRequest(exportId) {
  const [rows] = await pool.query(
    `SELECT id, station_id, report_date, format
     FROM report_exports
     WHERE id = ?
     LIMIT 1`,
    [exportId],
  );

  if (!rows.length) {
    throw new Error('Export request not found.');
  }

  const record = rows[0];
  const dataset = await gatherReportData(record.report_date, record.station_id);
  const extension = record.format === 'pdf' ? 'pdf' : 'csv';
  const safeDate = record.report_date.replace(/[^0-9]/g, '');
  const fileName = `station-pulse-${record.id}-${safeDate}.${extension}`;
  const diskPath = path.join(EXPORT_DIR, fileName);
  const publicPath = `/exports/${fileName}`;

  try {
    await writeArtifact(record.format, dataset, diskPath);
    await pool.query(
      'UPDATE report_exports SET status = ?, file_path = ? WHERE id = ?',
      ['ready', publicPath, record.id],
    );
    return publicPath;
  } catch (error) {
    await pool.query(
      'UPDATE report_exports SET status = ? WHERE id = ?',
      ['failed', record.id],
    );
    throw error;
  }
}

module.exports = {
  processExportRequest,
};
