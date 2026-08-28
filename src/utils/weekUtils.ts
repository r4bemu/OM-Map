import type { FieldReport } from '../types.js';

export interface FridayWeekInfo {
  key: string;            // e.g. '2026-08-W4'
  year: number;           // Year of the Friday (e.g. 2026)
  monthNumber: number;    // 1-12 (Month of the Friday)
  monthName: string;      // e.g. 'August'
  shortMonthName: string; // e.g. 'Aug'
  weekNumber: number;     // 1 to 5 (Friday index in month)
  label: string;          // e.g. 'August 2026 - Week 4 (Aug 22 – Aug 28, 2026)'
  shortLabel: string;     // e.g. 'Aug 2026 W4'
  startDate: string;      // e.g. 'Aug 22, 2026' (Saturday)
  endDate: string;        // e.g. 'Aug 28, 2026' (Friday)
  fullPeriod: string;     // e.g. 'August 22, 2026 – August 28, 2026'
  startSaturday: Date;    // Saturday 00:00:00.000
  endFriday: Date;        // Friday 23:59:59.999
  isCurrentWeek?: boolean;
  isPrevWeek?: boolean;
}

// Backward-compatible alias for existing imports
export type IsoWeekInfo = FridayWeekInfo;

/**
 * Calculates NIA Friday-Ending Weekly Division info from a date.
 *
 * Rules:
 * 1. Each work week runs from Saturday 00:00:00 to Friday 23:59:59.
 * 2. The Friday is the cut-off / credit day for all accomplishments.
 * 3. The entire week belongs to the month in which its Friday falls.
 *    (e.g., if a Friday falls in the 1st week of a month but preceding Saturday–Thursday
 *     were in the previous month, all accomplishments fall on W1 of the current month).
 * 4. Week numbering in month:
 *    - 1st Friday of the month (Days 1–7)   -> Week 1 (W1)
 *    - 2nd Friday of the month (Days 8–14)  -> Week 2 (W2)
 *    - 3rd Friday of the month (Days 15–21) -> Week 3 (W3)
 *    - 4th Friday of the month (Days 22–28) -> Week 4 (W4)
 *    - 5th Friday of the month (Days 29–31) -> Week 5 (W5)
 */
export function getFridayEndingWeekInfo(dInput?: Date | string | number): FridayWeekInfo {
  const d = dInput ? new Date(dInput) : new Date();
  const validDate = isNaN(d.getTime()) ? new Date() : d;

  const currentYear = validDate.getFullYear();
  const currentMonth = validDate.getMonth();
  const currentDate = validDate.getDate();
  const currentDay = validDate.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat

  // Days to add to reach the Friday of this work week:
  // Sat (6) -> +6 days
  // Sun (0) -> +5 days
  // Mon (1) -> +4 days
  // Tue (2) -> +3 days
  // Wed (3) -> +2 days
  // Thu (4) -> +1 day
  // Fri (5) -> +0 days
  const daysToFriday = (5 - currentDay + 7) % 7;

  // Friday of this work week (End of week / cut-off):
  const friday = new Date(currentYear, currentMonth, currentDate + daysToFriday);
  friday.setHours(23, 59, 59, 999);

  // Saturday of this work week (Start of week):
  const saturday = new Date(friday.getFullYear(), friday.getMonth(), friday.getDate() - 6);
  saturday.setHours(0, 0, 0, 0);

  // The week is credited to the Friday's month & year
  const targetYear = friday.getFullYear();
  const targetMonth = friday.getMonth(); // 0-indexed
  const targetMonthNum = targetMonth + 1; // 1-12
  const fridayDateNum = friday.getDate(); // 1-31

  // Friday week number within the month:
  const weekNumber = Math.ceil(fridayDateNum / 7);

  const monthName = friday.toLocaleDateString('en-US', { month: 'long' });
  const shortMonthName = friday.toLocaleDateString('en-US', { month: 'short' });

  const satShort = saturday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const friShort = friday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const satLong = saturday.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const friLong = friday.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const key = `${targetYear}-${String(targetMonthNum).padStart(2, '0')}-W${weekNumber}`;
  const label = `${monthName} ${targetYear} - Week ${weekNumber} (${satShort} – ${friShort})`;
  const shortLabel = `${shortMonthName} ${targetYear} W${weekNumber}`;

  // Check if current or prev week relative to today
  const now = new Date();
  const nowDay = now.getDay();
  const nowDaysToFriday = (5 - nowDay + 7) % 7;
  const nowFriday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + nowDaysToFriday);
  nowFriday.setHours(23, 59, 59, 999);

  const prevFriday = new Date(nowFriday.getFullYear(), nowFriday.getMonth(), nowFriday.getDate() - 7);
  prevFriday.setHours(23, 59, 59, 999);

  const isCurrentWeek = friday.toDateString() === nowFriday.toDateString();
  const isPrevWeek = friday.toDateString() === prevFriday.toDateString();

  return {
    key,
    year: targetYear,
    monthNumber: targetMonthNum,
    monthName,
    shortMonthName,
    weekNumber,
    label,
    shortLabel,
    startDate: satShort,
    endDate: friShort,
    fullPeriod: `${satLong} – ${friLong}`,
    startSaturday: saturday,
    endFriday: friday,
    isCurrentWeek,
    isPrevWeek
  };
}

