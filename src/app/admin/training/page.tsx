"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  GraduationCap,
  Plus,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  HelpCircle,
  FileText,
  Trash2,
  Loader2,
  Check,
  Award,
  Video,
  ListOrdered,
  Sparkles,
  Layers,
  Eye,
  ShieldCheck,
  KeyRound,
  X,
  Users,
  Search,
  Download,
  RotateCcw,
} from "lucide-react";
import { useAuth } from "@/components/AuthGate";

interface VideoPart {
  id: string;
  partNumber: number;
  title: string;
  durationMinutes: number;
  videoUrl: string;
  requiredCompletionPercent: number;
}

type QuestionType = "MCQ_SINGLE" | "MCQ_MULTI" | "SHORT_ANSWER" | "LONG_ANSWER";

interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  options?: string[];
  answerKey?: string | string[];
  modelAnswer?: string;
  points: number;
}

interface TrainingModule {
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

export default function AdminTrainingPage() {
  const { user } = useAuth();
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // ==========================================
  // ADD MODULE MODAL STATE
  // ==========================================
  const [showAddModal, setShowAddModal] = useState(false);
  const [savingModule, setSavingModule] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<"info" | "videos" | "test">("info");

  const [formTitle, setFormTitle] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formCategory, setFormCategory] = useState<any>("Compliance");
  const [formDescription, setFormDescription] = useState("");
  const [formTargetDept, setFormTargetDept] = useState("All Departments");
  const [formPassingScore, setFormPassingScore] = useState(80);
  const [formRequire100Video, setFormRequire100Video] = useState(true);

  // Video Parts List
  const [formVideos, setFormVideos] = useState<VideoPart[]>([
    {
      id: "v_1",
      partNumber: 1,
      title: "Part 1: Introduction & Fundamentals",
      durationMinutes: 15,
      videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      requiredCompletionPercent: 100,
    },
  ]);

  // Test Questions List
  const [formHasTest, setFormHasTest] = useState(true);
  const [formQuestions, setFormQuestions] = useState<Question[]>([
    {
      id: "q_1",
      type: "MCQ_SINGLE",
      prompt: "What is the primary compliance requirement discussed in this module?",
      options: [
        "Adhering to statutory data encryption and authorization policies",
        "Bypassing internal security audits",
        "Disabling system authentication",
        "Sharing passwords over email",
      ],
      answerKey: "Adhering to statutory data encryption and authorization policies",
      points: 10,
    },
  ]);

  // ==========================================
  // PREVIEW & TEST SIMULATION MODAL
  // ==========================================
  const [previewModule, setPreviewModule] = useState<TrainingModule | null>(null);
  const [previewActiveTab, setPreviewActiveTab] = useState<"videos" | "test">("videos");
  const [selectedVideoPart, setSelectedVideoPart] = useState<VideoPart | null>(null);
  const [simulatedProgress, setSimulatedProgress] = useState<Record<string, number>>({});
  const [testAnswers, setTestAnswers] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<any>(null);
  const [submittingTest, setSubmittingTest] = useState(false);

  // ==========================================
  // TRACK RESPONSES & ANALYTICS STATE
  // ==========================================
  const [showTrackerModal, setShowTrackerModal] = useState(false);
  const [trackingModule, setTrackingModule] = useState<TrainingModule | null>(null);
  const [trackerLoading, setTrackerLoading] = useState(false);
  const [trackerAnalytics, setTrackerAnalytics] = useState<{
    totalEnrolled: number;
    completedCount: number;
    completionRatePercent: number;
    passCount: number;
    failCount: number;
    inProgressCount: number;
    avgAttempts: number;
    avgTimeMinutes: number;
  } | null>(null);
  const [trackerResponses, setTrackerResponses] = useState<Array<{
    employeeId: string;
    userId: string;
    employeeCode: string;
    name: string;
    email: string;
    department: string;
    videosCompleted: boolean;
    videoProgressPercent: number;
    attempts: number;
    timeSpentMinutes: number;
    testScorePercent?: number;
    finalCheck: "Pass" | "Fail" | "In Progress";
    completedAt?: number;
  }>>([]);
  const [trackerSearch, setTrackerSearch] = useState("");
  const [trackerFilter, setTrackerFilter] = useState<"ALL" | "Pass" | "Fail" | "In Progress">("ALL");

