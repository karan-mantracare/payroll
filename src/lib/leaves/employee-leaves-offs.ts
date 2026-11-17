import fs from "fs";
import path from "path";

export type DayOfWeek = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export interface EmployeeLeavesOffsSettings {
  employeeId: string;
  employeeCode?: string;
  workingDaysPerWeek: 5 | 6 | 7;
  weekOffCount: 1 | 2 | 3;
  weekOffDays: DayOfWeek[];
  weekOffException: "None" | DayOfWeek;
  shortLeaveAllowed: 1 | 2 | 3 | 4 | 5;
  graceTimeMinutes: number;
  updatedAt?: number;
  updatedBy?: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const SETTINGS_FILE = path.join(DATA_DIR, "employee-leaves-offs.json");

function ensureDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getAllEmployeeLeavesOffs(): Record<string, EmployeeLeavesOffsSettings> {
  ensureDirectory();
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      return {};
    }
    const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function getEmployeeLeavesOffs(
  employeeIdOrCode: string
): EmployeeLeavesOffsSettings {
  const all = getAllEmployeeLeavesOffs();
  
  // Try direct lookup by key (ID or code)
  if (all[employeeIdOrCode]) {
    return all[employeeIdOrCode];
  }

  // Try case-insensitive code or ID match
  const found = Object.values(all).find(
    (item) =>
      item.employeeId.toLowerCase() === employeeIdOrCode.toLowerCase() ||
      (item.employeeCode && item.employeeCode.toLowerCase() === employeeIdOrCode.toLowerCase())
  );

  if (found) {
    return found;
  }

  // Fallback defaults
  return {
    employeeId: employeeIdOrCode,
    workingDaysPerWeek: 5,
    weekOffCount: 2,
    weekOffDays: ["Sat", "Sun"],
    weekOffException: "None",
    shortLeaveAllowed: 2,
    graceTimeMinutes: 30,
  };
}

export function saveEmployeeLeavesOffs(
  employeeId: string,
  settings: Partial<EmployeeLeavesOffsSettings>,
  updatedBy?: string,
  employeeCode?: string
): EmployeeLeavesOffsSettings {
  ensureDirectory();
  const all = getAllEmployeeLeavesOffs();
  const current = getEmployeeLeavesOffs(employeeId);

  // Validate workingDaysPerWeek
  const workingDays = [5, 6, 7].includes(settings.workingDaysPerWeek as number)
    ? (settings.workingDaysPerWeek as 5 | 6 | 7)
    : current.workingDaysPerWeek;

  // Validate weekOffCount
  const weekOffCount = [1, 2, 3].includes(settings.weekOffCount as number)
    ? (settings.weekOffCount as 1 | 2 | 3)
    : current.weekOffCount;

  // Validate weekOffDays
  const validDays: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  let weekOffDays: DayOfWeek[] = Array.isArray(settings.weekOffDays)
    ? settings.weekOffDays.filter((d): d is DayOfWeek => validDays.includes(d))
    : current.weekOffDays;

  // Ensure unique and max length according to weekOffCount
  weekOffDays = Array.from(new Set(weekOffDays)).slice(0, weekOffCount);
  if (weekOffDays.length === 0) {
    weekOffDays = ["Sun"];
  }

  // Validate weekOffException
  const validExceptions = ["None", ...validDays];
  const weekOffException = validExceptions.includes(settings.weekOffException as string)
    ? (settings.weekOffException as "None" | DayOfWeek)
    : current.weekOffException;

  // Validate shortLeaveAllowed
  const shortLeaveAllowed = [1, 2, 3, 4, 5].includes(settings.shortLeaveAllowed as number)
    ? (settings.shortLeaveAllowed as 1 | 2 | 3 | 4 | 5)
    : current.shortLeaveAllowed;

  // Validate graceTimeMinutes
  const graceTimeMinutes = typeof settings.graceTimeMinutes === "number" && settings.graceTimeMinutes >= 0
    ? Math.min(120, Math.max(0, Math.round(settings.graceTimeMinutes)))
    : current.graceTimeMinutes;

  const updatedRecord: EmployeeLeavesOffsSettings = {
    employeeId,
    employeeCode: employeeCode || current.employeeCode,
    workingDaysPerWeek: workingDays,
    weekOffCount,
    weekOffDays,
    weekOffException,
    shortLeaveAllowed,
    graceTimeMinutes,
    updatedAt: Date.now(),
    updatedBy: updatedBy || "system",
  };

  all[employeeId] = updatedRecord;
  if (employeeCode && employeeCode !== employeeId) {
    all[employeeCode] = updatedRecord;
  }

  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(all, null, 2), "utf-8");
  return updatedRecord;
}
