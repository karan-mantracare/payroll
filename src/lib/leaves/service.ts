import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

export interface LeaveQuota {
  employeeId: string;
  employeeCode?: string;
  privilegeLeave: number;
  casualLeave: number;
  sickLeave: number;
  updatedAt?: number;
}

export interface Holiday {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: string;
  type: "Gazetted" | "Optional" | "Company Off";
  location: string;
  description?: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const QUOTAS_FILE = path.join(DATA_DIR, "leave-quotas.json");
const HOLIDAYS_FILE = path.join(DATA_DIR, "annual-holidays-2026.json");

function ensureDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getLeaveQuotas(): Record<string, LeaveQuota> {
  ensureDirectory();
  try {
    if (!fs.existsSync(QUOTAS_FILE)) {
      return {};
    }
    const raw = fs.readFileSync(QUOTAS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveLeaveQuotas(quotas: Record<string, LeaveQuota>) {
  ensureDirectory();
  fs.writeFileSync(QUOTAS_FILE, JSON.stringify(quotas, null, 2), "utf-8");
}

export function bulkUpdateLeaveQuotas(
  updates: Array<{
    employeeId: string;
    employeeCode?: string;
    privilegeLeave: number;
    casualLeave: number;
    sickLeave: number;
  }>
): Record<string, LeaveQuota> {
  const current = getLeaveQuotas();
  const now = Date.now();

  for (const item of updates) {
    current[item.employeeId] = {
      employeeId: item.employeeId,
      employeeCode: item.employeeCode || current[item.employeeId]?.employeeCode,
      privilegeLeave: Math.max(0, Number(item.privilegeLeave) || 0),
      casualLeave: Math.max(0, Number(item.casualLeave) || 0),
      sickLeave: Math.max(0, Number(item.sickLeave) || 0),
      updatedAt: now,
    };
  }

  saveLeaveQuotas(current);
  return current;
}

export function getHolidayCalendar(): Holiday[] {
  ensureDirectory();
  try {
    if (!fs.existsSync(HOLIDAYS_FILE)) {
      return [];
    }
    const raw = fs.readFileSync(HOLIDAYS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveHolidayCalendar(holidays: Holiday[]) {
  ensureDirectory();
  // Sort chronologically
  const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));
  fs.writeFileSync(HOLIDAYS_FILE, JSON.stringify(sorted, null, 2), "utf-8");
}

export function addHoliday(input: Omit<Holiday, "id">): Holiday {
  const holidays = getHolidayCalendar();
  const newHoliday: Holiday = {
    ...input,
    id: `hol_${randomUUID()}`,
  };
  holidays.push(newHoliday);
  saveHolidayCalendar(holidays);
  return newHoliday;
}

export function bulkImportHolidays(newItems: Array<Omit<Holiday, "id">>): Holiday[] {
  const current = getHolidayCalendar();
  const dateMap = new Map<string, Holiday>();

  // Keep existing
  for (const h of current) {
    dateMap.set(`${h.date}_${h.name.toLowerCase()}`, h);
  }

  // Add new
  for (const item of newItems) {
    const key = `${item.date}_${item.name.toLowerCase()}`;
    dateMap.set(key, {
      ...item,
      id: dateMap.get(key)?.id || `hol_${randomUUID()}`,
    });
  }

  const merged = Array.from(dateMap.values());
  saveHolidayCalendar(merged);
  return merged;
}

export function deleteHoliday(id: string): boolean {
  const current = getHolidayCalendar();
  const filtered = current.filter((h) => h.id !== id);
  if (filtered.length !== current.length) {
    saveHolidayCalendar(filtered);
    return true;
  }
  return false;
}
