"use client";

import React, { useEffect, useState } from "react";
import {
  GraduationCap,
  PlayCircle,
  CheckCircle2,
  AlertCircle,
  Clock,
  Award,
  Video,
  FileQuestion,
  HelpCircle,
  ChevronRight,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  Lock,
  Unlock,
  BookOpen,
  Calendar,
  Check,
  X,
  Loader2,
  ExternalLink,
  FileText,
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

interface Question {
  id: string;
  type: "MCQ_SINGLE" | "MCQ_MULTI" | "SHORT_ANSWER" | "LONG_ANSWER";
  prompt: string;
  options?: string[];
  points: number;
}

interface TrainingModule {
  id: string;
  title: string;
  code: string;
  category: string;
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
}

interface UserModuleProgress {
  moduleId: string;
  videoProgress: Record<string, number>;
  videosFullyCompleted: boolean;
  timeSpentMinutes: number;
  attempts: number;
  testCompleted: boolean;
  testScorePercent?: number;
  testPassed?: boolean;
  finalCheck: "Pass" | "Fail" | "In Progress" | "Under Review";
  completedAt?: number;
}

export default function EmployeeTrainingPage() {
  const { user } = useAuth();
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, UserModuleProgress>>({});
  const [loading, setLoading] = useState(true);

  // Active module player state
  const [activeModule, setActiveModule] = useState<TrainingModule | null>(null);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<"videos" | "test">("videos");
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [currentVideoPercent, setCurrentVideoPercent] = useState<number>(0);

  // Test Taking State
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submittingTest, setSubmittingTest] = useState(false);
  const [testResult, setTestResult] = useState<{
    scorePercent: number;
    passed: boolean;
    passingScorePercent: number;
    results: Record<string, { correct: boolean; pointsAwarded: number; answerKey?: any }>;
  } | null>(null);

  useEffect(() => {
    fetchModulesAndProgress();
  }, []);

  const fetchModulesAndProgress = async () => {
    setLoading(true);
    try {
      const [modRes, progRes] = await Promise.all([
        fetch("/payroll/api/training/modules"),
        fetch("/payroll/api/training/progress"),
      ]);

      if (modRes.ok) {
        const modData = await modRes.json();
        setModules(modData.modules || []);
      }

      if (progRes.ok) {
        const progData = await progRes.json();
        const map: Record<string, UserModuleProgress> = {};
        if (Array.isArray(progData.progress)) {
          progData.progress.forEach((p: UserModuleProgress) => {
            map[p.moduleId] = p;
          });
        }
        setProgressMap(map);
      }
    } catch (err) {
      console.error("Failed to load training data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Launch Module Viewer
  const handleOpenModule = (mod: TrainingModule) => {
    setActiveModule(mod);
    setSelectedVideoIndex(0);
    setActiveTab("videos");
    setTestResult(null);
    setAnswers({});

    // Initialize video percent from progress
    const userProg = progressMap[mod.id];
    const firstVid = mod.videos[0];
    if (firstVid && userProg?.videoProgress?.[firstVid.id]) {
      setCurrentVideoPercent(userProg.videoProgress[firstVid.id]);
    } else {
      setCurrentVideoPercent(0);
    }
  };

  // Switch video part
  const handleSelectVideo = (idx: number) => {
    setSelectedVideoIndex(idx);
    setVideoPlaying(false);
    if (!activeModule) return;
    const vid = activeModule.videos[idx];
    const userProg = progressMap[activeModule.id];
    const saved = (vid && userProg?.videoProgress?.[vid.id]) || 0;
    setCurrentVideoPercent(saved);
  };

  // Update video watch progress to 100%
  const handleSetVideoProgress = async (percent: number) => {
    if (!activeModule) return;
    const currentVid = activeModule.videos[selectedVideoIndex];
    if (!currentVid) return;

    setCurrentVideoPercent(percent);

    try {
      const res = await fetch("/payroll/api/training/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "VIDEO_PROGRESS",
          moduleId: activeModule.id,
          videoId: currentVid.id,
          percent,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.progress) {
          setProgressMap((prev) => ({
            ...prev,
            [activeModule.id]: data.progress,
          }));
        }
      }
    } catch (err) {
      console.error("Error saving video progress:", err);
    }
  };

  // Mark all parts 100% (Instant completion helper for testing)
  const handleCompleteAllVideos = async () => {
    if (!activeModule) return;
    for (const v of activeModule.videos) {
      await fetch("/payroll/api/training/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "VIDEO_PROGRESS",
          moduleId: activeModule.id,
          videoId: v.id,
          percent: 100,
        }),
      });
    }
    // Refresh progress
    const res = await fetch(`/payroll/api/training/progress?moduleId=${activeModule.id}`);
    if (res.ok) {
      const data = await res.json();
      if (data.progress) {
        setProgressMap((prev) => ({
          ...prev,
          [activeModule.id]: data.progress,
        }));
      }
    }
    setCurrentVideoPercent(100);
  };

  // Submit test answers
  const handleSubmitTest = async () => {
    if (!activeModule) return;
    setSubmittingTest(true);
    try {
      const res = await fetch("/payroll/api/training/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SUBMIT_TEST",
          moduleId: activeModule.id,
          testAnswers: answers,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult(data);
        if (data.progress) {
          setProgressMap((prev) => ({
            ...prev,
            [activeModule.id]: data.progress,
          }));
        }
      } else {
        alert(data.error || "Failed to submit assessment.");
      }
    } catch (err: any) {
      alert(err.message || "Network error submitting test.");
    } finally {
      setSubmittingTest(false);
    }
  };

  // Helper checks for active module
  const currentModuleProg = activeModule ? progressMap[activeModule.id] : null;
  const allVideosDone = Boolean(
    activeModule &&
      activeModule.videos.length > 0 &&
      activeModule.videos.every((v) => (currentModuleProg?.videoProgress?.[v.id] || 0) >= 100)
  );

  // Overall KPI stats
  const totalAssigned = modules.length;
  const completedCount = modules.filter(
    (m) => progressMap[m.id]?.finalCheck === "Pass"
  ).length;
  const inProgressCount = modules.filter(
    (m) =>
      progressMap[m.id] &&
      progressMap[m.id]?.finalCheck !== "Pass"
  ).length;

  return (
    <div className="space-y-6 pb-12">
      {/* ========================================================= */}
      {/* HEADER SECTION                                            */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#293381] dark:text-white tracking-tight flex items-center gap-2">
            <GraduationCap className="w-7 h-7 text-[#36B4FF]" />
            My Training & Certifications
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Mandatory compliance courses, HIPAA data privacy, clinical SOPs, and employee certifications.
          </p>
        </div>

        {activeModule && (
          <button
            onClick={() => setActiveModule(null)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to All Modules
          </button>
        )}
      </div>

      {/* ========================================================= */}
      {/* VIEW 1: ACTIVE MODULE PLAYER (VIDEO & TEST)                */}
      {/* ========================================================= */}
      {activeModule ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Module Banner */}
          <div
            data-text-white="true"
            className="bg-gradient-to-r from-[#293381] to-[#1F2664] rounded-2xl p-6 text-white shadow-md relative overflow-hidden"
          >
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-[#36B4FF]/20 text-[#36B4FF] border border-[#36B4FF]/30">
                    {activeModule.code}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white/20 text-white">
                    {activeModule.category}
                  </span>
                  <span className="text-xs text-slate-200">
                    Target: {activeModule.targetDepartment}
                  </span>
                </div>
                <h2
                  style={{ color: "#ffffff" }}
                  className="text-xl md:text-2xl font-bold text-white tracking-tight"
                >
                  {activeModule.title}
                </h2>
                <p
                  style={{ color: "#e2e8f0" }}
                  className="text-xs md:text-sm text-slate-200 mt-1 max-w-3xl leading-relaxed"
                >
                  {activeModule.description}
                </p>
              </div>

              {/* Status Badge */}
              <div className="flex flex-col items-end justify-center min-w-[160px]">
                {currentModuleProg?.finalCheck === "Pass" ? (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400 text-emerald-300 font-bold text-sm shadow-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>Final Check: PASS</span>
                  </div>
                ) : currentModuleProg?.finalCheck === "Fail" ? (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/20 border border-rose-400 text-rose-300 font-bold text-sm shadow-sm">
                    <AlertCircle className="w-5 h-5 text-rose-400" />
                    <span>Final Check: FAIL</span>
                  </div>
                ) : currentModuleProg?.finalCheck === "Under Review" ? (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/20 border border-purple-400 text-purple-200 font-bold text-sm shadow-sm">
                    <FileText className="w-5 h-5 text-purple-300" />
                    <span>Final Check: UNDER REVIEW</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-400 text-amber-300 font-bold text-sm shadow-sm">
                    <Clock className="w-5 h-5 text-amber-400" />
                    <span>In Progress</span>
                  </div>
                )}
                <div className="text-[11px] text-slate-300 mt-1">
                  Passing requirement: {activeModule.passingScorePercent}%
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs (Videos vs Assessment Test) */}
          <div className="flex items-center border-b border-slate-200 dark:border-slate-800 gap-4">
            <button
              onClick={() => setActiveTab("videos")}
              className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
                activeTab === "videos"
                  ? "border-[#293381] text-[#293381] dark:border-[#36B4FF] dark:text-[#36B4FF]"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Video className="w-4 h-4" />
              <span>Training Videos ({activeModule.videos.length} Parts • {activeModule.totalVideoMinutes} Mins)</span>
              {allVideosDone && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block ml-1" />
              )}
            </button>

            <button
              onClick={() => setActiveTab("test")}
              className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
                activeTab === "test"
                  ? "border-[#293381] text-[#293381] dark:border-[#36B4FF] dark:text-[#36B4FF]"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <FileQuestion className="w-4 h-4" />
              <span>Assessment Test ({activeModule.totalQuestions} Questions)</span>
              {allVideosDone ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold border border-emerald-300">
                  Unlocked
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 font-medium flex items-center gap-1">
                  <Lock className="w-3 h-3" /> 100% Video Req.
                </span>
              )}
            </button>
          </div>

          {/* TAB CONTENT: VIDEOS */}
          {activeTab === "videos" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Video Player & Progress Controller */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                  {/* Video Title Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-[#293381] dark:text-[#36B4FF]">
                        Part {selectedVideoIndex + 1} of {activeModule.videos.length}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {activeModule.videos[selectedVideoIndex]?.title}
                      </h3>
                    </div>
                    <div className="text-xs font-medium text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {activeModule.videos[selectedVideoIndex]?.durationMinutes} mins
                    </div>
                  </div>

                  {/* HTML5 Video Player Frame */}
                  <div className="relative aspect-video rounded-xl bg-slate-950 overflow-hidden flex flex-col items-center justify-center border border-slate-800 group shadow-inner">
                    <video
                      key={activeModule.videos[selectedVideoIndex]?.videoUrl}
                      controls
                      playsInline
                      className="w-full h-full object-cover"
                      src={activeModule.videos[selectedVideoIndex]?.videoUrl}
                      onPlay={() => setVideoPlaying(true)}
                      onPause={() => setVideoPlaying(false)}
                      onEnded={() => handleSetVideoProgress(100)}
                      onTimeUpdate={(e) => {
                        const target = e.currentTarget;
                        if (target.duration) {
                          const pct = Math.round((target.currentTime / target.duration) * 100);
                          if (pct > currentVideoPercent) {
                            handleSetVideoProgress(pct);
                          }
                        }
                      }}
                    />
                  </div>

                  {/* 100% Progress Tracking Indicator */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <span>Video Watch Completion:</span>
                        <span className="text-[#293381] dark:text-[#36B4FF] font-bold text-sm">
                          {currentVideoPercent}%
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {currentVideoPercent >= 100 ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> 100% Completed
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                            {100 - currentVideoPercent}% remaining to fulfill 100% rule
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          currentVideoPercent >= 100 ? "bg-emerald-500" : "bg-[#293381] dark:bg-[#36B4FF]"
                        }`}
                        style={{ width: `${Math.min(100, currentVideoPercent)}%` }}
                      />
                    </div>

                    {/* Quick Simulation Buttons for Verification */}
                    <div className="pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 dark:border-slate-700">
                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>Interactive Watch Simulator:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSetVideoProgress(50)}
                          className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition"
                        >
                          Simulate 50%
                        </button>
                        <button
                          onClick={() => handleSetVideoProgress(100)}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition"
                        >
                          Mark Part 100% Complete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Playlist & Progress Across All Parts */}
              <div className="space-y-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                      <Video className="w-4 h-4 text-[#293381] dark:text-[#36B4FF]" />
                      Part-wise Syllabus
                    </h3>
                    <span className="text-xs font-semibold text-slate-500">
                      {activeModule.videos.length} Parts Total
                    </span>
                  </div>

                  {/* Part List */}
                  <div className="space-y-2">
                    {activeModule.videos.map((part, idx) => {
                      const userPct = currentModuleProg?.videoProgress?.[part.id] || (idx === selectedVideoIndex ? currentVideoPercent : 0);
                      const isCompleted = userPct >= 100;
                      const isSelected = idx === selectedVideoIndex;

                      return (
                        <div
                          key={part.id}
                          onClick={() => handleSelectVideo(idx)}
                          className={`p-3 rounded-xl border text-left cursor-pointer transition flex items-center justify-between gap-3 ${
                            isSelected
                              ? "bg-[#293381]/5 border-[#293381] dark:border-[#36B4FF] dark:bg-[#36B4FF]/10 shadow-sm"
                              : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                                isCompleted
                                  ? "bg-emerald-500 text-white"
                                  : isSelected
                                  ? "bg-[#293381] text-white dark:bg-[#36B4FF] dark:text-slate-900"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                              }`}
                            >
                              {isCompleted ? <Check className="w-4 h-4" /> : part.partNumber}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                                {part.title}
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                <span>{part.durationMinutes} mins</span>
                                <span>•</span>
                                <span className={isCompleted ? "text-emerald-600 dark:text-emerald-400 font-semibold" : ""}>
                                  {userPct}% Watched
                                </span>
                              </div>
                            </div>
                          </div>

                          <ChevronRight className={`w-4 h-4 text-slate-400 ${isSelected ? "text-[#293381] dark:text-[#36B4FF]" : ""}`} />
                        </div>
                      );
                    })}
                  </div>

                  {/* 100% Completion Gate Notice */}
                  <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-xs text-blue-900 dark:text-blue-200 space-y-2">
                    <div className="font-semibold flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-[#36B4FF]" />
                      <span>100% Video Completion Rule Active</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      All video parts must reach 100% completion before the final assessment test is unlocked.
                    </p>

                    <button
                      onClick={handleCompleteAllVideos}
                      className="w-full py-1.5 px-3 rounded-lg bg-[#293381] hover:bg-[#1F2664] text-white text-[11px] font-semibold transition text-center shadow-sm"
                    >
                      Fast-Track: Mark All Parts 100% Watched
                    </button>
                  </div>

                  {/* Go to Test Button */}
                  <button
                    onClick={() => setActiveTab("test")}
                    disabled={!allVideosDone}
                    className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition shadow-sm ${
                      allVideosDone
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    {allVideosDone ? (
                      <>
                        <Unlock className="w-4 h-4" />
                        <span>Proceed to Assessment Test</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Complete All Videos to Unlock Test</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: ASSESSMENT TEST */}
          {activeTab === "test" && (
            <div className="max-w-3xl mx-auto space-y-6">
              {/* If videos not 100% completed, lock test */}
              {!allVideosDone ? (
                <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-8 text-center space-y-4 shadow-sm">
                  <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                    <Lock className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Assessment Test Locked
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                      As per company compliance policies, you must watch 100% of all {activeModule.videos.length} video parts before taking this test.
                    </p>
                  </div>
                  <div className="pt-2 flex items-center justify-center gap-3">
                    <button
                      onClick={() => setActiveTab("videos")}
                      className="px-4 py-2 rounded-xl bg-[#293381] hover:bg-[#1F2664] text-white text-xs font-semibold transition"
                    >
                      Return to Training Videos
                    </button>
                    <button
                      onClick={handleCompleteAllVideos}
                      className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                    >
                      Mark Videos 100% (Instant)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Test Status Banner / Past Result */}
                  {currentModuleProg?.testCompleted && !testResult && (
                    <div
                      className={`p-5 rounded-2xl border flex items-center justify-between gap-4 ${
                        currentModuleProg.finalCheck === "Pass"
                          ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100"
                          : currentModuleProg.finalCheck === "Fail"
                          ? "bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-100"
                          : "bg-purple-50 dark:bg-purple-950/30 border-purple-300 dark:border-purple-800 text-purple-900 dark:text-purple-100"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {currentModuleProg.finalCheck === "Pass" ? (
                          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                            <CheckCircle2 className="w-6 h-6" />
                          </div>
                        ) : currentModuleProg.finalCheck === "Fail" ? (
                          <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold">
                            <AlertCircle className="w-6 h-6" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold">
                            <FileText className="w-6 h-6" />
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-sm">
                            {currentModuleProg.finalCheck === "Under Review"
                              ? "Final Check: UNDER REVIEW (Awaiting Admin Evaluation)"
                              : `Final Check: ${currentModuleProg.finalCheck.toUpperCase()} (Score: ${currentModuleProg.testScorePercent}%)`}
                          </div>
                          <div className="text-xs opacity-80">
                            {currentModuleProg.finalCheck === "Under Review"
                              ? "This test contains written text questions. Your submission has been routed to the admin for manual review."
                              : `Attempts taken: ${currentModuleProg.attempts} • Passing requirement: ${activeModule.passingScorePercent}%`}
                          </div>
                        </div>
                      </div>

                      {currentModuleProg.finalCheck === "Fail" && (
                        <button
                          onClick={() => {
                            setTestResult(null);
                            setAnswers({});
                          }}
                          className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Retake Test
                        </button>
                      )}
                    </div>
                  )}

                  {/* Live Test Result Banner after submission */}
                  {testResult && (
                    <div
                      className={`p-6 rounded-2xl border shadow-md space-y-3 ${
                        (testResult as any).requiresReview
                          ? "bg-purple-50 dark:bg-purple-950/40 border-purple-400 text-purple-950 dark:text-purple-100"
                          : testResult.passed
                          ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 text-emerald-950 dark:text-emerald-100"
                          : "bg-rose-50 dark:bg-rose-950/40 border-rose-400 text-rose-950 dark:text-rose-100"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center text-white ${
                              (testResult as any).requiresReview
                                ? "bg-purple-600"
                                : testResult.passed
                                ? "bg-emerald-600"
                                : "bg-rose-600"
                            }`}
                          >
                            {(testResult as any).requiresReview ? (
                              <FileText className="w-7 h-7" />
                            ) : testResult.passed ? (
                              <Award className="w-7 h-7" />
                            ) : (
                              <AlertCircle className="w-7 h-7" />
                            )}
                          </div>
                          <div>
                            <h3 className="text-lg font-bold">
                              {(testResult as any).requiresReview
                                ? "Assessment Submitted — Under Review"
                                : `Final Check: ${testResult.passed ? "PASS" : "FAIL"}`}
                            </h3>
                            <p className="text-xs opacity-90">
                              {(testResult as any).requiresReview
                                ? "This assessment contains written short answer questions. Your submission has been routed to the admin for manual review."
                                : `Your Score: ${testResult.scorePercent}% (Passing score: ${testResult.passingScorePercent}%)`}
                            </p>
                          </div>
                        </div>

                        {!testResult.passed && !(testResult as any).requiresReview && (
                          <button
                            onClick={() => {
                              setTestResult(null);
                              setAnswers({});
                            }}
                            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Try Again
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Question Cards */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                      <span>Questions ({activeModule.questions.length})</span>
                      <span>Total Points: {activeModule.totalPoints}</span>
                    </div>

                    {activeModule.questions.map((q, qIndex) => {
                      const evalResult = testResult?.results?.[q.id];

                      return (
                        <div
                          key={q.id}
                          className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm space-y-3 ${
                            evalResult
                              ? evalResult.correct
                                ? "border-emerald-300 dark:border-emerald-800"
                                : "border-rose-300 dark:border-rose-800"
                              : "border-slate-200 dark:border-slate-800"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-md bg-[#293381]/10 text-[#293381] dark:text-[#36B4FF] flex items-center justify-center font-bold text-xs">
                                Q{qIndex + 1}
                              </span>
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                {q.type.replace("_", " ")}
                              </span>
                            </div>
                            <span className="text-xs font-bold text-slate-500">
                              {q.points} Pts
                            </span>
                          </div>

                          <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {q.prompt}
                          </div>

                          {/* MCQ Options */}
                          {q.options && q.options.length > 0 && (
                            <div className="space-y-2 pt-2">
                              {q.options.map((opt, oIndex) => {
                                const isSelected = answers[q.id] === opt;
                                return (
                                  <label
                                    key={oIndex}
                                    className={`flex items-center gap-3 p-3 rounded-xl border text-xs cursor-pointer transition ${
                                      isSelected
                                        ? "bg-[#293381]/10 border-[#293381] text-[#293381] dark:bg-[#36B4FF]/10 dark:border-[#36B4FF] dark:text-white font-semibold"
                                        : "border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name={`question_${q.id}`}
                                      value={opt}
                                      checked={isSelected}
                                      onChange={() =>
                                        setAnswers((prev) => ({ ...prev, [q.id]: opt }))
                                      }
                                      className="w-4 h-4 text-[#293381] focus:ring-[#36B4FF]"
                                    />
                                    <span>{opt}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}

                          {/* Short / Long Answer Input */}
                          {(q.type === "SHORT_ANSWER" || q.type === "LONG_ANSWER") && (
                            <div className="pt-2">
                              <textarea
                                rows={q.type === "LONG_ANSWER" ? 4 : 2}
                                value={answers[q.id] || ""}
                                onChange={(e) =>
                                  setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                                }
                                placeholder="Type your response here..."
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                              />
                            </div>
                          )}

                          {/* Result feedback if graded */}
                          {evalResult && (
                            <div
                              className={`p-2.5 rounded-lg text-xs flex items-center justify-between ${
                                evalResult.correct
                                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                                  : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"
                              }`}
                            >
                              <span className="font-semibold">
                                {evalResult.correct ? "✓ Correct Answer" : "✕ Incorrect"}
                              </span>
                              <span>+{evalResult.pointsAwarded} pts</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Submit Assessment Button */}
                  <div className="pt-4 flex items-center justify-end gap-3">
                    <button
                      onClick={handleSubmitTest}
                      disabled={submittingTest}
                      className="px-6 py-3 rounded-xl bg-[#293381] hover:bg-[#1F2664] text-white font-bold text-xs transition shadow-md flex items-center gap-2 disabled:opacity-50"
                    >
                      {submittingTest ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Submitting Assessment...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Submit Assessment for Final Check</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ========================================================= */
        /* VIEW 2: MODULE CATALOG & COMPLIANCE OVERVIEW              */
        /* ========================================================= */
        <div className="space-y-6">
          {/* Top KPI Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <div className="text-xs font-medium text-slate-500">Assigned Modules</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {totalAssigned} Modules
              </div>
              <div className="text-[11px] text-slate-400 mt-1">100% video completion rule active</div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <div className="text-xs font-medium text-slate-500">Completed & Passed</div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {completedCount} Passed
              </div>
              <div className="text-[11px] text-emerald-600/80 mt-1">Verified with automated grading</div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <div className="text-xs font-medium text-slate-500">Pending / In Progress</div>
              <div className="text-2xl font-bold text-amber-500 mt-1">
                {totalAssigned - completedCount} Left
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Requires video watching + assessment test</div>
            </div>
          </div>

          {/* Module List Cards */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-[#293381] dark:text-white">
                Assigned Compliance Modules & Courses ({modules.length})
              </h2>
              <span className="text-xs text-slate-500">Healthcare Regulatory Standards 2026</span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-500 flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-[#293381]" />
                <span>Loading assigned training modules...</span>
              </div>
            ) : modules.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                <GraduationCap className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  No training modules assigned.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {modules.map((mod) => {
                  const prog = progressMap[mod.id];
                  const isPassed = prog?.finalCheck === "Pass";
                  const isFailed = prog?.finalCheck === "Fail";
                  const isUnderReview = prog?.finalCheck === "Under Review";
                  const isInProgress = prog && !isPassed && !isFailed && !isUnderReview;

                  // Compute average video progress
                  const totalVideos = mod.videos.length || 1;
                  const watchedSum = Object.values(prog?.videoProgress || {}).reduce(
                    (a, b) => a + b,
                    0
                  );
                  const avgVideoProgress = Math.min(100, Math.round(watchedSum / totalVideos));

                  return (
                    <div
                      key={mod.id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-3">
                        {/* Top Badges */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#293381]/10 text-[#293381] dark:text-[#36B4FF]">
                              {mod.code}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {mod.category}
                            </span>
                          </div>

                          {/* Final Check Badge */}
                          {isPassed ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Final: PASS ({prog.testScorePercent}%)
                            </span>
                          ) : isFailed ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-300">
                              <AlertCircle className="w-3.5 h-3.5" /> Final: FAIL ({prog.testScorePercent}%)
                            </span>
                          ) : isUnderReview ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-300">
                              <FileText className="w-3.5 h-3.5" /> Under Review
                            </span>
                          ) : isInProgress ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-300">
                              <Clock className="w-3.5 h-3.5" /> In Progress
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              Not Started
                            </span>
                          )}
                        </div>

                        {/* Title & Description */}
                        <div>
                          <h3 className="font-bold text-slate-900 dark:text-white text-base">
                            {mod.title}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                            {mod.description}
                          </p>
                        </div>

                        {/* Video Parts Indicator */}
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              <Video className="w-3.5 h-3.5 text-[#36B4FF]" />
                              {mod.videos.length} Video Parts ({mod.totalVideoMinutes} Mins)
                            </span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {avgVideoProgress}% Watched
                            </span>
                          </div>

                          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#293381] dark:bg-[#36B4FF] transition-all"
                              style={{ width: `${avgVideoProgress}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                            <span>Test Passing Score: {mod.passingScorePercent}%</span>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                              100% video logic enforced
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <div className="text-[11px] text-slate-500">
                          {prog?.attempts ? `${prog.attempts} Attempt(s)` : "0 Attempts"}
                        </div>

                        <button
                          onClick={() => handleOpenModule(mod)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#293381] hover:bg-[#1F2664] text-white text-xs font-semibold transition shadow-sm"
                        >
                          {isPassed ? (
                            <>
                              <Award className="w-3.5 h-3.5" />
                              <span>Review Course</span>
                            </>
                          ) : (
                            <>
                              <PlayCircle className="w-3.5 h-3.5" />
                              <span>{isInProgress ? "Continue Module" : "Start Learning"}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
