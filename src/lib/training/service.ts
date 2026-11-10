import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

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
  moduleId: string;
  videoProgress: Record<string, number>; // videoId -> percent watched (0-100)
  videosFullyCompleted: boolean; // all parts reached 100%
  testCompleted: boolean;
  testScorePercent?: number;
  testPassed?: boolean;
  completedAt?: number;
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
  percent: number
): UserModuleProgress {
  const records = getProgressRecords();
  const key = `${userId}_${moduleId}`;
  const modules = getTrainingModules();
  const mod = modules.find((m) => m.id === moduleId);

  const current: UserModuleProgress = records[key] || {
    userId,
    moduleId,
    videoProgress: {},
    videosFullyCompleted: false,
    testCompleted: false,
  };

  current.videoProgress[videoId] = Math.max(current.videoProgress[videoId] || 0, Math.min(100, Math.round(percent)));

  if (mod && mod.videos.length > 0) {
    // Check if 100% logic is fulfilled for ALL video parts
    const all100 = mod.videos.every((v) => (current.videoProgress[v.id] || 0) >= 100);
    current.videosFullyCompleted = all100;
  }

  records[key] = current;
  saveProgressRecords(records);
  return current;
}
