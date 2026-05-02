import { useState, useEffect, useMemo, useLayoutEffect, useCallback, useRef } from "react";
import type { ExamThread } from "../lib/data";

function extractCorrectOptions(answer: string | null) {
  if (!answer) return new Set<string>();
  return new Set((answer.toUpperCase().match(/[A-Z]/g) ?? []));
}

export function normalizeAnswerValue(val: string | null | undefined): string {
  if (!val) return "";
  return val.replace(/\s+/g, "").toUpperCase().split("").sort().join("");
}

function generateExamCode(examName: string | null | undefined) {
  if (!examName) return "00000";
  const normalized = examName.replace(/\s+/g, " ").trim().toLowerCase();
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) % 100000;
  }
  return hash.toString().padStart(5, "0");
}

const EXAM_CHECK_IMAGES = [
  "/imgcheck/doge.png",
  "/imgcheck/hacker.png",
  "/imgcheck/lamborghini.png",
  "/imgcheck/porsche.png",
  "/imgcheck/sadcat.png",
];

function generateExamCheckImage(subjectCode: string, examName: string, examCode: string) {
  const normalized = `${subjectCode}:${examName}:${examCode}`.replace(/\s+/g, " ").trim().toLowerCase();
  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 2246822507);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 3266489909);
  hash ^= hash >>> 16;
  return EXAM_CHECK_IMAGES[Math.abs(hash) % EXAM_CHECK_IMAGES.length];
}

function Field({ width = "100%" }: { width?: number | string }) {
  return <span className="win-sunken block h-5 align-middle" style={{ width }} />;
}

