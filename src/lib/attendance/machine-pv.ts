import { AttendanceImportRow } from "./service";

export interface PVPunchItem {
  employeeCode: string;
  timestampStr: string;
  timeZoneStr: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  timeMs: number; // epoch ms
  isoUtc: string; // UTC ISO string
}

export interface ParsedDailyPunchSummary {
  employeeCode: string;
  date: string; // YYYY-MM-DD
  checkInTime?: string;
  checkOutTime?: string;
  totalWorkMinutes: number;
  status: "PRESENT" | "HALF_DAY" | "ABSENT";
  notes: string;
  punchCount: number;
}

/**
 * Resolves timezone offset in minutes from UTC for a given date and timezone string.
 * Negative number means ahead of UTC (e.g. Asia/Kolkata +05:30 -> -330 min difference UTC - local).
 */
export function resolveTimezoneOffsetMinutes(date: Date, tzStr?: string): number {
  if (!tzStr) return -330; // Default Mantra Care IST: UTC+5:30 -> offset -330 min (UTC is 5h 30m behind IST)
  const trimmed = tzStr.trim();
  const lower = trimmed.toLowerCase();
  if (lower === "utc" || lower === "z" || lower === "gmt") return 0;
  if (lower === "ist" || lower === "asia/kolkata" || lower === "asia/calcutta") return -330;

  // If numeric offset pattern: +05:30, +0530, -04:00, etc.
  const match = trimmed.match(/^([+-])(\d{1,2}):?(\d{2})?$/);
  if (match) {
    const sign = match[1] === "+" ? -1 : 1;
    const h = parseInt(match[2], 10);
    const m = match[3] ? parseInt(match[3], 10) : 0;
    return sign * (h * 60 + m);
  }

  // Try IANA timezone identifier via Intl
  try {
    const utcDate = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
    const tzDate = new Date(date.toLocaleString("en-US", { timeZone: trimmed }));
    return (utcDate.getTime() - tzDate.getTime()) / 60000;
  } catch {
    return -330; // Default fallback to Asia/Kolkata IST
  }
}

/**
 * Parses timestamp string into normalized date (YYYY-MM-DD), time (HH:mm), epoch ms, and UTC ISO string.
 * Supports:
 * - YYYY-MM-DD HH:mm:ss
 * - YYYY-MM-DDTHH:mm:ss
 * - DD-MM-YYYY HH:mm:ss
 * - DD/MM/YYYY HH:mm:ss
 * - YYYY/MM/DD HH:mm:ss
 */
export function parsePunchTimestamp(
  rawTimestamp: string,
  rawTimeZone?: string
): { date: string; time: string; timeMs: number; isoUtc: string } | null {
  const trimmed = rawTimestamp.trim();
  if (!trimmed) return null;

  let year = "";
  let month = "";
  let day = "";
  let hours = "";
  let minutes = "";
  let seconds = "00";

  // Try ISO format with T
  if (trimmed.includes("T")) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const pad = (n: number) => String(n).padStart(2, "0");
      const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      return { date, time, timeMs: d.getTime(), isoUtc: d.toISOString() };
    }
  }

  // Split date part and time part
  const spaceParts = trimmed.split(/\s+/);
  if (spaceParts.length < 2) {
    // Single string without space, maybe ISO or just date
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const pad = (n: number) => String(n).padStart(2, "0");
      return {
        date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
        timeMs: d.getTime(),
        isoUtc: d.toISOString(),
      };
    }
    return null;
  }

  const datePart = spaceParts[0];
  const timePart = spaceParts[1];

  // Parse Date Part
  if (datePart.includes("-")) {
    const parts = datePart.split("-");
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      year = parts[0];
      month = parts[1].padStart(2, "0");
      day = parts[2].padStart(2, "0");
    } else if (parts[2]?.length === 4) {
      // DD-MM-YYYY
      day = parts[0].padStart(2, "0");
      month = parts[1].padStart(2, "0");
      year = parts[2];
    }
  } else if (datePart.includes("/")) {
    const parts = datePart.split("/");
    if (parts[0].length === 4) {
      // YYYY/MM/DD
      year = parts[0];
      month = parts[1].padStart(2, "0");
      day = parts[2].padStart(2, "0");
    } else if (parts[2]?.length === 4) {
      // DD/MM/YYYY
      day = parts[0].padStart(2, "0");
      month = parts[1].padStart(2, "0");
      year = parts[2];
    }
  }

  // Parse Time Part
  const timeParts = timePart.split(":");
  if (timeParts.length >= 2) {
    hours = timeParts[0].padStart(2, "0");
    minutes = timeParts[1].padStart(2, "0");
    if (timeParts[2]) {
      seconds = timeParts[2].split(".")[0].padStart(2, "0");
    }
  }

  if (!year || !month || !day || !hours || !minutes) {
    return null;
  }

  // Validate numeric ranges
  const yNum = Number(year);
  const mNum = Number(month);
  const dNum = Number(day);
  const hNum = Number(hours);
  const minNum = Number(minutes);

  if (
    isNaN(yNum) || yNum < 2020 || yNum > 2050 ||
    isNaN(mNum) || mNum < 1 || mNum > 12 ||
    isNaN(dNum) || dNum < 1 || dNum > 31 ||
    isNaN(hNum) || hNum < 0 || hNum > 23 ||
    isNaN(minNum) || minNum < 0 || minNum > 59
  ) {
    return null;
  }

  const date = `${year}-${month}-${day}`;
  const time = `${hours}:${minutes}`;

  const naiveUtc = new Date(Date.UTC(yNum, mNum - 1, dNum, hNum, minNum, parseInt(seconds, 10)));
  const offsetMinutes = resolveTimezoneOffsetMinutes(naiveUtc, rawTimeZone);
  const timeMs = naiveUtc.getTime() + offsetMinutes * 60000;
  const isoUtc = new Date(timeMs).toISOString();

  return { date, time, timeMs, isoUtc };
}

