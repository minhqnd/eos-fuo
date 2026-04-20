"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  countMissingAnswersForQuestions,
  getEffectiveAnswerForQuestion,
  normalizeAnswerValue,
  normalizeExamName,
  readAnswerOverrides,
  writeAnswerOverrides,
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

const CIRCLE_OPTIONS = ["A", "B", "C", "D", "E", "F"];

function AnswerEditorContent() {
  const searchParams = useSearchParams();
  const selectedSubject = searchParams.get("subject") ?? "";
  const selectedExamName = searchParams.get("exam") ?? "";

  const [examName, setExamName] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoSaveTick, setAutoSaveTick] = useState(0);

  useEffect(() => {
    if (!selectedSubject || !selectedExamName) {
      setError("Thiếu thông tin đề. Vui lòng quay lại trang danh sách để chọn đề.");
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
        const normalizedTargetExamName = normalizeExamName(selectedExamName);
        let selectedExam: QuestionData | undefined;

        for (const semesterGroup of Object.values(data)) {
          const examsBySubject = semesterGroup?.[selectedSubject] ?? [];
          const found = examsBySubject.find(
            (item) => normalizeExamName(item.name) === normalizedTargetExamName,
          );

          if (found) {
            selectedExam = found;
            break;
          }
        }

        if (!selectedExam) {
          throw new Error("Không tìm thấy đề đã chọn.");
        }

        setExamName(selectedExam.name);
        setQuestions(selectedExam.questions);
        setOverrides(readAnswerOverrides(selectedSubject, selectedExam.name));
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Có lỗi khi tải dữ liệu đề.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedExamName, selectedSubject]);

  const missingCount = useMemo(() => {
    return countMissingAnswersForQuestions(questions, overrides);
  }, [questions, overrides]);

  const changedCount = useMemo(() => {
    return questions.filter((question) => Object.prototype.hasOwnProperty.call(overrides, question.id)).length;
  }, [questions, overrides]);

  const setQuestionAnswer = (question: Question, nextValue: string) => {
    const originalAnswer = normalizeAnswerValue(question.answer);
    const normalizedNextValue = normalizeAnswerValue(nextValue);

    setOverrides((prev) => {
      const next = { ...prev };
      if (normalizedNextValue === originalAnswer) {
        delete next[question.id];
      } else {
        next[question.id] = normalizedNextValue;
      }

      if (selectedSubject && examName) {
        writeAnswerOverrides(selectedSubject, examName, next);
        setAutoSaveTick(Date.now());
      }

      return next;
    });
  };

  if (loading) {
    return (
      <main className="min-h-screen p-6 text-slate-800">
        <section className="mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          Đang tải dữ liệu đề...
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen p-6 text-slate-800">
        <section className="mx-auto max-w-4xl space-y-4 rounded-xl border border-rose-300 bg-rose-50 p-5 text-rose-700">
          <p>{error}</p>
          <Link href="/" className="inline-flex rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white">
            Quay lại danh sách đề
          </Link>
        </section>
      </main>
    );
  }

  const baseExamHref = `/eos?subject=${encodeURIComponent(selectedSubject)}&exam=${encodeURIComponent(examName)}`;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-800 md:px-8">
      <section className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                Sửa đáp án đề thi
              </p>
              <h1 className="mt-2 text-xl font-bold tracking-tight md:text-2xl">{examName}</h1>
              <p className="mt-1 text-sm text-slate-600">Môn: <b>{selectedSubject}</b></p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-slate-500">Tổng câu</div>
                <div className="mt-1 text-lg font-bold">{questions.length}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-slate-500">Thiếu đáp án</div>
                <div className={`mt-1 text-lg font-bold ${missingCount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {missingCount}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {/* <Link
              href={`${baseExamHref}&mode=review`}
              className="inline-flex h-9 items-center rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100"
            >
              Mở ôn tập
            </Link>

            <Link
              href={baseExamHref}
              className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Mở thi thử
            </Link> */}

            <Link
              href="/"
              className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Quay lại Trang chủ
            </Link>
          </div>

          <div className="mt-3 text-sm text-slate-600">
            Đang có <b>{changedCount}</b> câu được chỉnh khác đáp án FuOverflow.
            {autoSaveTick > 0 && <span className="ml-2 font-medium text-emerald-700">Đã tự lưu.</span>}
          </div>
        </header>

        <div className="space-y-4">
          {questions.map((question, index) => {
            const originalAnswer = normalizeAnswerValue(question.answer);
            const hasOverride = Object.prototype.hasOwnProperty.call(overrides, question.id);
            const effectiveAnswer = getEffectiveAnswerForQuestion(question, overrides) ?? "";

            return (
              <article key={question.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-800">Câu {index + 1} • ID: {question.id}</div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                      FuOverflow: {originalAnswer || "(trống)"}
                    </span>
                    {hasOverride && (
                      <span className="rounded-full bg-indigo-100 px-2.5 py-1 font-semibold text-indigo-700">
                        Local: {effectiveAnswer || "(trống)"}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mb-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={question.image_url}
                    alt={`Câu ${index + 1}`}
                    className="max-h-[460px] w-full rounded-lg border border-slate-200 object-contain"
                  />
                </div>

                <div className="grid gap-2 md:grid-cols-[260px_1fr] md:items-center">
                  <label className="text-sm font-medium text-slate-700">Đáp án dùng cho EOS</label>
                  <div className="flex flex-wrap items-center gap-2.5">
                    {CIRCLE_OPTIONS.map((option) => {
                      const isSelected = effectiveAnswer === option;
                      const isFuOverflowAnswer = originalAnswer === option;

                      return (
                        <button
                          key={`${question.id}-${option}`}
                          type="button"
                          onClick={() => setQuestionAnswer(question, option)}
                          className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold transition ${isSelected
                            ? "border-indigo-600 bg-indigo-600 text-white shadow"
                            : "border-slate-300 bg-white text-slate-700 hover:border-indigo-400"} ${isFuOverflowAnswer ? "ring-2 ring-amber-400 ring-offset-2" : ""}`}
                          title={isFuOverflowAnswer ? "Đáp án gốc từ FuOverflow" : undefined}
                        >
                          {option}
                          {isFuOverflowAnswer && (
                            <span className="absolute -top-1 -right-1 rounded-full bg-amber-400 px-1 text-[9px] font-bold leading-4 text-amber-950">
                              FUOd
                            </span>
                          )}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => setQuestionAnswer(question, "")}
                      disabled={!effectiveAnswer}
                      className="inline-flex h-10 items-center rounded-full border border-rose-300 bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Xoá đáp án
                    </button>

                    {hasOverride && (
                      <button
                        type="button"
                        onClick={() => setQuestionAnswer(question, originalAnswer)}
                        className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        Khôi phục đáp án gốc
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

export default function AnswerEditorPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen p-6 text-slate-800">
          <section className="mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            Đang tải dữ liệu đề...
          </section>
        </main>
      }
    >
      <AnswerEditorContent />
    </Suspense>
  );
}
