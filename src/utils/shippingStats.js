const pad = (value) => String(value).padStart(2, '0');

export const formatDateInputValue = (date) => (
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
);

export const getTodayDateValue = () => formatDateInputValue(new Date());

export const getStartOfMonthDateValue = () => {
  const now = new Date();
  return formatDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
};

export const parseDbTimestamp = (value) => {
  if (!value) return null;
  const parsed = new Date(typeof value === 'string' ? value.replace(' ', 'T') : value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getSentShippingDate = (shipping) => parseDbTimestamp(shipping?.edit || shipping?.date);

export const extractQuantityTotal = (value) => {
  const matches = String(value || '').match(/\d+(?:\.\d+)?/g);
  if (!matches) return 0;
  return matches.reduce((total, item) => total + Number(item), 0);
};

export const isDateWithinRange = (date, fromDate, toDate) => {
  if (!date) return false;

  const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
  const to = toDate ? new Date(`${toDate}T23:59:59.999`) : null;

  if (from && to && from > to) {
    return false;
  }

  if (from && date < from) {
    return false;
  }

  if (to && date > to) {
    return false;
  }

  return true;
};

export const calculateSentShippingTotal = (shippings, fromDate, toDate) => (
  shippings.reduce((total, shipping) => {
    if (shipping?.status !== 'đã gửi') {
      return total;
    }

    const sentDate = getSentShippingDate(shipping);
    if (!isDateWithinRange(sentDate, fromDate, toDate)) {
      return total;
    }

    return total + extractQuantityTotal(shipping.quantity);
  }, 0)
);

export const formatQuantityTotal = (value) => (
  Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '')
);
