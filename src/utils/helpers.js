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
 * Returns the next working day (Monday-Friday) at 9:00 AM local time
 * from the given date. Used for "EOD" acknowledgment deadline.
 */
export const getNextWorkingDay9AM = (fromDate) => {
  const nextDay = new Date(fromDate);
  nextDay.setDate(nextDay.getDate() + 1);
  while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
    nextDay.setDate(nextDay.getDate() + 1);
  }
  nextDay.setHours(9, 0, 0, 0);
  return nextDay;
};
