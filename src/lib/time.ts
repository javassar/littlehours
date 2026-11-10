/**
 * Time and date formatting helpers for Little Hours
 */

/**
 * Format a Date object to "2:30 PM" in the user's local timezone.
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * Format duration between two dates into a clean human string, e.g. "45m" or "1h 30m".
 */
export function formatDuration(start: Date, end: Date): string {
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return '0m';

  const totalMinutes = Math.round(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }
  if (minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}m`;
}

/**
 * Format the window start label above the text box:
 * - "Since 2:30 PM" (if today)
 * - "Since yesterday, 10:30 PM" (if yesterday)
 * - "Since Monday, 10:30 PM" (if within last 6 days)
 * - "Since Nov 8, 10:30 PM" (if older)
 */
export function formatWindowSince(startDate: Date, relativeTo: Date = new Date()): string {
  const timeStr = formatTime(startDate);

  // Compare calendar days in local time
  const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const todayDay = new Date(relativeTo.getFullYear(), relativeTo.getMonth(), relativeTo.getDate());
  
  const diffDays = Math.round((todayDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Since ${timeStr}`;
  }
  if (diffDays === 1) {
    return `Since yesterday, ${timeStr}`;
  }
  if (diffDays > 1 && diffDays < 7) {
    const weekday = startDate.toLocaleDateString([], { weekday: 'long' });
    return `Since ${weekday}, ${timeStr}`;
  }

  const monthDay = startDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `Since ${monthDay}, ${timeStr}`;
}

/**
 * Convert a Date object to a string suitable for HTML <input type="datetime-local" />
 * Format: "YYYY-MM-DDTHH:mm" (in local time)
 */
export function toDateTimeLocalValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Parse a "YYYY-MM-DDTHH:mm" string back to a local Date object.
 */
export function fromDateTimeLocalValue(str: string): Date {
  const [datePart, timePart] = str.split('T');
  if (!datePart || !timePart) return new Date();

  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);

  return new Date(year, month - 1, day, hours, minutes);
}
