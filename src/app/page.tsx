const multipleChoiceLines = [
  "Đối với thi Online, sinh viên sử dụng các phần mềm hay trang web khác với phần mềm thi do nhà trường",
  "quy định khi đang thi sẽ bị hình thức kỷ luật:",
  "",
  "A. Đình chỉ thi môn học",
  "B. Cảnh cáo",
  "",
  "C. Đình chỉ thi một Học kỳ",
  "",
  "D. Buộc thôi học",
];

function Field({ width = 90 }: { width?: number }) {
  return <span className="win-sunken inline-block h-5 align-middle" style={{ width }} />;
}

export default function Home() {
  return (
    <main className="win-root h-screen overflow-hidden p-3 text-[12px]">
      <section className="win-panel mx-auto flex h-full w-full max-w-[1365px] flex-col">
        <header className="px-3 pt-1 pb-0.5">
          <div className="grid max-w-[780px] grid-cols-[1fr_auto] gap-x-6">
            {/* LEFT COLUMN */}
            <div>
              {/* Row 1: student text + Finish button */}
              <div className="flex items-start gap-4">
                <div className="flex items-center text-[13px] leading-none font-bold text-[#2a2a2a]">
                  03.02.20.26(STUDENT_L
                  <label className="ml-1 flex items-center font-normal">
                    <input type="checkbox" className="mr-1 h-3.5 w-3.5" />
                    I want to finish the exam.
                  </label>
                </div>
                <button className="win-dark-button h-10 w-[88px] shrink-0 text-[11px] leading-[1.08] text-black">
                  Finish
                  <br />
                  (Submit)
                </button>
              </div>

              {/* Info rows */}
              <div className="ml-1 text-[12px] leading-tight">
                <div className="flex gap-x-4">
                  <div>Server: <b>Eng_EOS_1403</b></div>
                  <div>Exam Code: <b>1</b></div>
                </div>
                <div className="flex gap-x-4">
                  <div>Duration: <b>20 minutes</b></div>
                  <div className="ml-2">Student: <b>2</b></div>
                </div>
                <div className="mt-[2px] flex items-center gap-x-4">
                  <div className="flex items-center"><b>Submit Code:</b> <Field width={70} /></div>
                  <div className="flex items-center"><b>Open Code:</b> <Field width={70} /></div>
                  <button className="win-button h-[22px] w-[90px] text-[11px]">Show Question</button>
                </div>
                <div className="mt-[2px] flex items-center gap-x-4">
                  <div><b>Q mark:</b> 1</div>
                  <div className="ml-6"><b>Total Marks:</b> 28.5</div>
                  <div className="flex items-center gap-1">
                    <span className="text-[#a0a0a0]">Vol:</span>
                    <div className="win-sunken flex h-[20px] w-[26px] items-center justify-center text-[11px] text-[#a0a0a0]">8</div>
                    <div className="flex flex-col gap-[1px]">
                      <button className="win-button h-[9px] w-3 text-[7px] leading-none text-[#a0a0a0]">▲</button>
                      <button className="win-button h-[9px] w-3 text-[7px] leading-none text-[#a0a0a0]">▼</button>
                    </div>
                  </div>
                </div>
                <div className="mt-[2px] flex items-center gap-x-2">
                  <div className="flex items-center gap-1">
                    <b>Font:</b>
                    <div className="win-combo h-[20px] w-[120px] text-[11px]">
                      <span className="truncate">Microsoft Sans Serif</span>
                      <span className="win-combo-arrow">▾</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <b>Size:</b>
                    <div className="win-combo h-[20px] w-10 text-[11px]">
                      <span>10</span>
                      <span className="win-combo-arrow">▾</span>
                    </div>
                  </div>
                  <div className="ml-4 flex items-end gap-[6px]">
                    <b className="mb-[8px] text-[13px] text-[#557e96]">Time Left:</b>
                    <span className="text-[52px] font-bold leading-[0.85] tracking-tight text-[#557e96]">19:36</span>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Avatar + 27648 + Ferrari */}
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="relative mt-1 shrink-0">
                <svg viewBox="0 0 24 24" className="h-12 w-12 fill-none stroke-[#c5c5c5] stroke-[1.2]">
                  <circle cx="12" cy="8" r="3.8" />
                  <path d="M4.8 21c2.2-4.5 5.4-6.8 7.2-6.8s5 2.3 7.2 6.8" />
                </svg>
                <span className="absolute right-[-2px] top-[3px] h-3 w-3 rounded-full bg-[#84d476]" />
              </div>

              {/* 27648 + Ferrari stacked */}
              <div className="flex shrink-0 flex-col items-center">
                <div className="text-[46px] leading-none font-semibold text-[#2f2f2f]">27648</div>
                <svg viewBox="0 0 120 120" className="h-[72px] w-[72px]">
                  <path d="M60 4 L100 16 L96 58 C92 82 74 99 60 114 C46 99 28 82 24 58 L20 16 Z" fill="#f6c41d" stroke="#cc2f2f" strokeWidth="3" />
                  <path d="M60 14 C45 14 33 18 28 23 C31 35 41 41 60 41 C79 41 89 35 92 23 C87 18 75 14 60 14Z" fill="#d33030" />
                  <path d="M48 70 L48 44 L60 32 L72 44 L72 70 Z" fill="#171717" />
                  <circle cx="60" cy="54" r="11" fill="#141414" />
                  <path d="M55 68 L65 68 L69 83 L51 83 Z" fill="#161616" />
                </svg>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-1.5 mt-1 min-h-0 flex-1 border border-[#cdcdcd] bg-[#f6f6f6]">
          <div className="flex h-6 items-end border-b border-[#d4d4d4] px-1 text-[11px]">
            {[
              "Reading",
              "Multiple Choices",
              "Indicate Mistake",
              "Matching",
              "Fill Blank",
            ].map((tab, i) => (
              <div
                key={tab}
                className={`mr-1 border border-[#c7c7c7] px-1 py-[2px] ${
                  i === 1 ? "border-b-white bg-white" : "bg-[#ececec]"
                }`}
              >
                {tab}
              </div>
            ))}
          </div>

          <div className="h-[calc(100%-24px)] p-0.5">
            <div className="mb-1 flex items-center gap-2 px-1 text-[12px]">
              <span className="font-bold text-[#3f9a34]">
                There are 7 questions, and your progress of answering is
              </span>
              <span className="win-sunken inline-block h-5 flex-1 bg-[#e8e8e8]" />
            </div>

            <div className="grid h-[calc(100%-28px)] grid-cols-[86px_1fr] border border-[#bfbfbf] bg-white">
              <aside className="border-r border-[#bdbdbd] bg-[#f3f3f3] px-2 pt-1.5 text-[12px]">
                <div className="mb-2 font-semibold text-[#2e8f2f]">Answer</div>
                <div className="space-y-2">
                  {(["A", "B", "C", "D"] as const).map((item) => (
                    <label key={item} className="flex items-center gap-1.5">
                      <input type="checkbox" className="h-3.5 w-3.5" />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>

                <div className="mt-[98px] flex gap-1">
                  <button className="win-button h-5 w-10 text-[11px]">Back</button>
                  <button className="win-button h-5 w-10 text-[11px]">Next</button>
                </div>
              </aside>

              <article className="min-w-0 px-1 py-0.5">
                <div className="mb-0.5 border border-[#cfcfcf] bg-[#fbfbfb] px-1 py-[2px] text-[12px]">
                  (Choose 1 answer)
                </div>

                <div className="win-sunken h-[calc(100%-22px)] overflow-auto p-1.5 text-[12px] leading-[1.35] text-[#353535]">
                  {multipleChoiceLines.map((line, idx) => (
                    <div key={`${line}-${idx}`}>{line || <span>&nbsp;</span>}</div>
                  ))}
                </div>
              </article>
            </div>
          </div>
        </div>

        <footer className="relative flex items-end justify-between px-2.5 pb-1.5 pt-1">
          <div className="z-10 w-[300px]">
            <label className="mb-1 flex items-center gap-1 text-[12px] text-[#4a4a4a]">
              <input type="checkbox" className="h-3.5 w-3.5" />
              <span>I want to finish the exam.</span>
            </label>
            <button className="win-yellow-button h-[22px] w-[80px] text-[11px] font-bold">Finish</button>
          </div>

          <div className="absolute inset-0 flex items-end justify-center pb-0.5">
            <span className="text-[56px] leading-none tracking-[0.5px] text-[#d5a32a]">LAPTOP RUNNING</span>
          </div>

          <div className="z-10 flex w-[300px] items-end justify-end gap-1.5 pb-0.5 text-[11px]">
            <button className="win-button h-5 w-[70px]">Reconnect</button>
            <div className="win-combo h-5 w-[130px]">
              <span>FPTU-EXAMONLINE</span>
              <span className="win-combo-arrow">▾</span>
            </div>
            <button className="win-button h-5 w-12">Exit</button>
          </div>
        </footer>
      </section>
    </main>
  );
}
