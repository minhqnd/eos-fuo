/* eslint-disable tailwindcss/enforces-shorthand, tailwindcss/no-contradicting-classname */
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
    getEffectiveAnswerForQuestion,
    hasAnswerKey,
    normalizeExamName,
    normalizeAnswerValue,
    readAnswerOverrides,
} from "@/lib/answer-overrides";

interface Question {
    id: string;
    image_url: string;
    answer: string | null;
}

interface QuestionData {
    thread_url: string;
    name: string;
    questions: Question[];
}

type DatabaseRoot = Record<string, Record<string, QuestionData[]>>;

interface ExamResultSummary {
    totalQuestions: number;
    gradableQuestions: number;
    missingKeyQuestions: number;
    answeredQuestions: number;
    unansweredQuestions: number;
    correctAnswers: number;
    incorrectAnswers: number;
    answeredWithoutKey: number;
    scorePercent: number;
    scoreOnTen: number;
}

function extractCorrectOptions(answer: string | null) {
    if (!answer) return new Set<string>();
    return new Set((answer.toUpperCase().match(/[A-Z]/g) ?? []));
}

function generateExamCode(examName: string) {
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

function EOSContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const EXAM_DURATION_MINUTES = 60;

    const [timeLeft, setTimeLeft] = useState(EXAM_DURATION_MINUTES * 60);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [examName, setExamName] = useState("");
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [confirmedAnswers, setConfirmedAnswers] = useState<Record<number, string>>({});
    const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({});
    const [isQuestionImageLoading, setIsQuestionImageLoading] = useState(true);
    const [isQuestionImageError, setIsQuestionImageError] = useState(false);
    const [isFinishConfirmed, setIsFinishConfirmed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [resultSummary, setResultSummary] = useState<ExamResultSummary | null>(null);
    const [securityWarning, setSecurityWarning] = useState<string | null>(null);
    const [securityViolationCount, setSecurityViolationCount] = useState(0);
    const [requiresFullscreenAction, setRequiresFullscreenAction] = useState(false);
    const lastViolationAtRef = useRef(0);
    const requestingFullscreenRef = useRef(false);
    const suppressSecurityWarningsRef = useRef(false);
    const suppressSecurityWarningsUntilRef = useRef(0);
    const lastFullscreenStateRef = useRef<boolean | null>(null);
    const hasEnteredFullscreenRef = useRef(false);

    const selectedSubject = searchParams.get("subject") ?? "";
    const selectedExamName = searchParams.get("exam") ?? "";
    const mode = (searchParams.get("mode") ?? "").toLowerCase();
    const entry = (searchParams.get("entry") ?? "").toLowerCase();
    const isReviewMode = ["review", "on-tap", "ontap", "practice"].includes(mode);
    const isMockExamMode = !isReviewMode;
    const shouldAutoRequestFromIndex = isMockExamMode && entry === "index";

    useEffect(() => {
        if (!selectedSubject || !selectedExamName) {
            setError("Thiếu thông tin đề thi. Vui lòng quay lại trang danh sách để chọn đề.");
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        fetch("/db_final.json")
            .then((res) => {
                if (!res.ok) {
                    throw new Error("Không thể tải dữ liệu đề.");
                }

                return res.json() as Promise<DatabaseRoot>;
            })
            .then((data) => {
                const normalizedSelectedExamName = normalizeExamName(selectedExamName);
                let selectedExam: QuestionData | undefined;

                for (const semesterGroup of Object.values(data)) {
                    const examsBySubject = semesterGroup?.[selectedSubject] ?? [];
                    const found = examsBySubject.find(
                        (item) => normalizeExamName(item.name) === normalizedSelectedExamName,
                    );

                    if (found) {
                        selectedExam = found;
                        break;
                    }
                }

                if (!selectedExam) {
                    throw new Error("Không tìm thấy đề đã chọn.");
                }

                const answerOverrides = readAnswerOverrides(selectedSubject, selectedExam.name);
                const mergedQuestions = selectedExam.questions.map((question) => ({
                    ...question,
                    answer: getEffectiveAnswerForQuestion(question, answerOverrides),
                }));

                setExamName(selectedExam.name);
                setQuestions(mergedQuestions);
                setCurrentIndex(0);
                setAnswers({});
                setConfirmedAnswers({});
                setRevealedAnswers({});
                setIsFinishConfirmed(false);
                setTimeLeft(EXAM_DURATION_MINUTES * 60);
                setResultSummary(null);
                setSecurityWarning(null);
                setSecurityViolationCount(0);
                setRequiresFullscreenAction(false);
                lastViolationAtRef.current = 0;
                lastFullscreenStateRef.current = null;
                hasEnteredFullscreenRef.current = false;
            })
            .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : "Có lỗi khi tải đề thi.");
            })
            .finally(() => {
                setLoading(false);
            });
    }, [selectedExamName, selectedSubject]);

    useEffect(() => {
        if (timeLeft <= 0 || loading || error || resultSummary) return;

        const timer = setInterval(() => {
            setTimeLeft((prev) => prev - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [error, loading, resultSummary, timeLeft]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    const currentQuestion = questions[currentIndex];
    const examDisplayCode = useMemo(() => generateExamCode(examName || selectedExamName), [examName, selectedExamName]);
    const examCheckImage = useMemo(
        () => generateExamCheckImage(selectedSubject || "unknown", examName || selectedExamName, examDisplayCode),
        [examDisplayCode, examName, selectedExamName, selectedSubject],
    );

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
        return extractCorrectOptions(currentQuestion?.answer ?? null);
    }, [currentQuestion?.answer]);

    const answerOptions = useMemo(() => {
        const baseOptions = ["A", "B", "C", "D", "E"];
        const extraOptions = [...correctOptionsForCurrent]
            .filter((option) => !baseOptions.includes(option))
            .sort((a, b) => a.localeCompare(b));

        return [...baseOptions, ...extraOptions];
    }, [correctOptionsForCurrent]);

    const isCurrentAnswerRevealed = Boolean(revealedAnswers[currentIndex]);
    const hasCurrentAnswerKey = correctOptionsForCurrent.size > 0;

    const buildResultSummary = (): ExamResultSummary => {
        const totalQuestions = questions.length;
        let missingKeyQuestions = 0;
        let answeredQuestions = 0;
        let correctAnswers = 0;
        let incorrectAnswers = 0;
        let answeredWithoutKey = 0;

        questions.forEach((question, index) => {
            const selectedAnswer = normalizeAnswerValue(answers[index] ?? "");
            const hasUserAnswer = selectedAnswer.length > 0;
            const normalizedCorrectAnswer = normalizeAnswerValue(question.answer);
            const hasKey = hasAnswerKey(normalizedCorrectAnswer);

            if (hasUserAnswer) {
                answeredQuestions += 1;
            }

            if (!hasKey) {
                missingKeyQuestions += 1;
                if (hasUserAnswer) {
                    answeredWithoutKey += 1;
                }
                return;
            }

            if (!hasUserAnswer) {
                return;
            }

            if (selectedAnswer === normalizedCorrectAnswer) {
                correctAnswers += 1;
            } else {
                incorrectAnswers += 1;
            }
        });

        const gradableQuestions = totalQuestions - missingKeyQuestions;
        const unansweredQuestions = totalQuestions - answeredQuestions;
        const scorePercent = gradableQuestions > 0 ? (correctAnswers / gradableQuestions) * 100 : 0;
        const scoreOnTen = gradableQuestions > 0 ? (correctAnswers / gradableQuestions) * 10 : 0;

        return {
            totalQuestions,
            gradableQuestions,
            missingKeyQuestions,
            answeredQuestions,
            unansweredQuestions,
            correctAnswers,
            incorrectAnswers,
            answeredWithoutKey,
            scorePercent,
            scoreOnTen,
        };
    };

    const handleFinish = () => {
        if (!questions.length || !isFinishConfirmed) return;
        setResultSummary(buildResultSummary());
    };

    const handleNext = () => {
        if (!questions.length) return;

        if (answers[currentIndex]) {
            setConfirmedAnswers((prev) => ({
                ...prev,
                [currentIndex]: answers[currentIndex],
            }));
        }

        if (currentIndex < questions.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            setCurrentIndex(0);
        }
    };

    const handleBack = () => {
        if (!questions.length) return;

        if (answers[currentIndex]) {
            setConfirmedAnswers((prev) => ({
                ...prev,
                [currentIndex]: answers[currentIndex],
            }));
        }

        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        } else {
            setCurrentIndex(questions.length - 1);
        }
    };

    const handleAnswerSelect = (option: string) => {
        setAnswers((prev) => ({
            ...prev,
            [currentIndex]: option,
        }));
    };

    const handleShowAnswer = () => {
        if (!isReviewMode || !hasCurrentAnswerKey) return;

        setRevealedAnswers((prev) => ({
            ...prev,
            [currentIndex]: !prev[currentIndex],
        }));
    };

    const registerViolation = useCallback((reason: string) => {
        const now = Date.now();
        if (suppressSecurityWarningsRef.current || now < suppressSecurityWarningsUntilRef.current) return;

        if (now - lastViolationAtRef.current < 800) return;

        lastViolationAtRef.current = now;
        setSecurityViolationCount((prev) => prev + 1);
        setSecurityWarning(reason);
    }, []);

    const requestFullscreenIfNeeded = useCallback(
        async (failureMessage: string, isUserGesture = false) => {
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
        },
        [registerViolation],
    );

    useEffect(() => {
        if (!isMockExamMode || loading || error || questions.length === 0 || resultSummary) return;

        lastFullscreenStateRef.current = Boolean(document.fullscreenElement);
        if (document.fullscreenElement) {
            hasEnteredFullscreenRef.current = true;
        }

        if (!document.fullscreenElement) {
            setRequiresFullscreenAction(true);
            if (shouldAutoRequestFromIndex) {
                void requestFullscreenIfNeeded("Không thể bật toàn màn hình tự động. Vui lòng cho phép fullscreen.");
            }
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
    }, [error, isMockExamMode, loading, questions.length, registerViolation, requestFullscreenIfNeeded, resultSummary, shouldAutoRequestFromIndex]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (loading || error || questions.length === 0) return;

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

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [error, isReviewMode, loading, questions.length, currentIndex, answers]);

    if (loading) {
        return (
            <main className="eos-root win-root min-h-screen select-none p-5 text-[12px]">
                <section className="win-panel mx-auto max-w-3xl p-4">
                    <div className="win-sunken p-3">Loading exam...</div>
                </section>
            </main>
        );
    }

    if (error) {
        return (
            <main className="eos-root win-root min-h-screen select-none p-5 text-[12px]">
                <section className="win-panel mx-auto max-w-3xl p-4">
                    <div className="win-sunken p-3 text-red-600">{error}</div>
                    <button onClick={() => router.push("/")} className="win-button mt-3 h-[24px] px-3 text-[11px]">
                        Quay về danh sách đề
                    </button>
                </section>
            </main>
        );
    }

    return (
        <main className="eos-root win-root h-screen select-none overflow-hidden text-[12px]">
            <section className="win-panel mx-auto flex h-full w-full flex-col">
                {isReviewMode && (
                    <div className="win-sunken absolute top-0 right-0 z-30 w-[220px] p-1.5 text-[10px] leading-[1.35] text-[#2f2f2f]">
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
                    <div className="relative grid max-w-[900px] grid-cols-[1fr_300px] gap-x-4">

                        <div className="relative">
                            <div className="pl-4 flex items-center">
                                <div className="flex items-center text-[13px] leading-none font-bold text-[#2a2a2a]">
                                    03.04.05.06(STUDENT)
                                    {/* {isReviewMode && (
                                        <span className="ml-2 rounded bg-[#e8f5e7] px-1.5 py-[1px] text-[10px] font-semibold text-[#2e8f2f]">
                                            Review mode
                                        </span>
                                    )} */}
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
                                            <b>{examName || "N/A"}</b>
                                        </td>
                                        <td rowSpan={2} className="align-top">
                                            <button
                                                onClick={handleFinish}
                                                disabled={!isFinishConfirmed}
                                                className="win-dark-button -mt-5 h-10 w-[88px] shrink-0 text-[11px] leading-[1.08] text-black"
                                            >
                                                Finish
                                                <br />
                                                (Submit)
                                            </button>
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
                                        <td className="pr-4"><b>1</b></td>
                                        {/* <td className="pr-4"><b>{currentIndex + 1}</b></td> */}
                                        <td className="pr-1 text-right whitespace-nowrap">Total Marks:</td>
                                        <td colSpan={2}>
                                            <div className="flex items-center">
                                                <b className="w-[32px]">{questions.length}</b>
                                                <div className="ml-[11px]">
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
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={examCheckImage} alt="img check" className="max-h-full max-w-full object-contain" />
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="mx-3 mt-1 min-h-0 flex-1 border border-[#cdcdcd] bg-white">
                    <div className="flex h-full flex-col p-0.5">
                        <div className="ml-19 mr-1 mb-1 mt-4 flex shrink-0 items-center gap-2 px-1 text-[13px]">
                            <span className="font-bold text-[#3f9a34]">
                                There are {questions.length} questions, and your progress of answering is
                            </span>
                            <div className="win-progress-bg relative h-5 flex-1">
                                <div
                                    className={`win-progress-bar ${Object.keys(confirmedAnswers).length === questions.length ? "animation-none after:hidden" : ""}`}
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                        </div>

                        <div className="grid min-h-0 flex-1 grid-cols-[86px_1fr] bg-white">
                            <aside className="flex flex-col items-center px-2 pt-1.5 text-[13px]">
                                <div className="w-full">
                                    <div className="mb-2 text-center font-semibold text-[#2e8f2f]">Answer</div>
                                    <div className="flex flex-col items-center space-y-3.5">
                                        {answerOptions.map((item) => (
                                            <label key={item} className="flex w-11 items-center gap-1.5">
                                                <input
                                                    type="checkbox"
                                                    className="h-3.5 w-3.5"
                                                    checked={answers[currentIndex] === item}
                                                    onChange={() => handleAnswerSelect(item)}
                                                />
                                                <span>{item}</span>
                                                {isReviewMode && isCurrentAnswerRevealed && correctOptionsForCurrent.has(item) && (
                                                    <span className="text-[14px] font-black leading-none text-[#2e8f2f]">✓</span>
                                                )}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="mt-18 mb-2 flex justify-center gap-1">
                                    <button onClick={handleBack} className="win-button-modern h-5 w-9 text-[10px]">Back</button>
                                    <button onClick={handleNext} className="win-button-modern h-5 w-9 text-[10px]">Next</button>
                                </div>

                                {isReviewMode && (
                                    <button
                                        onClick={handleShowAnswer}
                                        disabled={!hasCurrentAnswerKey}
                                        className="win-button-modern min-h-5 max-w-full px-1.5 py-0.5 text-center text-[10px] leading-tight whitespace-normal break-words disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {!hasCurrentAnswerKey ? "No answer key" : isCurrentAnswerRevealed ? "Hide answer" : "Show answer"}
                                    </button>
                                )}
                            </aside>

                            <article className="relative mr-2 min-h-0 px-1 py-0.5">
                                <div className="win-main absolute inset-0 overflow-y-auto overflow-x-hidden p-1.5 text-[12px] leading-[1.35] text-[#353535]">
                                    {currentQuestion && (
                                        <div className="w-full">
                                            <div className="relative min-h-[220px] w-full overflow-hidden bg-[#f6f6f6]">
                                                {isQuestionImageLoading && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-[#f6f6f6] text-[13px] text-[#6b6b6b]">
                                                        <div className="flex flex-col items-center gap-2">
                                                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#c9c9c9] border-t-[#3f9a34]" />
                                                            <span>Loading question...</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {isQuestionImageError && !isQuestionImageLoading && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-[#f6f6f6] px-4 text-center text-[13px] text-[#a94442]">
                                                        Không tải được ảnh câu hỏi. Vui lòng thử tắt VPN nếu đang bật hoặc chuyển câu khác.
                                                    </div>
                                                )}

                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={currentQuestion.image_url}
                                                    alt={`Question ${currentIndex + 1}`}
                                                    className={`block h-auto w-full ${isQuestionImageLoading ? "invisible" : "visible"}`}
                                                    onLoad={() => setIsQuestionImageLoading(false)}
                                                    onError={() => {
                                                        setIsQuestionImageLoading(false);
                                                        setIsQuestionImageError(true);
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </article>
                        </div>
                    </div>
                </div>

                <footer className="relative flex items-end justify-between px-2.5 pb-1.5 pt-12">
                    <div className="z-10 w-[300px]">
                        <label className="mb-1 flex items-center gap-1 text-[12px] text-[#4a4a4a]">
                            <input
                                type="checkbox"
                                className="h-3.5 w-3.5"
                                checked={isFinishConfirmed}
                                onChange={(event) => setIsFinishConfirmed(event.target.checked)}
                            />
                            <span>I want to finish the exam.</span>
                        </label>
                        <button
                            onClick={handleFinish}
                            disabled={!isFinishConfirmed}
                            className="win-yellow-button h-[22px] w-[80px] text-[11px] font-bold disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Finish
                        </button>
                    </div>

                    <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-0.5">
                        <span
                            className="text-[42px] leading-none tracking-[0.5px]"
                            style={{ color: securityViolationCount > 0 ? "#d63b3b" : "#d5a32a" }}
                        >
                            WEB RUNNING
                        </span>
                    </div>

                    <div className="z-10 flex w-[300px] items-end justify-end gap-1.5 pb-0.5 text-[11px]">
                        {/* <button onClick={() => router.push("/")} className="win-button h-5 px-2">Exam List</button> */}
                        <button onClick={() => router.push("/")} className="win-button h-5 w-12">Exit</button>
                    </div>
                </footer>

                {resultSummary && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
                        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
                            <h2 className="mb-3 text-xl font-bold text-slate-800">Kết quả bài làm</h2>

                            <div className="space-y-1.5 text-sm text-slate-700">
                                <div>Tổng câu: <b>{resultSummary.totalQuestions}</b></div>
                                <div>Đã trả lời: <b>{resultSummary.answeredQuestions}</b></div>
                                <div>Chưa trả lời: <b>{resultSummary.unansweredQuestions}</b></div>
                                <div>Đúng: <b className="text-emerald-700">{resultSummary.correctAnswers}</b></div>
                                <div>Sai: <b className="text-rose-700">{resultSummary.incorrectAnswers}</b></div>
                                <div>
                                    Điểm (thang 10):
                                    <b className="ml-1">{resultSummary.scoreOnTen.toFixed(2)}/10</b>
                                    <span className="ml-1">({resultSummary.correctAnswers}/{resultSummary.gradableQuestions} câu đúng)</span>
                                </div>
                            </div>

                            {resultSummary.missingKeyQuestions > 0 && (
                                <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                    Có <b>{resultSummary.missingKeyQuestions}</b> câu chưa có đáp án key nên không được tính điểm.
                                    {resultSummary.answeredWithoutKey > 0 && (
                                        <span> Bạn đã trả lời <b>{resultSummary.answeredWithoutKey}</b> câu trong số đó.</span>
                                    )}
                                </div>
                            )}

                            <div className="mt-4 flex flex-wrap justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setResultSummary(null)}
                                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                    Đóng
                                </button>
                                <button
                                    type="button"
                                    onClick={() => router.push("/")}
                                    className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                                >
                                    Về danh sách đề
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isMockExamMode && securityWarning && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
                        <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-5 shadow-2xl">
                            <h2 className="mb-2 text-lg font-bold text-rose-700">Cảnh báo vi phạm chế độ thi thử</h2>
                            <p className="text-sm text-slate-700">{securityWarning}</p>
                            <p className="mt-2 text-xs text-slate-500">
                                Số lần cảnh báo: <b>{securityViolationCount}</b>
                            </p>

                            <div className="mt-4 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSecurityWarning(null)}
                                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                    Đã hiểu
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isMockExamMode && requiresFullscreenAction && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4">
                        <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl">
                            <h2 className="mb-2 text-lg font-bold text-amber-700">Bắt buộc toàn màn hình</h2>
                            <p className="text-sm text-slate-700">
                                Chế độ thi thử bắt buộc phải ở chế độ toàn màn hình. Bấm nút bên dưới để tiếp tục thi thử.
                            </p>

                            <div className="mt-4 flex justify-end">
                                <button
                                    type="button"
                                    onClick={() =>
                                        void requestFullscreenIfNeeded(
                                            "Không thể bật toàn màn hình. Vui lòng kiểm tra quyền fullscreen của trình duyệt.",
                                            true,
                                        )
                                    }
                                    className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-500"
                                >
                                    Bật fullscreen để tiếp tục
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </section>
        </main>
    );
}

export default function EOSPage() {
    return (
        <Suspense
            fallback={
                <main className="eos-root win-root min-h-screen select-none p-5 text-[12px]">
                    <section className="win-panel mx-auto max-w-3xl p-4">
                        <div className="win-sunken p-3">Đang tải đề thi...</div>
                    </section>
                </main>
            }
        >
            <EOSContent />
        </Suspense>
    );
}