/**
 * Parses raw Machine 1 - PV punch text into daily attendance rows.
 * Format: Employee Code - Time Stamp - Time Zone
 * Delimiters supported: ' - ', ',', '\t', ';'
 *
 * Rules:
 * 1. Minimum punch time of the day = in-time.
 * 2. Maximum punch time of the day = out-time.
 * 3. If either in-time or out-time is missing (e.g. only 1 punch) -> 'Entry Missing', count as HALF_DAY.
 * 4. If both are present but duration < 4 hrs 30 min (270 min) -> count as ABSENT (OFF).
 */
export function parseMachinePVRawData(rawText: string): {
  rows: AttendanceImportRow[];
  summaries: ParsedDailyPunchSummary[];
  totalPunches: number;
  skippedLines: number;
  invalidLines: Array<{ line: number; employeeCode: string; error: string }>;
} {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const punches: PVPunchItem[] = [];
  const invalidLines: Array<{ line: number; employeeCode: string; error: string }> = [];
  let skippedLines = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Determine delimiter
    let parts: string[] = [];
    if (line.includes(" - ")) {
      parts = line.split(" - ").map((p) => p.trim());
    } else if (line.includes("\t")) {
      parts = line.split("\t").map((p) => p.trim());
    } else if (line.includes(",")) {
      parts = line.split(",").map((p) => p.trim());
    } else if (line.includes(";")) {
      parts = line.split(";").map((p) => p.trim());
    } else {
      // Try multiple space splitting
      parts = line.split(/\s{2,}/).map((p) => p.trim());
    }

    if (parts.length < 2) {
      skippedLines++;
      continue;
    }

    const employeeCode = parts[0]?.trim();
    const timestampStr = parts[1]?.trim();
    const timeZoneStr = parts[2]?.trim() || "Asia/Kolkata";

    // Skip header lines
    const codeLower = employeeCode.toLowerCase();
    const timeLower = timestampStr.toLowerCase();
    if (
      codeLower.includes("employee") ||
      codeLower.includes("emp code") ||
      timeLower.includes("time") ||
      timeLower.includes("stamp")
    ) {
      continue;
    }

    const parsedTime = parsePunchTimestamp(timestampStr, timeZoneStr);
    if (!parsedTime) {
      invalidLines.push({
        line: i + 1,
        employeeCode,
        error: `Invalid timestamp '${timestampStr}'. Expected YYYY-MM-DD HH:mm:ss (e.g. 2026-11-01 09:05:00)`,
      });
      skippedLines++;
      continue;
    }

    punches.push({
      employeeCode,
      timestampStr,
      timeZoneStr,
      date: parsedTime.date,
      time: parsedTime.time,
      timeMs: parsedTime.timeMs,
      isoUtc: parsedTime.isoUtc,
    });
  }

  // Group punches by Employee Code + Date
  const grouped: Record<string, Record<string, PVPunchItem[]>> = {};
  for (const punch of punches) {
    if (!grouped[punch.employeeCode]) {
      grouped[punch.employeeCode] = {};
    }
    if (!grouped[punch.employeeCode][punch.date]) {
      grouped[punch.employeeCode][punch.date] = [];
    }
    grouped[punch.employeeCode][punch.date].push(punch);
  }

  const summaries: ParsedDailyPunchSummary[] = [];
  const rows: AttendanceImportRow[] = [];

  for (const [employeeCode, datesObj] of Object.entries(grouped)) {
    for (const [date, dayPunches] of Object.entries(datesObj)) {
      // Sort ascending by epoch time
      dayPunches.sort((a, b) => a.timeMs - b.timeMs);

      const firstPunch = dayPunches[0];
      const lastPunch = dayPunches[dayPunches.length - 1];

      // Check if punches are distinct (more than 1 minute apart)
      const isSinglePunch =
        dayPunches.length === 1 ||
        lastPunch.timeMs - firstPunch.timeMs < 60 * 1000;

      if (isSinglePunch) {
        // Either in-time or out-time is missing:
        // Update entry as 'Entry Missing' and count that day as Half Day
        const inTime = firstPunch.time;
        const inTimeUtc = firstPunch.isoUtc;
        const notes = `Entry Missing (Single punch at ${inTime}) - Counted as Half Day`;

        summaries.push({
          employeeCode,
          date,
          checkInTime: inTime,
          checkOutTime: undefined,
          totalWorkMinutes: 240, // 4 hours attributed for half day
          status: "HALF_DAY",
          notes,
          punchCount: dayPunches.length,
        });

        rows.push({
          employeeCode,
          date,
          checkInTime: inTimeUtc,
          checkOutTime: undefined,
          status: "HALF_DAY",
          notes,
        });
      } else {
        // Both in-time and out-time present
        const inTime = firstPunch.time;
        const outTime = lastPunch.time;
        const inTimeUtc = firstPunch.isoUtc;
        const outTimeUtc = lastPunch.isoUtc;
        const durationMinutes = Math.floor(
          (lastPunch.timeMs - firstPunch.timeMs) / (60 * 1000)
        );

        const hours = Math.floor(durationMinutes / 60);
        const mins = durationMinutes % 60;

        // Deduction Rule: If intime and out time both are mentioned but less than 4 hrs 30 min (270 min) -> consider it OFF (ABSENT)
        if (durationMinutes < 270) {
          const notes = `Duration ${hours}h ${mins}m (< 4h 30m) - Counted as Off`;

          summaries.push({
            employeeCode,
            date,
            checkInTime: inTime,
            checkOutTime: outTime,
            totalWorkMinutes: durationMinutes,
            status: "ABSENT",
            notes,
            punchCount: dayPunches.length,
          });

          rows.push({
            employeeCode,
            date,
            checkInTime: inTimeUtc,
            checkOutTime: outTimeUtc,
            status: "ABSENT",
            notes,
          });
        } else {
          // Normal attendance (4h 30m or more) -> PRESENT
          const notes = `Machine 1 - PV: In ${inTime}, Out ${outTime} (${dayPunches.length} punches, ${hours}h ${mins}m)`;

          summaries.push({
            employeeCode,
            date,
            checkInTime: inTime,
            checkOutTime: outTime,
            totalWorkMinutes: durationMinutes,
            status: "PRESENT",
            notes,
            punchCount: dayPunches.length,
          });

          rows.push({
            employeeCode,
            date,
            checkInTime: inTimeUtc,
            checkOutTime: outTimeUtc,
            status: "PRESENT",
            notes,
          });
        }
      }
    }
  }

  // Sort rows chronologically by date and employee code
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.employeeCode.localeCompare(b.employeeCode));
  summaries.sort((a, b) => a.date.localeCompare(b.date) || a.employeeCode.localeCompare(b.employeeCode));

  return {
    rows,
    summaries,
    totalPunches: punches.length,
    skippedLines,
    invalidLines,
  };
}
