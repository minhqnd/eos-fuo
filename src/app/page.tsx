/* eslint-disable tailwindcss/enforces-shorthand */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { countMissingAnswersForQuestions, readAnswerOverrides } from "@/lib/answer-overrides";

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

interface ExamItem {
  id: number;
  subjectCode: string;
  exam: QuestionData;
}

interface MissingAnswerPromptState {
  missingCount: number;
  totalQuestions: number;
  targetHref: string;
  answerEditorHref: string;
  shouldEnterFullscreen: boolean;
}

export default function Home() {
  const MIN_QUESTION_COUNT = 20;
  const router = useRouter();

  const [exams, setExams] = useState<ExamItem[]>([]);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [questionCountFilter, setQuestionCountFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missingAnswerPrompt, setMissingAnswerPrompt] = useState<MissingAnswerPromptState | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement || !document.exitFullscreen) return;

    void document.exitFullscreen().catch(() => {
      // Ignore exit fullscreen errors
    });
  }, []);

  useEffect(() => {
    fetch("/db_final.json")
      .then((res) => {
        if (!res.ok) {
          throw new Error("Không thể tải dữ liệu đề.");
        }
        return res.json() as Promise<DatabaseRoot>;
      })
      .then((data) => {
        const flattened: ExamItem[] = [];
        let nextId = 1;

        for (const semesterGroup of Object.values(data)) {
          if (!semesterGroup || typeof semesterGroup !== "object") {
            continue;
          }

          for (const [subjectCode, subjectExams] of Object.entries(semesterGroup)) {
            for (const exam of subjectExams) {
              flattened.push({
                id: nextId,
                subjectCode,
                exam,
              });
              nextId += 1;
            }
          }
        }

        setExams(
          [...flattened].sort((a, b) => {
            const bySubjectDesc = b.subjectCode.localeCompare(a.subjectCode);
            if (bySubjectDesc !== 0) return bySubjectDesc;
            return b.id - a.id;
          }),
        );
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Có lỗi khi tải đề thi.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const filteredExams = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return exams.filter(({ subjectCode, exam }) => {
      const matchedMinQuestionCount = exam.questions.length >= MIN_QUESTION_COUNT;
      const matchedSubject = subjectFilter === "all" || subjectCode === subjectFilter;
      const matchedQuestionCount =
        questionCountFilter === "all" ||
        exam.questions.length === Number(questionCountFilter);
      const matchedKeyword =
        keyword.length === 0 ||
        subjectCode.toLowerCase().includes(keyword) ||
        exam.name.toLowerCase().includes(keyword);

      return matchedMinQuestionCount && matchedSubject && matchedQuestionCount && matchedKeyword;
    });
  }, [MIN_QUESTION_COUNT, exams, search, subjectFilter, questionCountFilter]);

  const subjectOptions = useMemo(() => {
    return ["all", ...Array.from(new Set(exams.map((item) => item.subjectCode))).sort((a, b) => a.localeCompare(b))];
  }, [exams]);

  const visibleExamsCount = useMemo(() => {
    return exams.filter((item) => item.exam.questions.length >= MIN_QUESTION_COUNT).length;
  }, [MIN_QUESTION_COUNT, exams]);

  const questionCountOptions = useMemo(() => {
    return [
      "all",
      ...Array.from(
        new Set(
          exams
            .map((item) => item.exam.questions.length)
            .filter((count) => count >= MIN_QUESTION_COUNT),
        ),
      )
        .sort((a, b) => a - b)
        .map(String),
    ];
  }, [MIN_QUESTION_COUNT, exams]);

  const getExamHref = (subjectCode: string, examName: string) => {
    return `/eos?subject=${encodeURIComponent(subjectCode)}&exam=${encodeURIComponent(examName)}`;
  };

  const getAnswerEditorHref = (subjectCode: string, examName: string) => {
    return `/answer-editor?subject=${encodeURIComponent(subjectCode)}&exam=${encodeURIComponent(examName)}`;
  };

  const requestFullscreenIfNeeded = async () => {
    if (typeof document === "undefined") return;
    if (document.fullscreenElement) return;

    const element = document.documentElement;
    if (!element.requestFullscreen) return;

    try {
      await element.requestFullscreen();
    } catch {
      // Ignore fullscreen request errors (browser policy or user agent limitations)
    }
  };

  const navigateToExam = async (href: string, shouldEnterFullscreen: boolean) => {
    if (shouldEnterFullscreen) {
      await requestFullscreenIfNeeded();
    }

    router.push(href);
  };

  const handleStartExam = (subjectCode: string, exam: QuestionData, mode?: "review") => {
    const overrides = readAnswerOverrides(subjectCode, exam.name);
    const missingCount = countMissingAnswersForQuestions(exam.questions, overrides);
    const shouldEnterFullscreen = mode !== "review";
    const targetHref = mode === "review"
      ? `${getExamHref(subjectCode, exam.name)}&mode=review`
      : getExamHref(subjectCode, exam.name);
    const answerEditorHref = getAnswerEditorHref(subjectCode, exam.name);

    if (missingCount > 0) {
      setMissingAnswerPrompt({
        missingCount,
        totalQuestions: exam.questions.length,
        targetHref,
        answerEditorHref,
        shouldEnterFullscreen,
      });
      return;
    }

    void navigateToExam(targetHref, shouldEnterFullscreen);
  };

  return (
    <main className="min-h-screen px-4 py-6 text-slate-800 md:px-8">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white/85 p-5 shadow-sm backdrop-blur md:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <p className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                FUO Exam Hub
              </p>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Chọn đề thi để bắt đầu làm bài</h1>
            </div>

            <div className="grid w-full max-w-xs grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-slate-500">Tổng đề (≥ {MIN_QUESTION_COUNT} câu)</div>
                <div className="mt-1 text-xl font-bold">{visibleExamsCount}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-slate-500">Đang hiển thị</div>
                <div className="mt-1 text-xl font-bold">{filteredExams.length}</div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_200px]">
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Tìm nhanh</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nhập mã môn hoặc tên đề..."
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none ring-indigo-200 transition focus:border-indigo-500 focus:ring"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Lọc theo môn</span>
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none ring-indigo-200 transition focus:border-indigo-500 focus:ring"
              >
                {subjectOptions.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject === "all" ? "Tất cả môn" : subject}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Lọc theo số câu</span>
              <select
                value={questionCountFilter}
                onChange={(e) => setQuestionCountFilter(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none ring-indigo-200 transition focus:border-indigo-500 focus:ring"
              >
                {questionCountOptions.map((count) => (
                  <option key={count} value={count}>
                    {count === "all" ? "Tất cả số câu" : `${count} câu`}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        {loading && <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">Đang tải dữ liệu đề...</div>}

        {error && <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

        {!loading && !error && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredExams.map(({ id, subjectCode, exam }) => {
              const answerEditorHref = getAnswerEditorHref(subjectCode, exam.name);

              return (
                <article
                  key={id}
                  className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {subjectCode}
                      </span>
                      <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
                        {exam.questions.length} câu
                      </span>
                    </div>

                    <Link
                      href={answerEditorHref}
                      className="inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                      Sửa đáp án
                    </Link>
                  </div>

                  <h2 className="mb-3 line-clamp-2 min-h-12 text-base font-semibold leading-snug text-slate-900">
                    {exam.name}
                  </h2>

                  <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                    <a
                      href={exam.thread_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-slate-500 transition hover:text-slate-700"
                    >
                      Xem nguồn ↗
                    </a>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleStartExam(subjectCode, exam, "review")}
                        className="inline-flex h-9 items-center rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100"
                      >
                        Ôn tập
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStartExam(subjectCode, exam)}
                        className="inline-flex h-9 items-center rounded-lg bg-indigo-600 px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                      >
                        Thi thử
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {!loading && !error && filteredExams.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-7 text-center text-sm text-slate-600">
            Không tìm thấy đề phù hợp. Thử đổi từ khóa hoặc bỏ bộ lọc môn nhé.
          </div>
        )}

        {missingAnswerPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
            <div className="relative w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-2xl">
              {/* <button
                type="button"
                onClick={() => setMissingAnswerPrompt(null)}
                className="absolute top-4 right-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-lg leading-none text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                aria-label="Đóng popup"
              >
                ×
              </button> */}

              <div className="space-y-5 p-6 md:p-8">
                <h3 className="text-2xl font-semibold text-slate-700">
                  Đề này còn thiếu {missingAnswerPrompt.missingCount}/{missingAnswerPrompt.totalQuestions} đáp án.
                </h3>
                <p className="text-xl text-slate-600">
                  Bạn có muốn mở trang <b>Sửa đáp án</b> để bổ sung trước không?
                </p>
              </div>

              <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 px-6 py-4 md:px-8">
                <button
                  type="button"
                  onClick={() => setMissingAnswerPrompt(null)}
                  className="inline-flex h-10 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Đóng
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const targetHref = missingAnswerPrompt.targetHref;
                    const shouldEnterFullscreen = missingAnswerPrompt.shouldEnterFullscreen;
                    setMissingAnswerPrompt(null);
                    void navigateToExam(targetHref, shouldEnterFullscreen);
                  }}
                  className="inline-flex h-10 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Vẫn vào đề
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const answerEditorHref = missingAnswerPrompt.answerEditorHref;
                    setMissingAnswerPrompt(null);
                    router.push(answerEditorHref);
                  }}
                  className="inline-flex h-10 items-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-500"
                >
                  Mở trang Sửa đáp án
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
