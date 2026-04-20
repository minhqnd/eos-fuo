/* eslint-disable tailwindcss/enforces-shorthand, tailwindcss/no-contradicting-classname */
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
    getEffectiveAnswerForQuestion,
    normalizeExamName,
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

function extractCorrectOptions(answer: string | null) {
    if (!answer) return new Set<string>();
    return new Set((answer.toUpperCase().match(/[A-Z]/g) ?? []));
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

    const [timeLeft, setTimeLeft] = useState(20 * 60);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [examName, setExamName] = useState("");
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [confirmedAnswers, setConfirmedAnswers] = useState<Record<number, string>>({});
    const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const selectedSubject = searchParams.get("subject") ?? "";
    const selectedExamName = searchParams.get("exam") ?? "";
    const mode = (searchParams.get("mode") ?? "").toLowerCase();
    const isReviewMode = ["review", "on-tap", "ontap", "practice"].includes(mode);

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
                setTimeLeft(20 * 60);
            })
            .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : "Có lỗi khi tải đề thi.");
            })
            .finally(() => {
                setLoading(false);
            });
    }, [selectedExamName, selectedSubject]);

    useEffect(() => {
        if (timeLeft <= 0 || loading || error) return;

        const timer = setInterval(() => {
            setTimeLeft((prev) => prev - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [error, loading, timeLeft]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    const currentQuestion = questions[currentIndex];

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
            <main className="eos-root win-root min-h-screen p-5 text-[12px]">
                <section className="win-panel mx-auto max-w-3xl p-4">
                    <div className="win-sunken p-3">Đang tải đề thi...</div>
                </section>
            </main>
        );
    }

    if (error) {
        return (
            <main className="eos-root win-root min-h-screen p-5 text-[12px]">
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
        <main className="eos-root win-root h-screen overflow-hidden text-[12px]">
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
                                        <input type="checkbox" className="mr-1 h-3.5 w-3.5" />
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
                                            <button className="win-dark-button -mt-5 h-10 w-[88px] shrink-0 text-[11px] leading-[1.08] text-black">
                                                Finish
                                                <br />
                                                (Submit)
                                            </button>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="pr-1 text-right whitespace-nowrap">Duration:</td>
                                        <td className="pr-4"><b>20 minutes</b></td>
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
                                <div className="text-[34px]  leading-none font-medium text-[#2f2f2f]">27648</div>
                                <div className="relative mt-5 flex h-[72px] w-[72px] items-center justify-center">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src="/porsche.png" alt="img check" className="max-h-full max-w-full object-contain" />
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
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={currentQuestion.image_url}
                                                alt={`Question ${currentIndex + 1}`}
                                                className="block h-auto w-full"
                                            />
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
                            <input type="checkbox" className="h-3.5 w-3.5" />
                            <span>I want to finish the exam.</span>
                        </label>
                        <button className="win-yellow-button h-[22px] w-[80px] text-[11px] font-bold">Finish</button>
                    </div>

                    <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-0.5">
                        <span className="text-[42px] leading-none tracking-[0.5px] text-[#d5a32a]">WEB RUNNING</span>
                    </div>

                    <div className="z-10 flex w-[300px] items-end justify-end gap-1.5 pb-0.5 text-[11px]">
                        <button onClick={() => router.push("/")} className="win-button h-5 px-2">Exam List</button>
                        <button onClick={() => router.push("/")} className="win-button h-5 w-12">Exit</button>
                    </div>
                </footer>
            </section>
        </main>
    );
}

export default function EOSPage() {
    return (
        <Suspense
            fallback={
                <main className="eos-root win-root min-h-screen p-5 text-[12px]">
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