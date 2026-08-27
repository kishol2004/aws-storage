/**
 * dateUtils.ts — Global Date, Timezone & Regional Formatter
 * Respects user preferences set in Settings (Date Format, Timezone, Display Language).
 */

export function getAppPreferences() {
  const language = localStorage.getItem('app_language') || 'en';
  const timezone = localStorage.getItem('app_timezone') || 'Asia/Kolkata';
  const dateFormat = localStorage.getItem('app_date_format') || 'DD/MM/YYYY';
  return { language, timezone, dateFormat };
}

export function formatAppDate(dateInput?: string | Date | number): string {
  if (!dateInput) return '-';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '-';

  const { dateFormat, timezone } = getAppPreferences();

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const parts = formatter.formatToParts(date);
    const partMap: Record<string, string> = {};
    parts.forEach((p) => {
      if (p.type !== 'literal') partMap[p.type] = p.value;
    });

    const day = partMap.day || '01';
    const month = partMap.month || '01';
    const year = partMap.year || '2026';

    if (dateFormat === 'MM/DD/YYYY') {
      return `${month}/${day}/${year}`;
    } else if (dateFormat === 'YYYY-MM-DD') {
      return `${year}-${month}-${day}`;
    } else {
      // Default: DD/MM/YYYY
      return `${day}/${month}/${year}`;
    }
  } catch {
    return date.toLocaleDateString();
  }
}

export function formatAppTime(dateInput?: string | Date | number): string {
  if (!dateInput) return '-';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '-';

  const { timezone } = getAppPreferences();

  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
