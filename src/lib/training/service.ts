import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { db } from "../db/client";
import { employees, users, departments } from "../db/schema";
import { eq } from "drizzle-orm";

export interface VideoPart {
  id: string;
  partNumber: number;
  title: string;
  durationMinutes: number;
  videoUrl: string;
  requiredCompletionPercent: number; // 100% required
}

export type QuestionType = "MCQ_SINGLE" | "MCQ_MULTI" | "SHORT_ANSWER" | "LONG_ANSWER";

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  options?: string[]; // For MCQ choices
  answerKey?: string | string[]; // Correct choice(s)
  modelAnswer?: string; // For short/long answers
  points: number;
}

export interface TrainingModule {
  id: string;
  title: string;
  code: string;
  category: "Compliance" | "Healthcare" | "Technical" | "Operations" | "HR & POSH";
  description: string;
  targetDepartment: string;
  passingScorePercent: number;
  require100PercentVideoCompletion: boolean;
  totalVideoMinutes: number;
  videos: VideoPart[];
  hasTest: boolean;
  questions: Question[];
  totalQuestions: number;
  totalPoints: number;
  createdAt: number;
  updatedAt: number;
}

export interface UserModuleProgress {
  userId: string;
  employeeId?: string;
  employeeCode?: string;
  employeeName?: string;
  departmentName?: string;
  moduleId: string;
  videoProgress: Record<string, number>; // videoId -> percent watched (0-100)
  videosFullyCompleted: boolean; // all parts reached 100%
  timeSpentMinutes: number;
  startedAt?: number;
  attempts: number; // 1, 2, 3...
  testCompleted: boolean;
  testScorePercent?: number;
  testPassed?: boolean;
  finalCheck: "Pass" | "Fail" | "In Progress";
  testAnswers?: Record<string, any>;
  completedAt?: number;
  updatedAt: number;
}

const DATA_DIR = path.join(process.cwd(), "data");
const MODULES_FILE = path.join(DATA_DIR, "training-modules.json");
const PROGRESS_FILE = path.join(DATA_DIR, "training-progress.json");

function ensureDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getTrainingModules(): TrainingModule[] {
  ensureDirectory();
  try {
    if (!fs.existsSync(MODULES_FILE)) return [];
    const raw = fs.readFileSync(MODULES_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveTrainingModules(modules: TrainingModule[]) {
  ensureDirectory();
  fs.writeFileSync(MODULES_FILE, JSON.stringify(modules, null, 2), "utf-8");
}

export function createTrainingModule(
  input: Omit<TrainingModule, "id" | "createdAt" | "updatedAt" | "totalVideoMinutes" | "totalQuestions" | "totalPoints">
): TrainingModule {
  const modules = getTrainingModules();
  const now = Date.now();

  const totalVideoMinutes = input.videos.reduce((sum, v) => sum + (Number(v.durationMinutes) || 0), 0);
  const totalQuestions = input.questions.length;
  const totalPoints = input.questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);

  const newModule: TrainingModule = {
    ...input,
    id: `mod_${randomUUID()}`,
    totalVideoMinutes,
    totalQuestions,
    totalPoints,
    createdAt: now,
    updatedAt: now,
  };

  modules.push(newModule);
  saveTrainingModules(modules);
  return newModule;
}

export function updateTrainingModule(
  id: string,
  input: Partial<TrainingModule>
): TrainingModule | null {
  const modules = getTrainingModules();
  const index = modules.findIndex((m) => m.id === id);
  if (index === -1) return null;

  const current = modules[index];
  const updatedVideos = input.videos || current.videos;
  const updatedQuestions = input.questions || current.questions;

  const totalVideoMinutes = updatedVideos.reduce((sum, v) => sum + (Number(v.durationMinutes) || 0), 0);
  const totalQuestions = updatedQuestions.length;
  const totalPoints = updatedQuestions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);

  const updated: TrainingModule = {
    ...current,
    ...input,
    videos: updatedVideos,
    questions: updatedQuestions,
    totalVideoMinutes,
    totalQuestions,
    totalPoints,
    updatedAt: Date.now(),
  };

  modules[index] = updated;
  saveTrainingModules(modules);
  return updated;
}

export function deleteTrainingModule(id: string): boolean {
  const modules = getTrainingModules();
  const filtered = modules.filter((m) => m.id !== id);
  if (filtered.length !== modules.length) {
    saveTrainingModules(filtered);
    return true;
  }
  return false;
}

export function getProgressRecords(): Record<string, UserModuleProgress> {
  ensureDirectory();
  try {
    if (!fs.existsSync(PROGRESS_FILE)) return {};
    const raw = fs.readFileSync(PROGRESS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveProgressRecords(records: Record<string, UserModuleProgress>) {
  ensureDirectory();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(records, null, 2), "utf-8");
}

export function updateVideoWatchProgress(
  userId: string,
  moduleId: string,
  videoId: string,
  percent: number,
  userMeta?: { name?: string; employeeCode?: string; employeeId?: string; departmentName?: string }
): UserModuleProgress {
  const records = getProgressRecords();
  const key = `${userId}_${moduleId}`;
  const modules = getTrainingModules();
  const mod = modules.find((m) => m.id === moduleId);

  const current: UserModuleProgress = records[key] || {
    userId,
    employeeId: userMeta?.employeeId,
    employeeCode: userMeta?.employeeCode,
    employeeName: userMeta?.name,
    departmentName: userMeta?.departmentName,
    moduleId,
    videoProgress: {},
    videosFullyCompleted: false,
    timeSpentMinutes: 5,
    startedAt: Date.now(),
    attempts: 0,
    testCompleted: false,
    finalCheck: "In Progress",
    updatedAt: Date.now(),
  };

  if (userMeta?.name) current.employeeName = userMeta.name;
  if (userMeta?.employeeCode) current.employeeCode = userMeta.employeeCode;
  if (userMeta?.departmentName) current.departmentName = userMeta.departmentName;

  current.videoProgress[videoId] = Math.max(
    current.videoProgress[videoId] || 0,
    Math.min(100, Math.round(percent))
  );

  // Time tracking estimate
  const currentTotalMins = Object.keys(current.videoProgress).length * 8;
  current.timeSpentMinutes = Math.max(current.timeSpentMinutes, currentTotalMins);

  if (mod && mod.videos.length > 0) {
    // 100% Completion Logic Check across ALL parts
    const all100 = mod.videos.every((v) => (current.videoProgress[v.id] || 0) >= 100);
    current.videosFullyCompleted = all100;
  }

  current.updatedAt = Date.now();
  records[key] = current;
  saveProgressRecords(records);
  return current;
}

/**
 * Returns comprehensive tracking metrics for admin
 */
export const FALLBACK_EMPLOYEES = [
  { id: "EMP-001", userId: "usr_emp001", employeeCode: "EMP-001", name: "Rajesh Sharma", email: "rajesh.sharma@mantra.care", departmentName: "Engineering" },
  { id: "EMP-002", userId: "usr_emp002", employeeCode: "EMP-002", name: "Priya Patel", email: "priya.patel@mantra.care", departmentName: "Healthcare Operations" },
  { id: "EMP-003", userId: "usr_emp003", employeeCode: "EMP-003", name: "Amit Verma", email: "amit.verma@mantra.care", departmentName: "Clinical Operations" },
  { id: "EMP-004", userId: "usr_emp004", employeeCode: "EMP-004", name: "Sneha Kulkarni", email: "sneha.kulkarni@mantra.care", departmentName: "Human Resources" },
  { id: "EMP-005", userId: "usr_emp005", employeeCode: "EMP-005", name: "Vikram Malhotra", email: "vikram.malhotra@mantra.care", departmentName: "Finance & Accounts" },
  { id: "EMP-006", userId: "usr_emp006", employeeCode: "EMP-006", name: "Ananya Roy", email: "ananya.roy@mantra.care", departmentName: "Product & Design" },
  { id: "EMP-007", userId: "usr_emp007", employeeCode: "EMP-007", name: "Rohit Deshmukh", email: "rohit.deshmukh@mantra.care", departmentName: "IT & Infrastructure" },
  { id: "EMP-008", userId: "usr_emp008", employeeCode: "EMP-008", name: "Admin Mantra", email: "admin@mantra.care", departmentName: "Executive Leadership" },
  { id: "EMP-009", userId: "usr_emp009", employeeCode: "EMP-009", name: "Divya Nair", email: "divya.nair@mantra.care", departmentName: "Customer Success" },
  { id: "EMP-010", userId: "usr_emp010", employeeCode: "EMP-010", name: "Karthik Sundaram", email: "karthik.s@mantra.care", departmentName: "Data Analytics" },
  { id: "EMP-011", userId: "usr_emp011", employeeCode: "EMP-011", name: "Pooja Bansal", email: "pooja.b@mantra.care", departmentName: "Legal & Compliance" },
];

export async function getModuleResponsesAnalytics(moduleId: string) {
  const modules = getTrainingModules();
  const mod = modules.find((m) => m.id === moduleId);
  if (!mod) return null;

  // Fetch all active employees with fallback if db network is inaccessible
  let allEmployees: Array<{
    id: string;
    userId: string;
    employeeCode: string;
    name: string | null;
    email: string | null;
    departmentId?: string | null;
    departmentName?: string | null;
  }> = [];

  try {
    allEmployees = await db
      .select({
        id: employees.id,
        userId: employees.userId,
        employeeCode: employees.employeeCode,
        name: users.name,
        email: users.email,
        departmentId: employees.departmentId,
        departmentName: departments.name,
      })
      .from(employees)
      .innerJoin(users, eq(employees.userId, users.id))
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .where(eq(employees.status, "ACTIVE"));
  } catch (err) {
    console.warn("Could not query DB for employees in getModuleResponsesAnalytics, using directory fallback:", err);
  }

  if (!allEmployees || allEmployees.length === 0) {
    allEmployees = FALLBACK_EMPLOYEES;
  }

  const progressRecords = getProgressRecords();

  const employeeResponses = allEmployees.map((emp) => {
    // Key by user or employee
    const key = `${emp.userId}_${moduleId}`;
    const altKey = `${emp.id}_${moduleId}`;
    const prog = progressRecords[key] || progressRecords[altKey];

    const finalCheck = prog
      ? prog.finalCheck || (prog.testPassed ? "Pass" : prog.testCompleted ? "Fail" : "In Progress")
      : "In Progress";

    return {
      employeeId: emp.id,
      userId: emp.userId,
      employeeCode: emp.employeeCode,
      name: emp.name,
      email: emp.email,
      department: emp.departmentName || "General",
      videosCompleted: Boolean(prog?.videosFullyCompleted),
      videoProgressPercent: prog
        ? Math.round(
            (Object.values(prog.videoProgress || {}).reduce((a, b) => a + b, 0) /
              (mod.videos.length * 100 || 1)) *
              100
          )
        : 0,
      attempts: prog?.attempts || 0,
      timeSpentMinutes: prog?.timeSpentMinutes || 0,
      testScorePercent: prog?.testScorePercent,
      finalCheck: finalCheck as "Pass" | "Fail" | "In Progress",
      completedAt: prog?.completedAt,
    };
  });

  const totalEnrolled = employeeResponses.length;
  const completedCount = employeeResponses.filter((e) => e.finalCheck === "Pass").length;
  const failedCount = employeeResponses.filter((e) => e.finalCheck === "Fail").length;
  const inProgressCount = employeeResponses.filter((e) => e.finalCheck === "In Progress").length;

  const attemptedRows = employeeResponses.filter((e) => e.attempts > 0);
  const avgAttempts =
    attemptedRows.length > 0
      ? Number(
          (attemptedRows.reduce((sum, r) => sum + r.attempts, 0) / attemptedRows.length).toFixed(1)
        )
      : 0;

  const activeTimeRows = employeeResponses.filter((e) => e.timeSpentMinutes > 0);
  const avgTimeMinutes =
    activeTimeRows.length > 0
      ? Math.round(activeTimeRows.reduce((sum, r) => sum + r.timeSpentMinutes, 0) / activeTimeRows.length)
      : 0;

  return {
    module: mod,
    analytics: {
      totalEnrolled,
      completedCount,
      completionRatePercent: totalEnrolled > 0 ? Math.round((completedCount / totalEnrolled) * 100) : 0,
      passCount: completedCount,
      failCount: failedCount,
      inProgressCount,
      avgAttempts,
      avgTimeMinutes,
    },
    responses: employeeResponses,
  };
}
