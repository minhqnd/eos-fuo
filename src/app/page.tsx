"use client";

import { useState, useEffect } from "react";

interface Question {
  id: string;
  image_url: string;
  answer: string;
}

interface QuestionData {
  thread_url: string;
  name: string;
  questions: Question[];
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

export default function Home() {
  const [timeLeft, setTimeLeft] = useState(20 * 60); // 20 minutes in seconds
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [examName, setExamName] = useState("");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [confirmedAnswers, setConfirmedAnswers] = useState<Record<number, string>>({});

  useEffect(() => {
    fetch("/demo_question.json")
      .then((res) => res.json())
      .then((data: QuestionData) => {
        setQuestions(data.questions);
        setExamName(data.name);
      });
  }, []);

  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const currentQuestion = questions[currentIndex];

  const handleNext = () => {
    // Confirm the current answer before moving to the next question
    if (answers[currentIndex]) {
      setConfirmedAnswers((prev) => ({
        ...prev,
        [currentIndex]: answers[currentIndex],
      }));
    }

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleBack = () => {
    // Confirm the current answer before moving back
    if (answers[currentIndex]) {
      setConfirmedAnswers((prev) => ({
        ...prev,
        [currentIndex]: answers[currentIndex],
      }));
    }

    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleAnswerSelect = (option: string) => {
    setAnswers((prev) => ({
      ...prev,
      [currentIndex]: option,
    }));
  };

  return (
    <main className="win-root h-screen overflow-hidden text-[12px]">
      <section className="win-panel mx-auto flex h-full w-full flex-col">
        <header className="relative pt-1 pb-0.5">
          <div className="grid max-w-[900px] grid-cols-[1fr_300px] gap-x-4">
            {/* LEFT COLUMN */}
            <div className="relative">
              {/* Row 1: student text + Finish button */}
              <div className="pl-4 flex items-center">
                <div className="flex items-center text-[13px] leading-none font-bold text-[#2a2a2a]">
                  03.04.05.06(STUDENT)
                  <label className="ml-1 flex items-center font-normal">
                    <input type="checkbox" className="mr-1 h-3.5 w-3.5" />
                    I want to finish the exam.
                  </label>
                </div>
              </div>

              {/* Info table */}
              <table className="mt-1 border-separate border-spacing-y-1.5 text-[12px] leading-tight">
                <tbody>
                  <tr>
                    <td className="pr-1 text-right whitespace-nowrap">Server:</td>
                    <td className="pr-4"><b>EOS_Hehe_6767</b></td>
                    <td className="pr-1 text-right whitespace-nowrap">Exam Code:</td>
                    <td className="max-w-[110px] overflow-hidden text-ellipsis whitespace-nowrap">
                      <b>{examName || "1"}</b>
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
                    <td className="pr-4"><b>{(currentIndex + 1)}</b></td>
                    <td className="pr-1 text-right whitespace-nowrap">Total Marks:</td>
                    <td colSpan={2}>
                      <div className="flex items-center">
                        <b className="w-[32px]">28.5</b>
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

            {/* RIGHT COLUMN: avatar/time + 27648/Ferrari */}
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
                <div className="relative h-[72px] w-[72px] mt-1 flex items-center justify-center mt-5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/porsche.png" alt="img check" className="max-h-full max-w-full object-contain" />
                </div>
              </div>
            </div>
          </div>

        </header>

        <div className="mx-3 mt-1 min-h-0 flex-1 border border-[#cdcdcd] bg-white">
          <div className="flex h-full flex-col p-0.5">
            <div className="ml-22 mb-1 flex items-center gap-2 px-1 text-[14px] mt-4 shrink-0">
              <span className="font-bold text-[#3f9a34]">
                There are {questions.length} questions, and your progress of answering is
              </span>
              <div className="win-progress-bg relative h-5 flex-1">
                <div 
                  className={`win-progress-bar ${Object.keys(confirmedAnswers).length === questions.length ? 'animation-none after:hidden' : ''}`} 
                  style={{ width: `${(Object.keys(confirmedAnswers).length / questions.length) * 100}%` }}
                />
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-[86px_1fr] bg-white">
              <aside className="px-2 pt-1.5 text-[14px] flex flex-col items-center">
                <div className="w-full">
                  <div className="mb-2 font-semibold text-[#2e8f2f] text-center">Answer</div>
                  <div className="space-y-3.5 flex flex-col items-center">
                    {(["A", "B", "C", "D"] as const).map((item) => (
                      <label key={item} className="flex w-8 items-center gap-1.5">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5"
                          checked={answers[currentIndex] === item}
                          onChange={() => handleAnswerSelect(item)}
                        />
                        <span>{item}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mt-18 mb-4 flex gap-1 justify-center">
                  <button onClick={handleBack} disabled={currentIndex === 0} className="win-button h-5 w-10 text-[11px] disabled:opacity-50">Back</button>
                  <button onClick={handleNext} disabled={currentIndex === questions.length - 1} className="win-button h-5 w-10 text-[11px] disabled:opacity-50">Next</button>
                </div>
              </aside>

              <article className="min-h-0 px-1 py-0.5 mr-2 relative">
                <div className="win-main absolute inset-0 overflow-y-auto overflow-x-hidden p-1.5 text-[12px] leading-[1.35] text-[#353535]">
                  {currentQuestion && (
                    <div className="w-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={currentQuestion.image_url}
                        alt={`Question ${currentIndex + 1}`}
                        className="block w-full h-auto"
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

          <div className="absolute inset-0 flex items-end justify-center pb-0.5">
            <span className="text-[42px] leading-none tracking-[0.5px] text-[#d5a32a]">WEB RUNNING</span>
          </div>

          <div className="z-10 flex w-[300px] items-end justify-end gap-1.5 pb-0.5 text-[11px]">
            {/* <button className="win-button h-5 w-[70px]">Reconnect</button>
            <div className="win-combo h-5 w-[130px]">
              <span>FPTU-EXAMONLINE</span>
              <span className="win-combo-arrow">▾</span>
            </div> */}
            <button className="win-button h-5 w-12">Exit</button>
          </div>
        </footer>
      </section>
    </main>
  );
}
