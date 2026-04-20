/* eslint-disable tailwindcss/enforces-shorthand */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
  subjectCode: string;
  exam: QuestionData;
}

export default function Home() {
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/db_final.json")
      .then((res) => {
        if (!res.ok) {
          throw new Error("Không thể tải dữ liệu đề.");
        }
        return res.json() as Promise<DatabaseRoot>;
      })
      .then((data) => {
        const firstLayer = Object.values(data)[0];

        if (!firstLayer || typeof firstLayer !== "object") {
          setExams([]);
          return;
        }

        const flattened: ExamItem[] = [];

        for (const [subjectCode, subjectExams] of Object.entries(firstLayer)) {
          for (const exam of subjectExams) {
            flattened.push({ subjectCode, exam });
          }
        }

        setExams(flattened);
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
    if (!keyword) {
      return exams;
    }

    return exams.filter(({ subjectCode, exam }) => {
      return (
        subjectCode.toLowerCase().includes(keyword) ||
        exam.name.toLowerCase().includes(keyword)
      );
    });
  }, [exams, search]);

  return (
    <main className="win-root min-h-screen p-5 text-[12px]">
      <section className="win-panel mx-auto max-w-6xl p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[#2f2f2f]">Danh sách đề thi</h1>
            {/* <p className="text-[#4f4f4f]">Chọn một đề để chuyển sang trang làm bài `/eos`.</p> */}
          </div>
          <div className="text-right text-[#4f4f4f]">
            <div>Tổng đề: <b>{exams.length}</b></div>
            <div>Hiển thị: <b>{filteredExams.length}</b></div>
          </div>
        </div>

        <div className="mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo môn hoặc tên đề..."
            className="win-sunken h-8 w-full px-2"
          />
        </div>

        {loading && <div className="win-sunken p-3">Đang tải dữ liệu đề...</div>}

        {error && <div className="win-sunken p-3 text-red-600">{error}</div>}

        {!loading && !error && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredExams.map(({ subjectCode, exam }, index) => {
              const href = `/eos?subject=${encodeURIComponent(subjectCode)}&exam=${encodeURIComponent(exam.name)}`;
              const uniqueKey = `${subjectCode}-${exam.name}-${exam.thread_url ?? "no-thread"}-${index}`;

              return (
                <article key={uniqueKey} className="win-raised p-3">
                  <div className="mb-1 text-[11px] text-[#5f5f5f]">{subjectCode}</div>
                  <h2 className="mb-2 line-clamp-2 min-h-[34px] text-[13px] font-bold text-[#2a2a2a]">{exam.name}</h2>
                  <div className="mb-3 text-[11px] text-[#4a4a4a]">
                    Số câu: <b>{exam.questions.length}</b>
                  </div>

                  <Link href={href} className="win-button inline-flex h-[24px] items-center px-3 text-[11px] font-bold">
                    Bắt đầu làm đề
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
