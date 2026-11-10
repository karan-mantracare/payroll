import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import {
  getProgressRecords,
  updateVideoWatchProgress,
  getTrainingModules,
  saveProgressRecords,
} from "@/lib/training/service";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const moduleId = searchParams.get("moduleId");

    const records = getProgressRecords();
    if (moduleId) {
      const key = `${session.userId}_${moduleId}`;
      return NextResponse.json({ success: true, progress: records[key] || null });
    }

    // Return all for this user
    const userRecords = Object.values(records).filter((r) => r.userId === session.userId);
    return NextResponse.json({ success: true, progress: userRecords });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, moduleId, videoId, percent, testAnswers } = body;

    if (!moduleId) {
      return NextResponse.json({ error: "Module ID required" }, { status: 400 });
    }

    const modules = getTrainingModules();
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    if (action === "VIDEO_PROGRESS") {
      if (!videoId || percent === undefined) {
        return NextResponse.json({ error: "videoId and percent required" }, { status: 400 });
      }

      const updatedProgress = updateVideoWatchProgress(session.userId, moduleId, videoId, percent);
      return NextResponse.json({ success: true, progress: updatedProgress });
    }

    if (action === "SUBMIT_TEST") {
      const records = getProgressRecords();
      const key = `${session.userId}_${moduleId}`;
      const current = records[key] || {
        userId: session.userId,
        moduleId,
        videoProgress: {},
        videosFullyCompleted: false,
        testCompleted: false,
      };

      // Check if 100% video completion logic applies
      if (mod.require100PercentVideoCompletion && !current.videosFullyCompleted) {
        return NextResponse.json(
          { error: "100% video completion required across all parts before taking the test." },
          { status: 400 }
        );
      }

      // Grade test using the answer keys
      let scoredPoints = 0;
      let totalPoints = 0;
      const results: Record<string, { correct: boolean; pointsAwarded: number; answerKey?: any }> = {};

      for (const q of mod.questions) {
        totalPoints += Number(q.points) || 10;
        const submitted = testAnswers ? testAnswers[q.id] : undefined;

        if (q.type === "MCQ_SINGLE") {
          const isCorrect = submitted && String(submitted).trim() === String(q.answerKey).trim();
          const pointsAwarded = isCorrect ? (Number(q.points) || 10) : 0;
          scoredPoints += pointsAwarded;
          results[q.id] = { correct: isCorrect, pointsAwarded, answerKey: q.answerKey };
        } else if (q.type === "SHORT_ANSWER" || q.type === "LONG_ANSWER") {
          // Automatic or rubric credit for submitted text
          const hasContent = submitted && String(submitted).trim().length > 3;
          const pointsAwarded = hasContent ? (Number(q.points) || 10) : 0;
          scoredPoints += pointsAwarded;
          results[q.id] = { correct: Boolean(hasContent), pointsAwarded, answerKey: q.modelAnswer };
        }
      }

      const hasTextQuestions = mod.questions.some(
        (q) => q.type === "SHORT_ANSWER" || q.type === "LONG_ANSWER"
      );

      if (hasTextQuestions) {
        // Result cannot be automatically declared Pass or Fail when text answers exist
        current.attempts = (current.attempts || 0) + 1;
        current.testCompleted = true;
        current.finalCheck = "Under Review";
        current.testPassed = undefined;
        current.testScorePercent = undefined;
        current.testAnswers = testAnswers;
        current.timeSpentMinutes = (current.timeSpentMinutes || 0) + 12;
        current.updatedAt = Date.now();

        records[key] = current;
        saveProgressRecords(records);

        return NextResponse.json({
          success: true,
          requiresReview: true,
          status: "Under Review",
          message: "Assessment submitted. Contains written text questions awaiting admin review.",
          results,
          progress: current,
        });
      } else {
        const scorePercent = totalPoints > 0 ? Math.round((scoredPoints / totalPoints) * 100) : 100;
        const passed = scorePercent >= (mod.passingScorePercent || 80);

        current.attempts = (current.attempts || 0) + 1;
        current.testCompleted = true;
        current.testScorePercent = scorePercent;
        current.testPassed = passed;
        current.finalCheck = passed ? "Pass" : "Fail";
        current.testAnswers = testAnswers;
        current.timeSpentMinutes = (current.timeSpentMinutes || 0) + 12; // Add test duration to time spent
        current.completedAt = passed ? Date.now() : current.completedAt;
        current.updatedAt = Date.now();

        records[key] = current;
        saveProgressRecords(records);

        return NextResponse.json({
          success: true,
          scorePercent,
          passed,
          passingScorePercent: mod.passingScorePercent || 80,
          results,
          progress: current,
        });
      }
    }

    if (action === "ADMIN_REVIEW") {
      const { employeeId, targetUserId, decision, scorePercent } = body;
      if (!decision || (decision !== "Pass" && decision !== "Fail")) {
        return NextResponse.json({ error: "decision must be 'Pass' or 'Fail'" }, { status: 400 });
      }

      const records = getProgressRecords();
      const key = `${targetUserId}_${moduleId}`;
      const altKey = `${employeeId}_${moduleId}`;
      const targetKey = records[key] ? key : records[altKey] ? altKey : key;

      const current = records[targetKey] || {
        userId: targetUserId || employeeId,
        employeeId,
        moduleId,
        videoProgress: {},
        videosFullyCompleted: true,
        timeSpentMinutes: 45,
        attempts: 1,
        testCompleted: true,
      };

      current.finalCheck = decision;
      current.testPassed = decision === "Pass";
      current.testScorePercent = decision === "Pass" ? (scorePercent || 100) : (scorePercent || 50);
      current.completedAt = decision === "Pass" ? Date.now() : current.completedAt;
      current.updatedAt = Date.now();

      records[targetKey] = current;
      saveProgressRecords(records);

      return NextResponse.json({ success: true, progress: current });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

