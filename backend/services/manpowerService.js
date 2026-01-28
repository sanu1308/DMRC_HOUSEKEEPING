const MIN_STATION_MANPOWER = 20;

class ManpowerValidationError extends Error {
  constructor(message, statusCode = 400, code = 'MANPOWER_VALIDATION_ERROR') {
    super(message);
    this.name = 'ManpowerValidationError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

const SECTION_TYPES = {
  CHEMICAL: 'chemical',
  MACHINERY: 'machinery',
  PEST: 'pest',
};

async function ensureStationAllocation(connection, stationId) {
  const [rows] = await connection.query(
    'SELECT station_id, total_manpower, supervisors, technicians, cleaners, notes FROM station_manpower WHERE station_id = ?',
    [stationId],
  );

  if (!rows.length) {
    const [stationRows] = await connection.query(
      'SELECT id, station_name FROM stations WHERE id = ?',
      [stationId],
    );

    if (!stationRows.length) {
      throw new ManpowerValidationError(
        `Station ${stationId} not found while preparing manpower allocation.`,
        404,
        'STATION_NOT_FOUND',
      );
    }

    const autoNote = 'Auto-generated default allocation (20) to unblock daily submissions.';
    await connection.query(
      `INSERT INTO station_manpower (station_id, total_manpower, supervisors, technicians, cleaners, notes)
       VALUES (?, ?, 0, 0, 0, ?)
       ON DUPLICATE KEY UPDATE total_manpower = GREATEST(VALUES(total_manpower), total_manpower), updated_at = CURRENT_TIMESTAMP`,
      [stationId, MIN_STATION_MANPOWER, autoNote],
    );

    return {
      station_id: stationId,
      total_manpower: MIN_STATION_MANPOWER,
      supervisors: 0,
      technicians: 0,
      cleaners: 0,
      notes: autoNote,
    };
  }

  const allocation = rows[0];
  if (allocation.total_manpower < MIN_STATION_MANPOWER) {
    await connection.query(
      'UPDATE station_manpower SET total_manpower = ?, updated_at = CURRENT_TIMESTAMP WHERE station_id = ?',
      [MIN_STATION_MANPOWER, stationId],
    );
    allocation.total_manpower = MIN_STATION_MANPOWER;
  }

  return allocation;
}

async function reserveSectionManpower(connection, {
  stationId,
  section,
  usageDate,
  manpowerUsed,
  sourceType,
  sourceRecordId,
  userId,
}) {
  if (!Number.isInteger(manpowerUsed) || manpowerUsed <= 0) {
    throw new ManpowerValidationError('manpower_used must be a positive integer.', 400, 'INVALID_MANPOWER_VALUE');
  }

  let allocation;
  try {
    allocation = await ensureStationAllocation(connection, stationId);
  } catch (error) {
    if (
      error instanceof ManpowerValidationError &&
      (error.code === 'NO_ALLOCATION' || error.code === 'ALLOCATION_BELOW_MIN')
    ) {
      console.warn(
        `[manpower] ${error.message} (station_id=${stationId}). Skipping manpower ledger tracking for this record.`,
      );
      return { tracked: false, reason: error.message };
    }
    throw error;
  }

  const [usageRows] = await connection.query(
    'SELECT COALESCE(SUM(manpower_used), 0) AS used FROM section_manpower_usage WHERE station_id = ? AND section = ? AND usage_date = ?',
    [stationId, section, usageDate],
  );

  const alreadyUsed = Number(usageRows[0]?.used || 0);

  const totalAllocation = Number(allocation.total_manpower);

  if (alreadyUsed + manpowerUsed > totalAllocation) {
    throw new ManpowerValidationError(
      `Manpower usage (${alreadyUsed + manpowerUsed}) exceeds the allocated limit (${totalAllocation}) for this station on ${usageDate}.`,
      400,
      'USAGE_LIMIT_EXCEEDED',
    );
  }

  await connection.query(
    `INSERT INTO section_manpower_usage (station_id, section, usage_date, manpower_used, source_type, source_record_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [stationId, section, usageDate, manpowerUsed, sourceType, sourceRecordId, userId],
  );

  return { tracked: true };
}

async function releaseSectionManpower(connection, sourceType, sourceRecordId) {
  await connection.query(
    'DELETE FROM section_manpower_usage WHERE source_type = ? AND source_record_id = ?',
    [sourceType, sourceRecordId],
  );
}

module.exports = {
  SECTION_TYPES,
  MIN_STATION_MANPOWER,
  ManpowerValidationError,
  ensureStationAllocation,
  reserveSectionManpower,
  releaseSectionManpower,
};
