const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';
const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const formatDateString = (date) => dateFormatter.format(date);
const todayString = () => formatDateString(new Date());

const normalizeDateParam = (value) => {
  if (!value) {
    return todayString();
  }
  if (!DATE_REGEX.test(value)) {
    const error = new Error('date must be in YYYY-MM-DD format.');
    error.statusCode = 400;
    throw error;
  }
  return value;
};

const nextDateString = (value) => {
  const [year, month, day] = value.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + 1);
  return formatDateString(utcDate);
};

module.exports = {
  APP_TIMEZONE,
  DATE_REGEX,
  formatDateString,
  todayString,
  normalizeDateParam,
  nextDateString,
};
