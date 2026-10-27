/**
 * Visit reports (doctor, clinic, desk) cover up to 90 days. They used to stop at 2000
 * visits without saying so, which also made totals and earnings too low (FIX-051).
 * Now up to REPORT_MAX_ROWS visits are returned, and `truncated` tells the page when
 * there were more, so it can ask for fewer days.
 */
export const REPORT_MAX_ROWS = 20_000;

/** Ask the database for one row more than the limit, then call this. */
export const capReportRows = <T>(rows: T[]): { rows: T[]; truncated: boolean } => ({
  rows: rows.length > REPORT_MAX_ROWS ? rows.slice(0, REPORT_MAX_ROWS) : rows,
  truncated: rows.length > REPORT_MAX_ROWS,
});