  const handleOpenTracker = async (mod: TrainingModule) => {
    setTrackingModule(mod);
    setShowTrackerModal(true);
    setTrackerLoading(true);
    setTrackerSearch("");
    setTrackerFilter("ALL");

    try {
      const res = await fetch(`/payrol/api/training/responses?moduleId=${mod.id}`);
      if (res.ok) {
        const data = await res.json();
        setTrackerAnalytics(data.analytics || null);
        setTrackerResponses(data.responses || []);
      }
    } catch (err) {
      console.error("Failed to load tracking analytics:", err);
    } finally {
      setTrackerLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!trackingModule || trackerResponses.length === 0) return;
    const headers = [
      "Employee Code",
      "Name",
      "Department",
      "Email",
      "Videos Completed (100%)",
      "Video Watch %",
      "Attempts",
      "Time Spent (Mins)",
      "Test Score %",
      "Final Check",
      "Completed At",
    ];

    const rows = trackerResponses.map((r) => [
      `"${r.employeeCode}"`,
      `"${r.name || ""}"`,
      `"${r.department}"`,
      `"${r.email || ""}"`,
      r.videosCompleted ? "Yes" : "No",
      `${r.videoProgressPercent}%`,
      r.attempts,
      `${r.timeSpentMinutes} mins`,
      r.testScorePercent !== undefined ? `${r.testScorePercent}%` : "N/A",
      r.finalCheck,
      r.completedAt ? new Date(r.completedAt).toISOString().split("T")[0] : "N/A",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `training_responses_${trackingModule.code}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Fetch modules
  const fetchModules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/payrol/api/training/modules");
      if (res.ok) {
        const json = await res.json();
        setModules(json.modules || []);
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  // ==========================================
  // VIDEO PARTS HELPERS
  // ==========================================
  const handleAddVideoPart = () => {
    const nextPartNum = formVideos.length + 1;
    setFormVideos([
      ...formVideos,
      {
        id: `v_${Date.now()}`,
        partNumber: nextPartNum,
        title: `Part ${nextPartNum}: Advanced Concepts`,
        durationMinutes: 15,
        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
        requiredCompletionPercent: 100,
      },
    ]);
  };

  const handleRemoveVideoPart = (id: string) => {
    if (formVideos.length === 1) return;
    const remaining = formVideos.filter((v) => v.id !== id);
    const renumbered = remaining.map((v, idx) => ({ ...v, partNumber: idx + 1 }));
    setFormVideos(renumbered);
  };

  const handleUpdateVideoPart = (id: string, field: keyof VideoPart, value: any) => {
    setFormVideos(
      formVideos.map((v) => (v.id === id ? { ...v, [field]: value } : v))
    );
  };

  const calculatedTotalVideoMinutes = formVideos.reduce(
    (sum, v) => sum + (Number(v.durationMinutes) || 0),
    0
  );

  // ==========================================
  // QUESTIONS HELPERS
  // ==========================================
  const handleAddQuestion = (type: QuestionType = "MCQ_SINGLE") => {
    const nextQ: Question = {
      id: `q_${Date.now()}`,
      type,
      prompt: `New Question ${formQuestions.length + 1}`,
      options:
        type === "MCQ_SINGLE" || type === "MCQ_MULTI"
          ? ["Option A", "Option B", "Option C", "Option D"]
          : undefined,
      answerKey: type === "MCQ_SINGLE" ? "Option A" : undefined,
      points: 10,
    };
    setFormQuestions([...formQuestions, nextQ]);
  };

  const handleRemoveQuestion = (id: string) => {
    setFormQuestions(formQuestions.filter((q) => q.id !== id));
  };

  const handleUpdateQuestion = (id: string, field: keyof Question, value: any) => {
    setFormQuestions(
      formQuestions.map((q) => (q.id === id ? { ...q, [field]: value } : q))
    );
  };

  // ==========================================
  // SUBMIT ADD MODULE
  // ==========================================
  const handleCreateModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formCode.trim()) {
      alert("Please provide both Module Title and Track Code");
      return;
    }

    setSavingModule(true);
    try {
      const res = await fetch("/payrol/api/training/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle,
          code: formCode,
          category: formCategory,
          description: formDescription,
          targetDepartment: formTargetDept,
          passingScorePercent: formPassingScore,
          require100PercentVideoCompletion: formRequire100Video,
          videos: formVideos,
          hasTest: formHasTest,
          questions: formQuestions,
        }),
      });

      if (res.ok) {
        setShowAddModal(false);
        setToastMessage(`Module "${formTitle}" created successfully!`);
        setTimeout(() => setToastMessage(null), 3500);
        await fetchModules();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create module");
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingModule(false);
    }
  };

  // ==========================================
  // DELETE MODULE
  // ==========================================
  const handleDeleteModule = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete module "${title}"?`)) return;

    try {
      const res = await fetch(`/payrol/api/training/modules?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setToastMessage(`Deleted module "${title}"`);
        setTimeout(() => setToastMessage(null), 3000);
        await fetchModules();
      }
    } catch {
      // ignore
    }
  };

  // ==========================================
  // PREVIEW SIMULATION HELPERS
  // ==========================================
  const handleOpenPreview = (mod: TrainingModule) => {
    setPreviewModule(mod);
    setPreviewActiveTab("videos");
    setSelectedVideoPart(mod.videos[0] || null);
    setSimulatedProgress({});
    setTestAnswers({});
    setTestResult(null);
  };

  const handleSimulateWatch = (videoId: string, targetPercent: number) => {
    setSimulatedProgress((prev) => ({
      ...prev,
      [videoId]: targetPercent,
    }));
  };

  const areAllVideosCompleted = previewModule
    ? previewModule.videos.every((v) => (simulatedProgress[v.id] || 0) >= 100)
    : false;

  const handleSimulateSubmitTest = async () => {
    if (!previewModule) return;
    setSubmittingTest(true);

    try {
      const res = await fetch("/payrol/api/training/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SUBMIT_TEST",
          moduleId: previewModule.id,
          testAnswers,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setTestResult(data);
      } else {
        alert(data.error || "Test submission failed");
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingTest(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header with Add Module Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#293381] dark:text-white tracking-tight flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-[#36B4FF]" />
            Training Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Corporate training tracks, part-wise videos with 100% completion tracking, and assessment tests.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* THE "ADD MODULE" BUTTON */}
          <button
            onClick={() => {
              setActiveModalTab("info");
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#293381] hover:bg-[#1F2664] text-white font-semibold text-xs transition shadow-sm"
          >
            <Plus className="w-4 h-4 text-[#36B4FF]" />
            Add Module
          </button>
        </div>
      </div>

      {toastMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {toastMessage}
        </div>
      )}

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-card">
          <span className="text-xs font-semibold text-slate-500">Active Modules</span>
          <div className="text-2xl font-bold text-[#293381] dark:text-white mt-1">
            {modules.length}
          </div>
          <span className="text-[11px] text-slate-400">Published corporate tracks</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-card">
          <span className="text-xs font-semibold text-slate-500">Part-Wise Video Lessons</span>
          <div className="text-2xl font-bold text-[#36B4FF] mt-1">
            {modules.reduce((sum, m) => sum + m.videos.length, 0)} <span className="text-xs text-slate-400 font-normal">Parts</span>
          </div>
          <span className="text-[11px] text-slate-400">Total video chapters</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-card">
          <span className="text-xs font-semibold text-slate-500">Total Video Content</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {modules.reduce((sum, m) => sum + m.totalVideoMinutes, 0)} <span className="text-xs text-slate-400 font-normal">Mins</span>
          </div>
          <span className="text-[11px] text-slate-400">Streamable curriculum length</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-card">
          <span className="text-xs font-semibold text-slate-500">Video Completion Rule</span>
          <div className="text-base font-bold text-[#293381] dark:text-white mt-2 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            100% Required
          </div>
          <span className="text-[11px] text-slate-400">Videos must be completed 100%</span>
        </div>
      </div>

      {/* Training Modules Cards Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#293381] dark:text-slate-400">
            Training Modules & Learning Pathways ({modules.length})
          </h2>
          <span className="text-xs text-slate-400 hidden sm:inline">
            Click &quot;Preview Module&quot; to test video tracking and question keys
          </span>
        </div>

        {loading ? (
          <div className="p-16 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
            <Loader2 className="w-6 h-6 animate-spin text-[#293381] mx-auto" />
            <p className="text-xs text-slate-400 mt-2">Loading training modules...</p>
          </div>
        ) : modules.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
            No training modules added yet. Click &quot;Add Module&quot; to create your first curriculum!
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {modules.map((mod) => (
              <div
                key={mod.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-card hover:border-[#36B4FF] transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-[#293381] dark:bg-blue-950/60 dark:text-[#36B4FF] border border-blue-200 dark:border-blue-800">
                        {mod.code}
                      </span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {mod.category}
                      </span>
                    </div>

                    <span className="text-[11px] text-slate-400 font-medium">
                      Target: {mod.targetDepartment}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-base font-bold text-[#293381] dark:text-white leading-tight">
                      {mod.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                      {mod.description}
                    </p>
                  </div>

                  {/* Training Videos Section Summary */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-[#293381] dark:text-white">
                        <Video className="w-4 h-4 text-[#36B4FF]" />
                        <span>Training Videos ({mod.videos.length} Parts • {mod.totalVideoMinutes} Mins Total)</span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                        <Check className="w-3 h-3 text-emerald-600" /> 100% Watch Logic Active
                      </span>
                    </div>

                    {/* Part pills */}
                    <div className="flex flex-wrap gap-1.5">
                      {mod.videos.map((v) => (
                        <span
                          key={v.id}
                          className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-mono text-slate-600 dark:text-slate-300"
                        >
                          Part {v.partNumber}: {v.durationMinutes}m
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Test Section Summary */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-[#293381] dark:text-white">
                        <HelpCircle className="w-4 h-4 text-purple-600" />
                        <span>Assessment Test ({mod.totalQuestions} Questions • {mod.totalPoints} Pts)</span>
                      </div>
                      <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800">
                        Pass: {mod.passingScorePercent}%
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                      <span>Answer Keys Configured for Automated Grading</span>
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <button
                    onClick={() => handleDeleteModule(mod.id, mod.title)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                    title="Delete Module"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenPreview(mod)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#293381]/10 hover:bg-[#293381]/20 text-[#293381] dark:text-[#36B4FF] text-xs font-semibold transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Preview
                    </button>

                    <button
                      onClick={() => handleOpenTracker(mod)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#293381] hover:bg-[#1F2664] text-white text-xs font-semibold transition shadow-sm"
                    >
                      <Users className="w-3.5 h-3.5" />
                      Track Responses
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: ADD TRAINING MODULE (WITH VIDEOS & TEST TABS)     */}
      {/* ========================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#293381] text-white flex items-center justify-center shadow-sm">
                  <GraduationCap className="w-5 h-5 text-[#36B4FF]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#293381] dark:text-white">
                    Add New Training Module
                  </h3>
                  <p className="text-xs text-slate-400">
                    Configure part-wise videos with 100% completion tracking and test questions with answer keys.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Step Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveModalTab("info")}
                className={`py-3 px-4 border-b-2 transition flex items-center gap-1.5 ${
                  activeModalTab === "info"
                    ? "border-[#293381] text-[#293381] dark:border-[#36B4FF] dark:text-[#36B4FF]"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <FileText className="w-4 h-4" /> 1. Module Info
              </button>

              <button
                type="button"
                onClick={() => setActiveModalTab("videos")}
                className={`py-3 px-4 border-b-2 transition flex items-center gap-1.5 ${
                  activeModalTab === "videos"
                    ? "border-[#293381] text-[#293381] dark:border-[#36B4FF] dark:text-[#36B4FF]"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Video className="w-4 h-4" /> 2. Training Videos ({formVideos.length} Parts • {calculatedTotalVideoMinutes}m)
              </button>

              <button
                type="button"
                onClick={() => setActiveModalTab("test")}
                className={`py-3 px-4 border-b-2 transition flex items-center gap-1.5 ${
                  activeModalTab === "test"
                    ? "border-[#293381] text-[#293381] dark:border-[#36B4FF] dark:text-[#36B4FF]"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <HelpCircle className="w-4 h-4" /> 3. Test & Answer Keys ({formQuestions.length} Qs)
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateModule} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {/* TAB 1: BASIC INFO */}
              {activeModalTab === "info" && (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Module Title *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. HIPAA & Patient Data Security (2026)"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Track Code *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. COMP-101"
                        value={formCode}
                        onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Category
                      </label>
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value as any)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                      >
                        <option value="Compliance">Compliance & Security</option>
                        <option value="Healthcare">Healthcare & Clinical</option>
                        <option value="Technical">Technical & Engineering</option>
                        <option value="Operations">Operations & Payroll</option>
                        <option value="HR & POSH">HR & POSH Policy</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Target Department
                      </label>
                      <input
                        type="text"
                        placeholder="All Departments or specific"
                        value={formTargetDept}
                        onChange={(e) => setFormTargetDept(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Module Overview / Description
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Explain the objectives, regulatory citations, and learning takeaways..."
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Test Passing Score (%)
                      </label>
                      <input
                        type="number"
                        min="50"
                        max="100"
                        value={formPassingScore}
                        onChange={(e) => setFormPassingScore(parseInt(e.target.value) || 80)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-[#293381] dark:text-[#36B4FF]"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-5">
                      <input
                        type="checkbox"
                        id="req100"
                        checked={formRequire100Video}
                        onChange={(e) => setFormRequire100Video(e.target.checked)}
                        className="rounded text-[#293381]"
                      />
                      <label htmlFor="req100" className="font-semibold text-slate-700 dark:text-slate-300">
                        Require 100% Video Watch Completion
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: TRAINING VIDEOS (PART WISE & TOTAL) */}
              {activeModalTab === "videos" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900">
                    <div>
                      <span className="font-bold text-[#293381] dark:text-[#36B4FF]">
                        Total Video Curriculum: {formVideos.length} Part(s) • {calculatedTotalVideoMinutes} Minutes Total
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        100% completion tracking is enforced across each part to unlock the final test.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddVideoPart}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#293381] hover:bg-[#1F2664] text-white font-semibold text-xs shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Video Part
                    </button>
                  </div>

                  {formVideos.map((part, idx) => (
                    <div
                      key={part.id}
                      className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 relative"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#293381] dark:text-[#36B4FF]">
                          Part {part.partNumber}
                        </span>
                        {formVideos.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveVideoPart(part.id)}
                            className="text-slate-400 hover:text-rose-600 transition"
                            title="Remove Part"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Part Title *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder={`e.g. Part ${part.partNumber}: Core Architecture`}
                            value={part.title}
                            onChange={(e) =>
                              handleUpdateVideoPart(part.id, "title", e.target.value)
                            }
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Duration (Mins) *
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="240"
                            required
                            value={part.durationMinutes}
                            onChange={(e) =>
                              handleUpdateVideoPart(
                                part.id,
                                "durationMinutes",
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono font-bold"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Video Stream URL / Embed Link *
                        </label>
                        <input
                          type="url"
                          required
                          placeholder="https://commondatastorage.googleapis.com/.../video.mp4"
                          value={part.videoUrl}
                          onChange={(e) =>
                            handleUpdateVideoPart(part.id, "videoUrl", e.target.value)
                          }
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono text-[11px]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 3: TEST QUESTIONS & ANSWER KEYS */}
              {activeModalTab === "test" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-950/40 rounded-xl border border-purple-100 dark:border-purple-900">
                    <div>
                      <span className="font-bold text-purple-900 dark:text-purple-300">
                        Assessment Test ({formQuestions.length} Questions Configured)
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Answer keys are mandatory for MCQ questions to power instant automated grading.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddQuestion("MCQ_SINGLE")}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#293381] hover:bg-[#1F2664] text-white font-semibold text-xs shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add MCQ
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddQuestion("SHORT_ANSWER")}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-purple-300 bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 font-semibold text-xs shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Short Answer
                      </button>
                    </div>
                  </div>

                  {formQuestions.map((q, qIdx) => (
                    <div
                      key={q.id}
                      className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 relative"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          Question {qIdx + 1} ({q.type === "MCQ_SINGLE" ? "MCQ Single Choice" : q.type === "SHORT_ANSWER" ? "Short Answer" : "Descriptive"})
                        </span>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-500 font-mono">10 Points</span>
                          {formQuestions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveQuestion(q.id)}
                              className="text-slate-400 hover:text-rose-600 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Question Prompt *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Under HIPAA, what is the maximum reporting delay for a PHI breach?"
                          value={q.prompt}
                          onChange={(e) => handleUpdateQuestion(q.id, "prompt", e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                        />
                      </div>

                      {/* If MCQ: Options & Answer Key */}
                      {q.type === "MCQ_SINGLE" && q.options && (
                        <div className="space-y-2 pt-1">
                          <label className="block font-semibold text-slate-700 dark:text-slate-300">
                            Options & Answer Key (Select the correct answer key):
                          </label>
                          <div className="space-y-2">
                            {q.options.map((opt, optIdx) => (
                              <div key={optIdx} className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`ak_${q.id}`}
                                  checked={q.answerKey === opt && opt.length > 0}
                                  onChange={() => handleUpdateQuestion(q.id, "answerKey", opt)}
                                  className="text-[#293381] cursor-pointer"
                                  title="Mark as correct answer key"
                                />
                                <input
                                  type="text"
                                  value={opt}
                                  placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                                  onChange={(e) => {
                                    const nextOpts = [...(q.options || [])];
                                    const oldVal = nextOpts[optIdx];
                                    nextOpts[optIdx] = e.target.value;
                                    handleUpdateQuestion(q.id, "options", nextOpts);
                                    if (q.answerKey === oldVal) {
                                      handleUpdateQuestion(q.id, "answerKey", e.target.value);
                                    }
                                  }}
                                  className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                                />
                                {q.answerKey === opt && opt.length > 0 && (
                                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200">
                                    Correct Key
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* If Short Answer: Model Key */}
                      {q.type === "SHORT_ANSWER" && (
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Model Answer / Grading Rubric (Answer Key)
                          </label>
                          <textarea
                            rows={2}
                            placeholder="Key criteria or explanation required in student answer..."
                            value={q.modelAnswer || ""}
                            onChange={(e) =>
                              handleUpdateQuestion(q.id, "modelAnswer", e.target.value)
                            }
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Modal Footer Controls */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  {activeModalTab !== "info" && (
                    <button
                      type="button"
                      onClick={() =>
                        setActiveModalTab(activeModalTab === "test" ? "videos" : "info")
                      }
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs"
                    >
                      ← Previous Step
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50 text-xs font-semibold"
                  >
                    Cancel
                  </button>

                  {activeModalTab !== "test" ? (
                    <button
                      type="button"
                      onClick={() =>
                        setActiveModalTab(activeModalTab === "info" ? "videos" : "test")
                      }
                      className="px-4 py-2 rounded-lg bg-[#293381] hover:bg-[#1F2664] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
                    >
                      Next Step →
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={savingModule}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
                    >
                      {savingModule && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Publish Training Module
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: PREVIEW MODULE (VIDEO TRACKING & TEST KEY DEMO)   */}
      {/* ========================================================= */}
      {previewModule && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-[#36B4FF]">
                  {previewModule.code} • Preview & Logic Simulator
                </span>
                <h3 className="text-base font-bold text-[#293381] dark:text-white">
                  {previewModule.title}
                </h3>
              </div>
              <button
                onClick={() => setPreviewModule(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Switcher: Videos vs Test */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPreviewActiveTab("videos")}
                className={`py-3 px-4 border-b-2 transition flex items-center gap-1.5 ${
                  previewActiveTab === "videos"
                    ? "border-[#293381] text-[#293381] dark:border-[#36B4FF] dark:text-[#36B4FF]"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Video className="w-4 h-4" /> Part-Wise Videos ({previewModule.videos.length})
                {areAllVideosCompleted ? (
                  <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-full text-[10px]">
                    100% Watched
                  </span>
                ) : (
                  <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded-full text-[10px]">
                    In Progress
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!areAllVideosCompleted) {
                    alert("Logic Enforcement: You must complete 100% of all video parts before taking the test!");
                  } else {
                    setPreviewActiveTab("test");
                  }
                }}
                className={`py-3 px-4 border-b-2 transition flex items-center gap-1.5 ${
                  previewActiveTab === "test"
                    ? "border-[#293381] text-[#293381] dark:border-[#36B4FF] dark:text-[#36B4FF]"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <HelpCircle className="w-4 h-4" /> Assessment Test ({previewModule.totalQuestions} Qs)
                {!areAllVideosCompleted && (
                  <span className="text-[10px] text-slate-400 font-mono">(Locked until 100% video completion)</span>
                )}
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {/* VIDEO PLAYER PREVIEW */}
              {previewActiveTab === "videos" && selectedVideoPart && (
                <div className="space-y-4">
                  {/* Part Selector Pills */}
                  <div className="flex gap-2 flex-wrap">
                    {previewModule.videos.map((v) => {
                      const p = simulatedProgress[v.id] || 0;
                      return (
                        <button
                          key={v.id}
                          onClick={() => setSelectedVideoPart(v)}
                          className={`px-3 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-2 ${
                            selectedVideoPart.id === v.id
                              ? "bg-[#293381] text-white border-[#293381]"
                              : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          <span>Part {v.partNumber}: {v.durationMinutes}m</span>
                          {p >= 100 ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <span className="font-mono text-[10px] opacity-80">{p}%</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Video Player Display Container */}
                  <div className="bg-black rounded-2xl overflow-hidden aspect-video flex flex-col items-center justify-center relative shadow-lg">
                    <Video className="w-12 h-12 text-[#36B4FF] opacity-60 mb-2" />
                    <span className="text-white font-bold text-sm">
                      {selectedVideoPart.title}
                    </span>
                    <span className="text-slate-400 font-mono text-xs mt-1">
                      {selectedVideoPart.durationMinutes} Mins • 100% Required Watch Time
                    </span>

                    {/* Progress overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                      <div className="flex items-center justify-between text-white text-xs mb-1.5 font-mono">
                        <span>Progress: {simulatedProgress[selectedVideoPart.id] || 0}%</span>
                        <span>{(simulatedProgress[selectedVideoPart.id] || 0) >= 100 ? "✓ 100% Completed" : "Watching..."}</span>
                      </div>
                      <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full transition-all duration-300"
                          style={{ width: `${simulatedProgress[selectedVideoPart.id] || 0}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 100% Simulation Controls */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="font-bold text-[#293381] dark:text-white">
                        Video Progress Tracker Logic:
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Employees must finish 100% of this video part. Quick actions below simulate tracking:
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSimulateWatch(selectedVideoPart.id, 50)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white dark:bg-slate-900 text-xs font-semibold"
                      >
                        Set 50%
                      </button>
                      <button
                        onClick={() => handleSimulateWatch(selectedVideoPart.id, 100)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm inline-flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> Complete 100%
                      </button>
                    </div>
                  </div>

                  {areAllVideosCompleted && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center justify-between font-semibold">
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        All {previewModule.videos.length} video parts completed at 100%! Assessment Test is now unlocked.
                      </span>
                      <button
                        onClick={() => setPreviewActiveTab("test")}
                        className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs hover:bg-emerald-700 font-bold"
                      >
                        Take Test Now →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TEST & ANSWER KEY PREVIEW */}
              {previewActiveTab === "test" && (
                <div className="space-y-4">
                  <div className="p-3 bg-purple-50 dark:bg-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-800">
                    <span className="font-bold text-purple-900 dark:text-purple-300">
                      Module Assessment Test (Passing Score: {previewModule.passingScorePercent}%)
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Select answers and submit to verify automated evaluation using the stored answer keys.
                    </p>
                  </div>

                  {previewModule.questions.map((q, idx) => (
                    <div
                      key={q.id}
                      className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-slate-800 dark:text-white">
                          {idx + 1}. {q.prompt}
                        </span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white dark:bg-slate-900 border">
                          {q.points} Pts
                        </span>
                      </div>

                      {q.options && (
                        <div className="space-y-1.5 pt-1">
                          {q.options.map((opt, optIdx) => (
                            <label
                              key={optIdx}
                              className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition ${
                                testAnswers[q.id] === opt
                                  ? "bg-blue-50 border-[#293381] text-[#293381] font-semibold dark:bg-blue-950/50 dark:text-[#36B4FF]"
                                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              <input
                                type="radio"
                                name={`test_${q.id}`}
                                value={opt}
                                checked={testAnswers[q.id] === opt}
                                onChange={() =>
                                  setTestAnswers({ ...testAnswers, [q.id]: opt })
                                }
                                className="text-[#293381]"
                              />
                              <span>{opt}</span>
                            </label>
                          ))}
                        </div>
                      )}

                      {q.type === "SHORT_ANSWER" && (
                        <textarea
                          rows={2}
                          placeholder="Type your response here..."
                          value={testAnswers[q.id] || ""}
                          onChange={(e) =>
                            setTestAnswers({ ...testAnswers, [q.id]: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                        />
                      )}

                      {/* Display Answer Key Indicator for Admin */}
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Configured Answer Key: <strong>{q.answerKey || q.modelAnswer}</strong></span>
                      </div>
                    </div>
                  ))}

                  {/* Submit Test Button */}
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleSimulateSubmitTest}
                      disabled={submittingTest}
                      className="px-5 py-2.5 rounded-xl bg-[#293381] hover:bg-[#1F2664] text-white font-bold text-xs shadow-sm inline-flex items-center gap-2"
                    >
                      {submittingTest && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Submit Test for Automated Grading
                    </button>
                  </div>

                  {/* Test Evaluation Feedback */}
                  {testResult && (
                    <div
                      className={`p-4 rounded-xl border space-y-2 ${
                        testResult.passed
                          ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                          : "bg-rose-50 border-rose-200 text-rose-900"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm">
                          {testResult.passed ? "✓ Test Passed!" : "✗ Test Failed"}
                        </span>
                        <span className="text-base font-extrabold font-mono">
                          Score: {testResult.scorePercent}% (Required: {testResult.passingScorePercent}%)
                        </span>
                      </div>
                      <p className="text-xs">
                        {testResult.passed
                          ? "Congratulations! The module is marked 100% completed and compliant."
                          : "Score was below passing threshold. Please review the answer keys and re-attempt."}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: TRACK EMPLOYEE RESPONSES & RESULTS               */}
      {/* ========================================================= */}
      {showTrackerModal && trackingModule && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#293381] text-white flex items-center justify-center shadow-sm">
                  <Users className="w-5 h-5 text-[#36B4FF]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#293381]/10 text-[#293381] dark:text-[#36B4FF]">
                      {trackingModule.code}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      {trackingModule.targetDepartment}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                    {trackingModule.title} — Employee Responses & Tracking
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </button>
                <button
                  onClick={() => setShowTrackerModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Analytics Summary KPI Cards */}
              {trackerAnalytics && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Employees Completed
                    </div>
                    <div className="text-2xl font-extrabold text-[#293381] dark:text-white mt-1">
                      {trackerAnalytics.completedCount}{" "}
                      <span className="text-xs font-medium text-slate-500">
                        / {trackerAnalytics.totalEnrolled} ({trackerAnalytics.completionRatePercent}%)
                      </span>
                    </div>
                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                      {trackerAnalytics.passCount} Passed Verification
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Average Attempts
                    </div>
                    <div className="text-2xl font-extrabold text-[#293381] dark:text-white mt-1">
                      {trackerAnalytics.avgAttempts}{" "}
                      <span className="text-xs font-medium text-slate-500">Attempts / Employee</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Min 1 • Passing at {trackingModule.passingScorePercent}%
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Average Time Taken
                    </div>
                    <div className="text-2xl font-extrabold text-[#293381] dark:text-white mt-1">
                      {trackerAnalytics.avgTimeMinutes}{" "}
                      <span className="text-xs font-medium text-slate-500">Minutes</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Videos ({trackingModule.totalVideoMinutes}m) + Test
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Final Check Status
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-xs font-bold">
                        {trackerAnalytics.passCount} Pass
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-xs font-bold">
                        {trackerAnalytics.failCount} Fail
                      </span>
                    </div>
                    <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1">
                      {trackerAnalytics.inProgressCount} in progress
                    </div>
                  </div>
                </div>
              )}

              {/* Filters & Search Toolbar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                {/* Search Bar */}
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={trackerSearch}
                    onChange={(e) => setTrackerSearch(e.target.value)}
                    placeholder="Search by name, employee code, or department..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  />
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  {(["ALL", "Pass", "Fail", "In Progress"] as const).map((filterOpt) => {
                    const count =
                      filterOpt === "ALL"
                        ? trackerResponses.length
                        : trackerResponses.filter((r) => r.finalCheck === filterOpt).length;

                    return (
                      <button
                        key={filterOpt}
                        onClick={() => setTrackerFilter(filterOpt)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                          trackerFilter === filterOpt
                            ? "bg-[#293381] text-white shadow-sm"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                        }`}
                      >
                        {filterOpt === "ALL" ? "All" : filterOpt} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Responses Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                {trackerLoading ? (
                  <div className="p-12 text-center text-slate-500 flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-[#293381]" />
                    <span>Loading employee response records...</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 uppercase font-semibold text-[10px] tracking-wider">
                        <tr>
                          <th className="p-3.5">Employee</th>
                          <th className="p-3.5">Department</th>
                          <th className="p-3.5">Video Watch Progress (100% Rule)</th>
                          <th className="p-3.5 text-center">Attempts</th>
                          <th className="p-3.5 text-center">Time Taken</th>
                          <th className="p-3.5 text-center">Test Score</th>
                          <th className="p-3.5 text-center">Final Check</th>
                          <th className="p-3.5">Completion Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {trackerResponses
                          .filter((row) => {
                            if (trackerFilter !== "ALL" && row.finalCheck !== trackerFilter) {
                              return false;
                            }
                            if (trackerSearch.trim()) {
                              const q = trackerSearch.toLowerCase();
                              const matchName = row.name?.toLowerCase().includes(q);
                              const matchCode = row.employeeCode?.toLowerCase().includes(q);
                              const matchDept = row.department?.toLowerCase().includes(q);
                              return Boolean(matchName || matchCode || matchDept);
                            }
                            return true;
                          })
                          .map((row) => (
                            <tr
                              key={row.employeeId}
                              className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                            >
                              {/* Employee */}
                              <td className="p-3.5">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-full bg-[#293381]/10 text-[#293381] dark:text-[#36B4FF] font-bold text-xs flex items-center justify-center shrink-0">
                                    {(row.name || row.employeeCode || "E")
                                      .slice(0, 2)
                                      .toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-bold text-slate-900 dark:text-white">
                                      {row.name || "Employee"}
                                    </div>
                                    <div className="text-[11px] text-slate-500 font-mono">
                                      {row.employeeCode}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Department */}
                              <td className="p-3.5 text-slate-600 dark:text-slate-300">
                                {row.department}
                              </td>

                              {/* Video Progress (100% Rule) */}
                              <td className="p-3.5">
                                <div className="space-y-1.5 w-44">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                                      {row.videoProgressPercent}% Watched
                                    </span>
                                    {row.videosCompleted ? (
                                      <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                                        <CheckCircle2 className="w-3 h-3" /> 100% Done
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-amber-600 font-medium">
                                        Partial
                                      </span>
                                    )}
                                  </div>
                                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full ${
                                        row.videosCompleted ? "bg-emerald-500" : "bg-[#293381]"
                                      }`}
                                      style={{ width: `${Math.min(100, row.videoProgressPercent)}%` }}
                                    />
                                  </div>
                                </div>
                              </td>

                              {/* Attempts */}
                              <td className="p-3.5 text-center font-semibold text-slate-800 dark:text-slate-200">
                                {row.attempts > 0 ? (
                                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono text-xs">
                                    {row.attempts} {row.attempts === 1 ? "attempt" : "attempts"}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">0</span>
                                )}
                              </td>

                              {/* Time Taken */}
                              <td className="p-3.5 text-center font-mono text-xs text-slate-700 dark:text-slate-300">
                                {row.timeSpentMinutes > 0 ? (
                                  <span className="inline-flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    {row.timeSpentMinutes} mins
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">—</span>
                                )}
                              </td>

                              {/* Test Score */}
                              <td className="p-3.5 text-center font-extrabold font-mono text-xs">
                                {row.testScorePercent !== undefined ? (
                                  <span
                                    className={
                                      row.testScorePercent >= trackingModule.passingScorePercent
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : "text-rose-600 dark:text-rose-400"
                                    }
                                  >
                                    {row.testScorePercent}%
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-normal italic">—</span>
                                )}
                              </td>

                              {/* Final Check */}
                              <td className="p-3.5 text-center">
                                {row.finalCheck === "Pass" ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> PASS
                                  </span>
                                ) : row.finalCheck === "Fail" ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
                                    <AlertCircle className="w-3.5 h-3.5" /> FAIL
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                    <Clock className="w-3.5 h-3.5" /> IN PROGRESS
                                  </span>
                                )}
                              </td>

                              {/* Completion Date */}
                              <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                                {row.completedAt ? (
                                  new Date(row.completedAt).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })
                                ) : (
                                  <span className="text-slate-400 italic">Pending</span>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