function WinSpin({ value, width = "40px", label }: { value: string | number; width?: string; label?: string }) {
  return (
    <div className="flex items-center gap-1">
      {label && <span>{label}</span>}
      <div className="flex">
        <div className="win-sunken flex h-[20px] items-center px-1 text-[11px]" style={{ width }}>
          {value}
        </div>
        <div className="flex flex-col">
          <button className="win-button flex h-[10px] w-4 items-center justify-center p-0" aria-label="Up">
            <span className="h-0 w-0 border-l-[3px] border-r-[3px] border-b-[4px] border-l-transparent border-r-transparent border-b-[#333]" />
          </button>
          <button className="win-button flex h-[10px] w-4 items-center justify-center p-0" aria-label="Down">
            <span className="h-0 w-0 border-l-[3px] border-r-[3px] border-t-[4px] border-l-transparent border-r-transparent border-t-[#333]" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ExamClient({ exam, isRemainder = false, onClose }: { exam: ExamThread, isRemainder?: boolean, onClose: () => void }) {
  const EXAM_DURATION_MINUTES = 60;

  // Core modes extending original DesktopEnvironment setup
  const [mode, setMode] = useState<"pre" | "practice" | "mock" | "result" | "view">("pre");

  // Main variables ported from EOSContent
  const questions = exam.questions;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [confirmedAnswers, setConfirmedAnswers] = useState<Record<number, string>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({});

  const [timeLeft, setTimeLeft] = useState(EXAM_DURATION_MINUTES * 60);
  const [isQuestionImageLoading, setIsQuestionImageLoading] = useState(true);
  const [isQuestionImageError, setIsQuestionImageError] = useState(false);
  const [isFinishConfirmed, setIsFinishConfirmed] = useState(false);

  const [securityWarning, setSecurityWarning] = useState<string | null>(null);
  const [securityViolationCount, setSecurityViolationCount] = useState(0);
  const [requiresFullscreenAction, setRequiresFullscreenAction] = useState(false);

  // Scoring & Result
  const [score, setScore] = useState(0);
  const [finalCorrectCount, setFinalCorrectCount] = useState(0);

  // AI Solver States (from DesktopEnvironment)
  const [aiAnswers, setAiAnswers] = useState<Record<string, string>>({});
  const [isSolving, setIsSolving] = useState(false);
  const [detectedOptions, setDetectedOptions] = useState<Record<string, number>>({});

  const isReviewMode = ["view", "practice"].includes(mode);
  const isMockExamMode = mode === "mock";

  const lastViolationAtRef = useRef(0);
  const requestingFullscreenRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const suppressSecurityWarningsRef = useRef(false);
  const suppressSecurityWarningsUntilRef = useRef(0);
  const lastFullscreenStateRef = useRef<boolean | null>(null);
  const hasEnteredFullscreenRef = useRef(false);

  const handleStart = (selectedMode: "practice" | "mock" | "view") => {
    setMode(selectedMode);
    if (selectedMode === "mock") {
      document.documentElement.requestFullscreen().catch(err => {
        console.error("Failed to enter fullscreen", err);
      });
    }
  };

  const handleAiSolve = async () => {
    const q = questions[currentIndex];
    if (!q || !q.image_url) return;

    const activeProvider = localStorage.getItem('active_ai_provider') || 'groq';
    let rawKeys = '';
    let apiEndpoint = '/api/solve';
    let model = '';

    if (activeProvider === 'gemini') {
      rawKeys = localStorage.getItem('gemini_api_key') || '';
      apiEndpoint = '/api/solve-gemini';
      model = 'gemini-2.5-flash-lite';
    } else {
      rawKeys = localStorage.getItem('groq_api_key') || '';
      apiEndpoint = '/api/solve';
      model = localStorage.getItem('groq_model') || 'meta-llama/llama-4-scout-17b-16e-instruct';
    }

    const keys = rawKeys.split('\n').map(k => k.trim()).filter(k => k.length > 0);

    if (keys.length === 0) {
      alert(`Please configure your ${activeProvider === 'gemini' ? 'Gemini' : 'Groq'} API Keys on the Desktop first!`);
      return;
    }

    const apiKey = keys[Math.floor(Math.random() * keys.length)];
    setIsSolving(true);
    try {
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: q.image_url, apiKey, model })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to solve");
      }

      const data = await response.json();
      setAiAnswers(prev => ({ ...prev, [q.id]: data.answer }));
      if (data.optionsCount) {
        setDetectedOptions(prev => ({ ...prev, [q.id]: data.optionsCount }));
      }
    } catch (err: any) {
      alert("AI Error: " + err.message);
    } finally {
      setIsSolving(false);
    }
  };

  // Auto-solve effect
  useEffect(() => {
    if ((mode === "practice" || mode === "mock" || mode === "view") && !isSolving) {
      const q = questions[currentIndex];
      if (q && !q.answer && !aiAnswers[q.id]) {
        handleAiSolve();
      }
    }
  }, [currentIndex, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if ((mode !== "mock" && mode !== "practice") || mode === "result" || mode === "pre" || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleFinish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isMockExamMode, mode, timeLeft]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatTime = (seconds: number) => {
    if (mode === "view") return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const currentQuestion = questions[currentIndex];
  const examDisplayCode = useMemo(() => generateExamCode(exam.thread_name ?? ""), [exam.thread_name]);
  const examCheckImage = useMemo(() => {
    const subjectMatch = exam.thread_name?.match(/^[a-zA-Z]{3}\d{3}[a-zA-Z]?/);
    const subjectCode = subjectMatch ? subjectMatch[0] : "UNKNOWN";
    return generateExamCheckImage(subjectCode, exam.thread_name ?? "", examDisplayCode);
  }, [examDisplayCode, exam.thread_name]);

  useLayoutEffect(() => {
    if (!currentQuestion) {
      setIsQuestionImageLoading(false);
      setIsQuestionImageError(false);
      return;
    }
    setIsQuestionImageLoading(true);
    setIsQuestionImageError(false);
  }, [currentQuestion?.id, currentQuestion?.image_url]);

  const progressPercent = useMemo(() => {
    if (questions.length === 0) return 0;
    return (Object.keys(confirmedAnswers).length / questions.length) * 100;
  }, [confirmedAnswers, questions.length]);

  const correctOptionsForCurrent = useMemo(() => {
    const qId = currentQuestion?.id ?? "";
    const ans = currentQuestion?.answer || aiAnswers[qId];
    return extractCorrectOptions(ans ?? null);
  }, [currentQuestion, aiAnswers]);

  const answerOptions = useMemo(() => {
    return ["A", "B", "C", "D", "E", "F"];
  }, []);

  const isCurrentAnswerRevealed = Boolean(revealedAnswers[currentIndex]);
  const hasCurrentAnswerKey = correctOptionsForCurrent.size > 0;

  const handleFinish = () => {
    if (!questions.length) return;
    if (!isFinishConfirmed && timeLeft > 0) return;

    let correctCount = 0;
    questions.forEach((q, index) => {
      const realAnswer = normalizeAnswerValue(q.answer || aiAnswers[q.id]);
      const selectedAnswer = normalizeAnswerValue(answers[index] ?? "");
      if (realAnswer && selectedAnswer === realAnswer) {
        correctCount++;
      }
    });
    const finalScore = (correctCount / Math.max(1, questions.length)) * 10;
    setScore(finalScore);
    setFinalCorrectCount(correctCount);
    setMode("result");
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(e => console.error(e));
    }
  };

  const handleNext = () => {
    if (!questions.length) return;
    setConfirmedAnswers((prev) => {
      const next = { ...prev };
      if (answers[currentIndex]) next[currentIndex] = answers[currentIndex];
      else delete next[currentIndex];
      return next;
    });
    if (currentIndex < questions.length - 1) setCurrentIndex(currentIndex + 1);
    else setCurrentIndex(0);
  };

  const handleBack = () => {
    if (!questions.length) return;
    setConfirmedAnswers((prev) => {
      const next = { ...prev };
      if (answers[currentIndex]) next[currentIndex] = answers[currentIndex];
      else delete next[currentIndex];
      return next;
    });
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
    else setCurrentIndex(questions.length - 1);
  };

  const handleAnswerSelect = (option: string) => {
    if (mode === "view") return; // View mode read only
    setAnswers((prev) => {
      const currentAnswer = prev[currentIndex] || "";
      let nextAnswer = "";
      if (currentAnswer.includes(option)) {
        nextAnswer = currentAnswer.replace(option, "");
      } else {
        nextAnswer = currentAnswer + option;
      }
      // Sort to keep it consistent (e.g., "ABC")
      nextAnswer = nextAnswer.split("").sort().join("");

      const next = { ...prev };
      if (nextAnswer === "") {
        delete next[currentIndex];
      } else {
        next[currentIndex] = nextAnswer;
      }
      return next;
    });
  };

  const handleShowAnswer = () => {
    if (!isReviewMode || !hasCurrentAnswerKey) return;
    setRevealedAnswers((prev) => ({
      ...prev,
      [currentIndex]: !prev[currentIndex],
    }));
  };

  // Keyboard navigation (ported from main)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (questions.length === 0 || mode === "pre" || mode === "result") return;

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isFormElement = tagName === "input" || tagName === "textarea" || tagName === "select";

      if (isFormElement || target?.isContentEditable) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        handleBack();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        handleNext();
        return;
      }

      if ((event.key === " " || event.code === "Space") && isReviewMode) {
        event.preventDefault();
        handleShowAnswer();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isReviewMode, questions.length, currentIndex, answers, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Security Features (ported from main)
  const registerViolation = useCallback((reason: string) => {
    const now = Date.now();
    if (suppressSecurityWarningsRef.current || now < suppressSecurityWarningsUntilRef.current) return;
    if (now - lastViolationAtRef.current < 800) return;

    lastViolationAtRef.current = now;
    setSecurityViolationCount((prev) => prev + 1);
    setSecurityWarning(reason);
  }, []);

  const requestFullscreenIfNeeded = useCallback(async (failureMessage: string, isUserGesture = false) => {
    if (document.fullscreenElement) {
      setRequiresFullscreenAction(false);
      return;
    }

    if (requestingFullscreenRef.current) return;

    const root = document.documentElement;
    if (!root.requestFullscreen) {
      if (hasEnteredFullscreenRef.current || isUserGesture) {
        registerViolation(failureMessage);
      }
      setRequiresFullscreenAction(true);
      return;
    }

    try {
      requestingFullscreenRef.current = true;
      suppressSecurityWarningsRef.current = true;
      suppressSecurityWarningsUntilRef.current = Date.now() + 1500;
      await root.requestFullscreen();
      hasEnteredFullscreenRef.current = true;
      setRequiresFullscreenAction(false);
    } catch {
      if (hasEnteredFullscreenRef.current || isUserGesture) {
        registerViolation(failureMessage);
      }
      if (!isUserGesture) {
        setRequiresFullscreenAction(true);
      }
    } finally {
      requestingFullscreenRef.current = false;
      if (!document.fullscreenElement) {
        suppressSecurityWarningsRef.current = false;
        suppressSecurityWarningsUntilRef.current = 0;
      }
    }
  }, [registerViolation]);

  useEffect(() => {
    if (!isMockExamMode || questions.length === 0 || mode === "result") return;

    lastFullscreenStateRef.current = Boolean(document.fullscreenElement);
    if (document.fullscreenElement) {
      hasEnteredFullscreenRef.current = true;
    }

    if (!document.fullscreenElement) {
      setRequiresFullscreenAction(true);
    }

    const handleWindowBlur = () => {
      registerViolation("Bạn đã rời khỏi cửa sổ làm bài.");
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        registerViolation("Bạn đã chuyển tab sang cửa sổ khác.");
        return;
      }
      if (!document.fullscreenElement) {
        setRequiresFullscreenAction(true);
      }
    };

    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        lastFullscreenStateRef.current = true;
        hasEnteredFullscreenRef.current = true;
        suppressSecurityWarningsRef.current = false;
        suppressSecurityWarningsUntilRef.current = Math.max(suppressSecurityWarningsUntilRef.current, Date.now() + 500);
        setRequiresFullscreenAction(false);
        return;
      }

      lastFullscreenStateRef.current = false;
      suppressSecurityWarningsRef.current = false;
      suppressSecurityWarningsUntilRef.current = 0;
      if (hasEnteredFullscreenRef.current) {
        registerViolation("Bạn đã thoát chế độ toàn màn hình.");
      }
      setRequiresFullscreenAction(true);
    };

    const fullscreenWatchdog = window.setInterval(() => {
      if (document.hidden) return;
      const isFullscreenNow = Boolean(document.fullscreenElement);
      const wasFullscreen = lastFullscreenStateRef.current;

      if (!isFullscreenNow) {
        setRequiresFullscreenAction(true);
        if (wasFullscreen === true) {
          registerViolation("Bạn đã thoát chế độ toàn màn hình.");
        }
      }
      lastFullscreenStateRef.current = isFullscreenNow;
    }, 1000);

    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.clearInterval(fullscreenWatchdog);
    };
  }, [isMockExamMode, questions.length, registerViolation, requestFullscreenIfNeeded, mode]);


  // Pre and Result screens logic
  if (mode === "pre") {
    return (
      <main className="win-root h-full w-full overflow-hidden text-[12px] flex items-center justify-center bg-[#0055e5]">
        <div className="win-panel p-4 flex flex-col items-center w-[300px]">
          <h2 className="text-[14px] font-bold mb-4">{exam.thread_name}</h2>
          <div className="flex flex-col gap-2 w-full">
            <div className="flex gap-2">
              <button className="win-button px-4 py-1 flex-1" onClick={() => handleStart("practice")}>Luyện đề</button>
              <button className="win-button px-4 py-1 flex-1" onClick={() => handleStart("mock")}>Thi thử</button>
            </div>
            <button className="win-button px-4 py-1 w-full" onClick={() => handleStart("view")}>Xem đáp án (Review)</button>
          </div>
          <button className="win-button px-4 py-1 w-full mt-4" onClick={onClose}>Trở về Explorer</button>
        </div>
      </main>
    );
  }

  if (mode === "result") {
    return (
      <main className="win-root h-full w-full overflow-hidden text-[12px] flex items-center justify-center bg-[#0055e5]">
        <div className="win-panel p-4 flex flex-col items-center w-[300px]">
          <h2 className="text-[14px] font-bold mb-2">Notice</h2>
          <div className="mb-4 text-center">
            You have completed the exam.<br /><br />
            Score: {score.toFixed(1)} / 10<br />
            Correct: {finalCorrectCount} / {questions.length}
          </div>
          {securityViolationCount > 0 && (
            <div className="mb-4 text-center text-red-600 font-bold">
              ⚠️ Cảnh báo: {securityViolationCount} lần vi phạm an ninh!
            </div>
          )}
          <button className="win-button px-4 py-1 w-[80px]" onClick={onClose}>OK</button>
        </div>
      </main>
    );
  }

  if (!questions || questions.length === 0) {
    return (
      <main className="win-root h-full w-full flex flex-col items-center justify-center text-[12px] bg-[#0055e5]">
        <div className="win-panel p-6 text-center shadow-[1px_1px_0_#fff_inset,-1px_-1px_0_#848584_inset]">
          <h2 className="font-bold text-[14px] mb-4">Error</h2>
          <p>This exam thread has no questions associated with it.</p>
          <button className="win-button px-4 py-1 mt-4" onClick={onClose}>Go Back</button>
        </div>
      </main>
    );
  }

  // Replace below with standard implementation (port from EOSContent)
  return (
    <main className="win-root h-full w-full overflow-hidden text-[12px]">
      {securityWarning && (
        <div className="absolute top-0 left-0 right-0 z-[100] bg-red-600 text-white p-2 text-center text-[14px] font-bold shadow-md animate-pulse">
          CẢNH BÁO: {securityWarning} (Vi phạm {securityViolationCount} lần)
        </div>
      )}

      {requiresFullscreenAction && (
        <div className="absolute inset-0 z-[100] bg-black/80 flex items-center justify-center">
          <div className="bg-white p-6 rounded-md shadow-xl text-center max-w-sm">
            <h3 className="text-[16px] font-bold text-red-600 mb-4">You have exited full-screen mode!</h3>
            <p className="mb-4">You must return to full-screen mode to continue your exam.</p>
            <button
              className="win-button px-4 py-2 text-[14px] h-[30px]"
              onClick={() => requestFullscreenIfNeeded("Failed to enter full screen", true)}
            >
              Back to Full Screen
            </button>
          </div>
        </div>
      )}

      <section className="win-panel mx-auto flex h-full w-full flex-col">
        {isReviewMode && (
          <div className="win-sunken absolute top-0 right-0 z-30 w-[220px] p-1.5 text-[10px] leading-[1.35] text-[#2f2f2f] bg-[#f6f6f6]">
            <div className="mb-1 font-bold text-[#2e8f2f]">Hướng dẫn dùng chế độ ôn tập</div>
            <ul className="space-y-[2px] pl-3">
              <li>← / → : Câu hỏi trước / sau</li>
              <li>Nút Cách: Hiện / ẩn đáp án đúng</li>
              <li>Hoặc bấm “Show answer / Hide answer”</li>
              <li>✓ xanh lá là câu trả lời chính xác</li>
            </ul>
          </div>
        )}

        <header className="relative pt-1 pb-0.5">
          <div className="grid max-w-[900px] grid-cols-[1fr_300px] gap-x-4">
            <div className="relative">
              <div className="pl-4 flex items-center">
                <div className="flex items-center text-[13px] leading-none font-bold text-[#2a2a2a]">
                  03.04.05.06(STUDENT)
                  <label className="ml-1 flex items-center font-normal">
                    <input
                      type="checkbox"
                      className="mr-1 h-3.5 w-3.5"
                      checked={isFinishConfirmed}
                      onChange={(event) => setIsFinishConfirmed(event.target.checked)}
                    />
                    I want to finish the exam.
                  </label>
                </div>
              </div>

              <table className="mt-1 border-separate border-spacing-y-1.5 text-[12px] leading-tight">
                <tbody>
                  <tr>
                    <td className="pr-1 text-right whitespace-nowrap">Server:</td>
                    <td className="pr-4"><b>EOS_Hehe_6767</b></td>
                    <td className="pr-1 text-right whitespace-nowrap">Exam Code:</td>
                    <td className="max-w-[110px] overflow-hidden text-ellipsis whitespace-nowrap">
                      <b title={exam.thread_name}>{exam.thread_name.length > 15 ? exam.thread_name.substring(0, 15) + "..." : exam.thread_name}</b>
                    </td>
                    <td rowSpan={2} className="align-top">
                      {(isMockExamMode || mode === "practice") && (
                        <button
                          onClick={handleFinish}
                          disabled={!isFinishConfirmed}
                          className="win-dark-button -mt-5 h-10 w-[88px] shrink-0 text-[11px] leading-[1.08] text-black disabled:opacity-60"
                        >
                          Finish
                          <br />
                          (Submit)
                        </button>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="pr-1 text-right whitespace-nowrap">Duration:</td>
                    <td className="pr-4"><b>{EXAM_DURATION_MINUTES} minutes</b></td>
                    <td className="pr-1 text-right whitespace-nowrap">Student:</td>
                    <td><b>2</b></td>
                  </tr>
                  <tr>
                    <td className="pr-1 text-right font-bold whitespace-nowrap">Submit Code:</td>
                    <td className="pr-1 py-[2px] w-[100px]"><Field /></td>
                    <td className="pr-1 text-right whitespace-nowrap">Open Code:</td>
                    <td className="pr-1 py-[2px] w-[100px]"><Field /></td>
                    <td>
                      <button className="win-button h-[22px] w-[90px] text-[11px]">Show Question</button>
                    </td>
                  </tr>
                  <tr>
                    <td className="pr-1 text-right whitespace-nowrap">Q mark:</td>
                    <td className="pr-4"><b>{(10 / Math.max(1, questions.length)).toFixed(2)}</b></td>
                    <td className="pr-1 text-right whitespace-nowrap">Total Marks:</td>
                    <td colSpan={2}>
                      <div className="flex items-center">
                        <b className="w-[32px]">{questions.length}</b>
                        <div className="ml-[11px]" id="vol-container">
                          <WinSpin label="Vol:" value="8" width="26px" />
                        </div>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td />
                    <td />
                    <td className="pt-[2px] pr-1 text-right whitespace-nowrap">
                      <span>Font:</span>
                    </td>
                    <td colSpan={2}>
                      <div className="flex items-center">
                        <div className="-ml-[145px]">
                          <WinSpin label="Font:" value="Microsoft Sans Serif" width="115px" />
                        </div>
                        <div className="ml-[25px]">
                          <WinSpin label="Size:" value="10" width="24px" />
                        </div>
                        <span className="ml-[29px] whitespace-nowrap text-[#4c4c4c]">Time Left:</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="relative -ml-[80px] -top-[10px] flex items-start gap-12 pt-1 pl-1">
              <div className="relative -ml-6 mt-[108px] flex shrink-0 flex-col items-center leading-none">
                <div className="absolute -top-[90px]">
                  <div className="relative">
                    <svg viewBox="0 0 24 24" className="h-[84px] w-[84px] fill-none stroke-[#c5c5c5] stroke-[1.2]">
                      <circle cx="12" cy="8" r="3.8" />
                      <path d="M4.8 21c2.2-4.5 5.4-6.8 7.2-6.8s5 2.3 7.2 6.8" />
                    </svg>
                    <span className="absolute right-[2px] top-[10px] h-4.5 w-4.5 rounded-full bg-[#84d476]" />
                  </div>
                </div>

                <span className="pointer-events-none whitespace-nowrap text-[54px] leading-[0.82] font-medium tracking-tight text-[#557e96]">
                  {formatTime(timeLeft)}
                </span>
              </div>

              <div className="relative flex shrink-0 flex-col items-center top-[10px] ml-12">
                <div className="text-[34px]  leading-none font-medium text-[#2f2f2f]">{examDisplayCode}</div>
                <div className="relative mt-5 flex h-[72px] w-[72px] items-center justify-center">
                  <img src={examCheckImage} alt="img check" className="max-h-full max-w-full object-contain" />
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-3 mt-1 min-h-0 flex-1 border border-[#cdcdcd] bg-white">
          <div className="flex h-full flex-col p-0.5">
            <div className="ml-[76px] mr-1 mb-1 mt-4 flex shrink-0 items-center gap-2 px-1 text-[13px]">
              <span className="font-bold text-[#3f9a34] truncate max-w-[400px]">
                There are {questions.length} questions, and your progress of answering is
              </span>
              <div className="win-sunken relative h-5 flex-1 bg-[#e8e8e8]">
                <div
                  className={`absolute left-0 top-0 h-full bg-[#3f9a34] transition-all duration-1000 ease-out`}
                  style={{ width: `${progressPercent}%` }}
                >
                  <span className="win-progress-glow block w-full h-full" />
                </div>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-[86px_1fr] bg-white">
              <aside className="flex flex-col items-center px-2 pt-1.5 text-[13px]">
                <div className="w-full">
                  <div className="mb-2 text-center font-semibold text-[#2e8f2f]">Answer</div>
                  <div className="flex flex-col items-center space-y-3.5">
                    {answerOptions.map((item) => {
                      const qId = currentQuestion?.id ?? "";
                      const isAiOrKnownCorrect = correctOptionsForCurrent.has(item);

                      // Determine if it should be marked as checked
                      let isChecked = false;
                      if (mode === "view") {
                        isChecked = isAiOrKnownCorrect;
                      } else {
                        isChecked = (answers[currentIndex] || "").includes(item);
                      }

                      return (
                        <label key={item} className="flex w-11 items-center gap-1.5">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5"
                            checked={isChecked}
                            onChange={() => handleAnswerSelect(item)}
                            disabled={mode === "view"}
                          />
                          <span className={mode === "view" && isAiOrKnownCorrect ? "text-[#2e8f2f] font-bold" : ""}>
                            {item}
                          </span>
                          {isReviewMode && isCurrentAnswerRevealed && correctOptionsForCurrent.has(item) && (
                            <span className="text-[14px] font-black leading-none text-[#2e8f2f]">✓</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-18 mb-2 flex justify-center gap-1 mt-[90px]">
                  <button onClick={handleBack} className="win-button h-5 w-9 text-[10px]">Back</button>
                  <button onClick={handleNext} className="win-button h-5 w-9 text-[10px]">Next</button>
                </div>

                {isReviewMode && mode !== "view" && (
                  <button
                    onClick={handleShowAnswer}
                    disabled={!hasCurrentAnswerKey}
                    className="win-button min-h-5 max-w-full px-1.5 py-0.5 mt-2 text-center text-[10px] leading-tight whitespace-normal break-words disabled:opacity-60"
                  >
                    {!hasCurrentAnswerKey ? "No answer key" : isCurrentAnswerRevealed ? "Hide answer" : "Show answer"}
                  </button>
                )}
              </aside>

              <article className="relative mr-2 min-h-0 px-1 py-0.5">
                <div className="win-sunken absolute inset-0 overflow-auto p-1.5 text-[12px] leading-[1.35] text-[#353535] bg-[#f6f6f6]">
                  <div className="flex justify-between items-start mb-2" style={{ display: "none" }}>
                    <div>(Choose 1 answer)</div>
                    {/* AI Solver UI ported back in */}
                    {(mode === "view" && !currentQuestion.answer && !aiAnswers[currentQuestion.id]) && (
                      <button
                        className={`win-button px-2 py-0.5 flex items-center gap-1 text-[11px] ${isSolving ? 'opacity-50' : ''}`}
                        onClick={handleAiSolve}
                        disabled={isSolving}
                      >
                        {isSolving ? '⌛ Solving...' : '🤖 Solve with AI'}
                      </button>
                    )}
                    {/* Show AI Answer label if it exists */}
                    {((mode === "view" || mode === "practice") && aiAnswers[currentQuestion.id]) && (
                      <div className="bg-[#e1f5fe] border border-[#03a9f4] px-2 py-0.5 rounded text-[11px] text-[#01579b] font-bold animate-pulse inline-block max-w-[200px]">
                        AI: {aiAnswers[currentQuestion.id]}
                      </div>
                    )}
                  </div>

                  {currentQuestion && (
                    <div className="w-full mt-2">
                      <div className="relative min-h-[220px] w-full overflow-hidden flex justify-center">
                        {isQuestionImageLoading && (
                          <div className="absolute inset-0 flex items-center justify-center text-[13px] text-[#6b6b6b]">
                            <div className="flex flex-col items-center gap-2">
                              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#c9c9c9] border-t-[#3f9a34]" />
                              <span>Loading question...</span>
                            </div>
                          </div>
                        )}

                        {isQuestionImageError && !isQuestionImageLoading && (
                          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-[13px] text-[#a94442]">
                            Không tải được ảnh câu hỏi.
                          </div>
                        )}

                        <img
                          src={currentQuestion.image_url}
                          alt={`Question ${currentIndex + 1}`}
                          className={`block max-w-full h-auto shadow-sm border border-[#ddd] ${isQuestionImageLoading ? "invisible" : "visible"}`}
                          onLoad={() => setIsQuestionImageLoading(false)}
                          onError={() => setIsQuestionImageError(true)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </article>
            </div>
          </div>
        </div>

        <footer className="relative flex items-end justify-between px-2.5 pb-1.5 pt-1 mt-1">
          <div className="z-10 w-[300px]">
            {(mode === "practice" || mode === "mock") && (
              <>
                <label className="mb-1 flex items-center gap-1 text-[12px] text-[#4a4a4a]">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5"
                    checked={isFinishConfirmed}
                    onChange={(e) => setIsFinishConfirmed(e.target.checked)}
                  />
                  <span>I want to finish the exam.</span>
                </label>
                <button
                  className="win-yellow-button h-[22px] w-[80px] text-[11px] font-bold disabled:opacity-60"
                  onClick={handleFinish}
                  disabled={!isFinishConfirmed}
                >
                  Finish
                </button>
              </>
            )}
          </div>

          <div className="absolute inset-0 flex items-end justify-center pb-0.5 pointer-events-none">
            <span className={`text-[56px] leading-none tracking-[0.5px] ${securityViolationCount > 0 ? 'text-[red]' : 'text-[#d5a32a]'}`}>
              WEB RUNNING
            </span>
          </div>

          <div className="z-10 flex w-[300px] items-end justify-end gap-1.5 pb-0.5 text-[11px]">
            <button className="win-button h-5 w-[70px]">Reconnect</button>
            <div className="win-combo h-5 w-[130px]">
              <span>FPTU-EXAMONLINE</span>
              <span className="win-combo-arrow">▾</span>
            </div>
            <button className="win-button h-5 w-12" onClick={onClose}>Exit</button>
          </div>
        </footer>
      </section >
    </main >
  );
}
