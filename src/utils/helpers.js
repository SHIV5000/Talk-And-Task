// 🆕 ADDED: Global stripHtml function for cleaning text formatting
export const stripHtml = (html) => html ? String(html).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ') : '';

export const lockExtension = (originalName, newName) => {
  const originalExt = originalName.split('.').pop().toLowerCase();
  const baseName = newName.replace(/\.[^/.]+$/, '');
  return `${baseName}.${originalExt}`;
};

export const toSentenceCase = (str) => {
  if (!str) return "";
  return str.toLowerCase().replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase());
};

export const formatMessageText = (text) => {
  if (!text) return '';
  const safeText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return safeText
    .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/~(.*?)~/g, '<del>$1</del>')
    .replace(/\n/g, '<br/>');
};

export const EMOJI_LIST = ['😀','😂','🤣','😍','🥰','😘','😜','🤪','😎','🤩','😇','🙂','😊','🥳','😡','🤬','💀','👻','👍','👎','❤️','🔥','⭐','✨','🎉','💯','✅','❌','🤔','🙏','💪','🤝','👋','🙌','🤲','🫶','👀','🗣️','💬','📎','📌','🗑️','✏️','📷','🎵','🌈','🍕'];

/**
 * Formats a Date object or ISO string to DD-MMM-YY (e.g. 17-MAY-26)
 */
export const formatToDDMMMYY = (dateInput) => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-GB', { month: 'short' }).toUpperCase();
  const year = String(d.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
};

/**
 * Returns the next working day (Monday-Friday) at 9:00 AM local time
 * from the given date. Used for "EOD" acknowledgment deadline.
 */
export const getNextWorkingDay9AM = (fromDate = new Date()) => {
  const nextDate = new Date(fromDate);
  nextDate.setDate(nextDate.getDate() + 1);
  nextDate.setHours(9, 0, 0, 0);

  // If next day is Saturday (6), add 2 days to make it Monday
  if (nextDate.getDay() === 6) {
      nextDate.setDate(nextDate.getDate() + 2);
  }
  // If next day is Sunday (0), add 1 day to make it Monday
  else if (nextDate.getDay() === 0) {
      nextDate.setDate(nextDate.getDate() + 1);
  }
  return nextDate;
};
