// Static shifts list for staff dashboard usage.
// No database changes required for shifts themselves.

const SHIFTS = [
  {
    id: 1,
    name: 'Morning',
    start_time: '06:00',
    end_time: '14:00'
  },
  {
    id: 2,
    name: 'Evening',
    start_time: '14:00',
    end_time: '22:00'
  },
  {
    id: 3,
    name: 'Night',
    start_time: '22:00',
    end_time: '06:00'
  }
];

/**
 * Get list of available shifts
 * GET /api/shifts
 */
const getShifts = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: SHIFTS
  });
};

module.exports = {
  getShifts
};