// Retain getIsoWeekInfo as an alias pointing to the Friday-ending calculation
export function getIsoWeekInfo(dInput?: Date | string | number): FridayWeekInfo {
  return getFridayEndingWeekInfo(dInput);
}

/**
 * Returns week info for the current work week (Saturday to Friday).
 */
export function getCurrentWeekInfo(): FridayWeekInfo {
  return getFridayEndingWeekInfo(new Date());
}

/**
 * Returns week info for the previous work week (Saturday to Friday).
 */
export function getPreviousWeekInfo(): FridayWeekInfo {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return getFridayEndingWeekInfo(d);
}

/**
 * Extracts and sorts all unique Friday-ending week keys and objects present in a list of field reports.
 */
export function getAvailableWeeksFromReports(reports: FieldReport[]): FridayWeekInfo[] {
  const map = new Map<string, FridayWeekInfo>();

  (reports || []).forEach(r => {
    if (!r || !r.createdAt) return;
    const week = getFridayEndingWeekInfo(r.createdAt);
    if (!map.has(week.key)) {
      map.set(week.key, week);
    }
  });

  // Always ensure current week and previous week are present in available list
  const cur = getCurrentWeekInfo();
  if (!map.has(cur.key)) map.set(cur.key, cur);

  const prev = getPreviousWeekInfo();
  if (!map.has(prev.key)) map.set(prev.key, prev);

  return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
}

/**
 * Checks whether a given report or date belongs to a specific Friday-ending week key (e.g. '2026-08-W4').
 * Also supports legacy ISO keys (e.g. '2026-W34') and 'current' / 'current-week'.
 */
export function isReportInWeek(report: FieldReport, weekKey: string): boolean {
  if (!report || !report.createdAt || !weekKey) return false;
  if (weekKey === 'all' || weekKey === 'All') return true;

  const repWeek = getFridayEndingWeekInfo(report.createdAt);
  if (repWeek.key === weekKey) return true;

  // Handle current week shortcuts
  if (weekKey === 'current' || weekKey.endsWith('-current')) {
    return Boolean(repWeek.isCurrentWeek);
  }

  // Handle legacy ISO week matching fallback if legacy key passed
  const d = new Date(report.createdAt);
  if (!isNaN(d.getTime())) {
    const dateCopy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = dateCopy.getUTCDay() || 7;
    dateCopy.setUTCDate(dateCopy.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(dateCopy.getUTCFullYear(), 0, 1));
    const isoWeekNo = Math.ceil((((dateCopy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    const legacyKey = `${dateCopy.getUTCFullYear()}-W${String(isoWeekNo).padStart(2, '0')}`;
    if (legacyKey === weekKey) return true;
  }

  return false;
}
