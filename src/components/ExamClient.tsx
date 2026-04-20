"use client";

import { useState, useEffect } from "react";
import type { ExamThread } from "../lib/data";
import { solveWithGroq } from "../lib/groq";

function Field({ width = "100%" }: { width?: number | string }) {
  return <span className="win-sunken block h-5 align-middle" style={{ width }} />;
}

export default function ExamClient({ exam, isRemainder = false, onClose }: { exam: ExamThread, isRemainder?: boolean, onClose: () => void }) {
  const [mode, setMode] = useState<"pre" | "practice" | "mock" | "result" | "view">("pre");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [aiAnswers, setAiAnswers] = useState<Record<string, string>>({});
  const [isSolving, setIsSolving] = useState(false);
  const [violateFullscreen, setViolateFullscreen] = useState(false);
  const [score, setScore] = useState(0);
  const [finalCorrectCount, setFinalCorrectCount] = useState(0);
  const [detectedOptions, setDetectedOptions] = useState<Record<string, number>>({});

  // Timer setup 60 minutes
  const [timeLeft, setTimeLeft] = useState(60 * 60);

  useEffect(() => {
    if (mode === "practice" || mode === "mock") {
      const interval = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            handleFinish();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [mode]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        if (mode === "mock") {
          setViolateFullscreen(true);
        }
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [mode]);

  const handleStart = (selectedMode: "practice" | "mock") => {
    setMode(selectedMode);
    if (selectedMode === "mock") {
      document.documentElement.requestFullscreen().catch(err => {
        console.error("Failed to enter fullscreen", err);
      });
    }
  };

  const handleFinish = () => {
    let correctCount = 0;
    exam.questions.forEach(q => {
      const realAnswer = q.answer || aiAnswers[q.id];
      // A question is ONLY correct if an answer exists AND it matches user answer
      if (realAnswer && userAnswers[q.id] === realAnswer) {
        correctCount++;
      }
    });
    const finalScore = (correctCount / Math.max(1, exam.questions.length)) * 10;
    setScore(finalScore);
    setFinalCorrectCount(correctCount);
    setMode("result");
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(e => console.error(e));
    }
  };

  // Auto-solve with AI if answer is missing
  useEffect(() => {
    if ((mode === "practice" || mode === "mock" || mode === "view") && !isSolving) {
      const q = exam.questions[currentIdx];
      if (q && !q.answer && !aiAnswers[q.id]) {
        handleAiSolve();
      }
    }
  }, [currentIdx, mode]);

  const handleAiSolve = async () => {
    const q = exam.questions[currentIdx];
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

    // Rotate: Pick a random key from the list
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

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

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
            <button className="win-button px-4 py-1 w-full" onClick={() => setMode("view")}>Xem đáp án (Review)</button>
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
            Correct: {finalCorrectCount} / {exam.questions.length}
          </div>
          <button className="win-button px-4 py-1 w-[80px]" onClick={onClose}>OK</button>
        </div>
      </main>
    );
  }

  if (!exam.questions || exam.questions.length === 0) {
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

  const currentQ = exam.questions[currentIdx] || { id: "0", image_url: "", answer: "A" };
  const progressRatio = exam.questions.length > 0 ? Object.keys(userAnswers).length / exam.questions.length : 0;
  const progressWidth = `${progressRatio * 100}%`;

  return (
    <main className="win-root h-full w-full overflow-hidden text-[12px]">
      <section className="win-panel mx-auto flex h-full w-full flex-col">
        <header className="relative pt-1 pb-0.5">
          <div className="grid max-w-[900px] grid-cols-[1fr_300px] gap-x-4">
            {/* LEFT COLUMN */}
            <div className="relative">
              {/* Row 1: student text + Finish button */}
              <div className="pl-4 flex items-center">
                <div className="flex items-center text-[13px] leading-none font-bold text-[#2a2a2a]">
                  03.02.20.26(STUDENT)
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
                    <td className="pr-4"><b>Eng_EOS_1403</b></td>
                    <td className="pr-1 text-right whitespace-nowrap">Exam Code:</td>
                    <td><b>1</b></td>
                    <td rowSpan={2} className="align-top">
                      {(mode === "practice" || mode === "mock") && (
                        <button
                          className="win-dark-button -mt-5 h-10 w-[88px] shrink-0 text-[11px] leading-[1.08] text-black"
                          onClick={handleFinish}
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
                    <td className="pr-4"><b>60 minutes</b></td>
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
                    <td className="pr-4"><b>{(10 / Math.max(1, exam.questions.length)).toFixed(2)}</b></td>
                    <td className="pr-1 text-right whitespace-nowrap">Total Marks:</td>
                    <td colSpan={2}>
                      <div className="flex items-center">
                        <b className="w-[32px]">10</b>
                        <div className="flex items-center gap-1 ml-[11px]" id="vol-container">
                          <span className="text-[#a0a0a0]">Vol:</span>
                          <div className="win-sunken flex h-[20px] w-[26px] items-center justify-center text-[11px] text-[#a0a0a0]">8</div>
                          <div className="flex flex-col gap-0">
                            <button className="win-button flex h-[12px] w-[22px] items-center justify-center p-0" aria-label="Volume up">
                              <span className="h-0 w-0 border-l-[5px] border-r-[5px] border-b-[8px] border-l-transparent border-r-transparent border-b-[#9f9f9f]" />
                            </button>
                            <button className="win-button flex h-[12px] w-[22px] items-center justify-center p-0" aria-label="Volume down">
                              <span className="h-0 w-0 border-l-[5px] border-r-[5px] border-t-[8px] border-l-transparent border-r-transparent border-t-[#9f9f9f]" />
                            </button>
                          </div>
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
                        <div className="win-combo h-[20px] w-[120px] text-[11px] -ml-[102px]">
                          <span className="truncate">Microsoft Sans Serif</span>
                          <span className="win-combo-arrow">▾</span>
                        </div>
                        <div className="flex items-center gap-1 ml-[25px]">
                          <span>Size:</span>
                          <div className="win-combo h-[20px] w-10 text-[11px]">
                            <span>10</span>
                            <span className="win-combo-arrow">▾</span>
                          </div>
                          <span className="ml-[18px] whitespace-nowrap text-[#4c4c4c]">Time Left:</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* RIGHT COLUMN: avatar/time + avatar/logo */}
            <div className="relative -ml-[110px] -top-[10px] flex items-start gap-12 pt-1 pl-1">
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
                  {mode === "view" ? "--:--" : formatTime(timeLeft)}
                </span>
              </div>

              <div className="relative flex shrink-0 flex-col items-center top-[10px]">
                <div className="text-[34px]  leading-none font-medium text-[#2f2f2f]">27648</div>
                <div className="relative h-[72px] w-[72px] mt-1 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/porsche.png" alt="car brand" className="max-h-full max-w-full object-contain" />
                </div>
              </div>
            </div>
          </div>

        </header>

        <div className="mx-1.5 mt-1 min-h-0 flex-1 border border-[#cdcdcd] bg-[#f6f6f6]">
          <div className="h-[calc(100%-24px)] p-0.5">
            <div className="ml-24 mb-1 flex items-center gap-2 px-1 text-[12px]">
              <span className="font-bold text-[#3f9a34]">
                There are {exam.questions.length} questions, and your progress of answering is
              </span>
              <span className="win-sunken inline-block h-5 flex-1 bg-[#e8e8e8] relative overflow-hidden">
                <span className="absolute left-0 top-0 h-full bg-[#3f9a34] transition-all duration-1000 ease-out overflow-hidden" style={{ width: progressWidth }}>
                  <span className="win-progress-glow" />
                </span>
              </span>
            </div>

            <div className="flex h-[calc(100%-28px)] bg-white overflow-hidden">
              <aside className="w-[86px] border-r border-[#bdbdbd] px-2 pt-1.5 text-[12px] flex flex-col items-center shrink-0">
                <div className="mb-2 font-semibold text-[#2e8f2f]">Answer</div>
                
                {(mode === "practice" || mode === "mock" || mode === "view") ? (
                  <div className="space-y-2 w-full pl-2">
                    {(() => {
                      // Logic: default to 4, expand if meta exists or answers suggest E/F
                      let count = 4;
                      const knownAns = currentQ.answer || aiAnswers[currentQ.id];
                      if (detectedOptions[currentQ.id]) {
                        count = detectedOptions[currentQ.id];
                      } else if (knownAns === 'F') {
                        count = 6;
                      } else if (knownAns === 'E') {
                        count = 5;
                      }

                      return (["A", "B", "C", "D", "E", "F"] as const).slice(0, count).map((item) => {
                        const isCorrect = (currentQ.answer || aiAnswers[currentQ.id]) === item;
                        const isSelected = mode === "view" ? isCorrect : userAnswers[currentQ.id] === item;
                        
                        return (
                          <label key={item} className={`flex items-center gap-1.5 ${mode === "view" && isCorrect ? "text-[#2e8f2f] font-bold" : ""}`}>
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5"
                              checked={isSelected}
                              readOnly={mode === "view"}
                              onChange={() => mode !== "view" && setUserAnswers(prev => ({ ...prev, [currentQ.id]: item }))}
                            />
                            <span>{item} {mode === "view" && isCorrect && "✓"}</span>
                          </label>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <div className="mt-4 text-[#8a8a8a] italic text-center leading-tight">
                    {isRemainder ? "Chế độ xem\n(Preview)" : "Chưa bắt đầu"}
                  </div>
                )}

                <div className="mt-[98px] flex gap-1">
                  <button
                    disabled={currentIdx === 0}
                    onClick={() => setCurrentIdx(p => Math.max(0, p - 1))}
                    className="win-button h-5 w-10 text-[11px]"
                  >
                    Back
                  </button>
                  <button
                    disabled={currentIdx === exam.questions.length - 1}
                    onClick={() => setCurrentIdx(p => Math.min(exam.questions.length - 1, p + 1))}
                    className="win-button h-5 w-10 text-[11px]"
                  >
                    Next
                  </button>
                </div>
              </aside>

              <article className="flex-1 min-w-0 relative h-full overflow-hidden">
                <div className="win-sunken h-full overflow-auto p-1.5 text-[12px] leading-[1.35] text-[#353535]">
                  <div className="flex justify-between items-start mb-2">
                    <div>(Choose 1 answer)</div>
                    {(mode === "view" && !currentQ.answer && !aiAnswers[currentQ.id]) && (
                      <button 
                        className={`win-button px-2 py-0.5 flex items-center gap-1 text-[11px] ${isSolving ? 'opacity-50' : ''}`}
                        onClick={handleAiSolve}
                        disabled={isSolving}
                      >
                        {isSolving ? '⌛ Solving...' : '🤖 Solve with AI'}
                      </button>
                    )}
                    {(mode === "view" && aiAnswers[currentQ.id]) && (
                      <div className="bg-[#e1f5fe] border border-[#03a9f4] px-2 py-0.5 rounded text-[11px] text-[#01579b] font-bold animate-pulse">
                        AI Answer: {aiAnswers[currentQ.id]}
                      </div>
                    )}
                  </div>
                  {currentQ.image_url ? (
                    <div className="flex justify-center w-full min-h-min">
                      <img 
                        src={currentQ.image_url} 
                        alt="Question Image" 
                        className="max-w-full h-auto block shadow-sm border border-[#ddd]"
                      />
                    </div>
                  ) : (
                    <div className="text-gray-500 italic mt-4">Không có hình ảnh cho câu hỏi này.</div>
                  )}
                </div>
              </article>
            </div>
          </div>
        </div>

        <footer className="relative flex items-end justify-between px-2.5 pb-1.5 pt-1">
          <div className="z-10 w-[300px]">
            {(mode === "practice" || mode === "mock") && (
              <>
                <label className="mb-1 flex items-center gap-1 text-[12px] text-[#4a4a4a]">
                  <input type="checkbox" className="h-3.5 w-3.5" />
                  <span>I want to finish the exam.</span>
                </label>
                <button className="win-yellow-button h-[22px] w-[80px] text-[11px] font-bold" onClick={handleFinish}>Finish</button>
              </>
            )}
          </div>

          <div className="absolute inset-0 flex items-end justify-center pb-0.5 pointer-events-none">
            <span className={`text-[56px] leading-none tracking-[0.5px] ${violateFullscreen ? 'text-[red]' : 'text-[#d5a32a]'}`}>
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
      </section>
    </main>
  );
}
