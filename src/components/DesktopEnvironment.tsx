"use client";

import { useState, useEffect, useMemo } from 'react';
import { getCurriculumSemester } from '../lib/curriculum';
import { fetchExamData } from '../app/examActions';
import ExamClient from './ExamClient';
import type { ExamThread } from '../lib/data';

type ThreadData = { thread_name: string; thread_url: string; globalIndex: number; answerStatus: 'full' | 'partial' | 'none' };
export type ExplorerTreeData = Record<string, Record<string, ThreadData[]>>;

export default function DesktopEnvironment({
  semestersData,
  remainderSemestersData
}: {
  semestersData: ExplorerTreeData;
  remainderSemestersData: ExplorerTreeData;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [viewMode, setViewMode] = useState<'date' | 'curriculum'>('date');
  const [isGroqConfigOpen, setIsGroqConfigOpen] = useState(false);
  const [isGeminiConfigOpen, setIsGeminiConfigOpen] = useState(false);
  const [groqApiKey, setGroqApiKey] = useState('');
  const [groqModel, setGroqModel] = useState('meta-llama/llama-4-scout-17b-16e-instruct');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [activeAiProvider, setActiveAiProvider] = useState<'groq' | 'gemini'>('groq');
  const [selectedSemester, setSelectedSemester] = useState<{ id: string, type: 'main' | 'remainder' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [time, setTime] = useState<string>('');

  const [activeExamMeta, setActiveExamMeta] = useState<{ subject: string, globalIndex: number, isRemainder: boolean } | null>(null);
  const [activeExamData, setActiveExamData] = useState<ExamThread | null>(null);
  const [isExamLoading, setIsExamLoading] = useState(false);

  const handleOpenExam = async (subject: string, globalIndex: number, isRemainder: boolean) => {
    setActiveExamMeta({ subject, globalIndex, isRemainder });
    setIsExamLoading(true);
    setActiveExamData(null);
    try {
      const data = await fetchExamData(subject, globalIndex, isRemainder);
      setActiveExamData(data);
    } catch (err) {
      alert("Error loading exam data from local server");
      setActiveExamMeta(null);
    } finally {
      setIsExamLoading(false);
    }
  };

  useEffect(() => {
    const savedGroqKey = localStorage.getItem('groq_api_key');
    if (savedGroqKey) setGroqApiKey(savedGroqKey);
    const savedGroqModel = localStorage.getItem('groq_model');
    if (savedGroqModel) setGroqModel(savedGroqModel);
    
    const savedGeminiKey = localStorage.getItem('gemini_api_key');
    if (savedGeminiKey) setGeminiApiKey(savedGeminiKey);
    const savedProvider = localStorage.getItem('active_ai_provider');
    if (savedProvider === 'groq' || savedProvider === 'gemini') setActiveAiProvider(savedProvider);
  }, []);

  const saveGroqConfig = (key: string) => {
    setGroqApiKey(key);
    const targetModel = 'meta-llama/llama-4-scout-17b-16e-instruct';
    setGroqModel(targetModel);
    localStorage.setItem('groq_api_key', key);
    localStorage.setItem('groq_model', targetModel);
    localStorage.setItem('active_ai_provider', 'groq');
    setActiveAiProvider('groq');
    alert('Groq config saved! Set as active solver.');
  };

  const saveGeminiConfig = (key: string) => {
    setGeminiApiKey(key);
    localStorage.setItem('gemini_api_key', key);
    localStorage.setItem('active_ai_provider', 'gemini');
    setActiveAiProvider('gemini');
    alert('Gemini config saved! Set as active solver.');
  };

  useEffect(() => {
    setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 10000); // 10 seconds to keep clock relatively updated without too many re-renders
    return () => clearInterval(interval);
  }, []);

  const sortSem = (a: string, b: string) => {
    if (a === "Other") return 1;
    if (b === "Other") return -1;
    const yearA = parseInt(a.slice(2));
    const yearB = parseInt(b.slice(2));
    if (yearA !== yearB) return yearB - yearA;
    return a.localeCompare(b);
  };

  const sortedSemesters = Object.keys(semestersData).sort(sortSem);
  const sortedRemainderSemesters = Object.keys(remainderSemestersData).sort(sortSem);

  // Group by Curriculum Calculation
  const curriculumData = useMemo(() => {
    const main: Record<string, Record<string, ThreadData[]>> = {};
    const remainder: Record<string, Record<string, ThreadData[]>> = {};

    Object.entries(semestersData).forEach(([semId, subjects]) => {
      Object.entries(subjects).forEach(([sub, threads]) => {
        const ky = getCurriculumSemester(sub);
        if (!main[ky]) main[ky] = {};
        if (!main[ky][sub]) main[ky][sub] = [];
        main[ky][sub].push(...threads);
      });
    });

    Object.entries(remainderSemestersData).forEach(([semId, subjects]) => {
      Object.entries(subjects).forEach(([sub, threads]) => {
        const ky = getCurriculumSemester(sub);
        if (!remainder[ky]) remainder[ky] = {};
        if (!remainder[ky][sub]) remainder[ky][sub] = [];
        remainder[ky][sub].push(...threads);
      });
    });

    return { main, remainder };
  }, [semestersData, remainderSemestersData]);

  const sortedCurriculumKy = Object.keys(curriculumData.main).sort();
  const sortedCurriculumRemainderKy = Object.keys(curriculumData.remainder).sort();

  // Unified semesters list for rendering
  const allUniqueSemesters = useMemo(() => {
    const sems = viewMode === 'date' 
      ? Array.from(new Set([...sortedSemesters, ...sortedRemainderSemesters])).sort(sortSem)
      : Array.from(new Set([...sortedCurriculumKy, ...sortedCurriculumRemainderKy])).sort();
    return sems;
  }, [viewMode, sortedSemesters, sortedRemainderSemesters, sortedCurriculumKy, sortedCurriculumRemainderKy]);

  if (activeExamMeta) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#0055e5] overflow-hidden">
        {isExamLoading ? (
          <div className="flex items-center justify-center h-full flex-col gap-4 text-white">
            <div className="w-10 h-10 animate-spin rounded-full border-4 border-white border-t-transparent"></div>
            <p className="text-[18px] font-bold drop-shadow-md">Loading EOS Exam System...</p>
            <p className="text-[12px] opacity-70">Please stay on this page</p>
          </div>
        ) : activeExamData ? (
          <ExamClient 
            exam={activeExamData} 
            isRemainder={activeExamMeta.isRemainder} 
            onClose={() => setActiveExamMeta(null)} 
          />
        ) : (
          <div className="flex items-center justify-center h-full flex-col gap-4 text-white">
            <p className="text-[18px] font-bold">Failed to load exam data.</p>
            <button 
              className="win-button px-6 py-2 text-black font-bold"
              onClick={() => setActiveExamMeta(null)}
            >
              Return to Desktop
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      className="relative w-screen h-screen overflow-hidden bg-[#0055e5] select-none text-[12px]"
      style={{
        backgroundImage: "url('/wallpaper.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
      onClick={() => setSelectedIcon(null)}
    >
      {/* Desktop Icons */}
      <div className="absolute top-2 left-2 flex flex-col gap-4">
        <div 
          className={`flex flex-col items-center justify-center gap-1 p-2 w-[80px] cursor-pointer rounded ${selectedIcon === 'eos' ? 'bg-[#0000aa] bg-opacity-50' : 'hover:bg-white/10'}`}
          onClick={(e) => { e.stopPropagation(); setSelectedIcon('eos'); }}
          onDoubleClick={() => setIsOpen(true)}
        >
          <img src="/favicon.ico" alt="EOS" className="w-[32px] h-[32px] object-contain drop-shadow-md filter sepia hue-rotate-[200deg] contrast-150 grayscale-0" />
          <span className="text-white text-[11px] text-center font-[500] drop-shadow-[1px_1px_1px_rgba(0,0,0,0.9)] leading-tight">EOS Exam<br/>Explorer</span>
        </div>

        {/* Groq Icon */}
        <div 
          className={`flex flex-col items-center gap-1.5 p-2 w-[75px] h-[85px] rounded-sm cursor-default group hover:bg-white/10 active:bg-white/20 border border-transparent ${selectedIcon === 'groq' ? 'bg-[#3071ed]/60 border-[#fff]/30' : ''}`}
          onClick={(e) => { e.stopPropagation(); setSelectedIcon('groq'); }}
          onDoubleClick={() => setIsGroqConfigOpen(true)}
        >
          <div className="w-[32px] h-[32px] bg-[#f0f0f0] rounded-full flex items-center justify-center shadow-md overflow-hidden p-1.5">
            <span className="text-[18px]">🤖</span>
          </div>
          <span className="text-white text-[11px] text-center font-[500] drop-shadow-[1px_1px_1px_rgba(0,0,0,0.9)] leading-tight">Groq AI<br/>Config</span>
        </div>

        {/* Gemini Icon */}
        <div 
          className={`flex flex-col items-center gap-1.5 p-2 w-[75px] h-[85px] rounded-sm cursor-default group hover:bg-white/10 active:bg-white/20 border border-transparent ${selectedIcon === 'gemini' ? 'bg-[#3071ed]/60 border-[#fff]/30' : ''}`}
          onClick={(e) => { e.stopPropagation(); setSelectedIcon('gemini'); }}
          onDoubleClick={() => setIsGeminiConfigOpen(true)}
        >
          <div className="w-[32px] h-[32px] bg-[#f0f0f0] rounded-full flex items-center justify-center shadow-md overflow-hidden p-1.5">
            <span className="text-[18px]">💎</span>
          </div>
          <span className="text-white text-[11px] text-center font-[500] drop-shadow-[1px_1px_1px_rgba(0,0,0,0.9)] leading-tight">Gemini AI<br/>Config</span>
        </div>
      </div>

      {/* EOS Window */}
      {isOpen && (
        <div 
          className={`absolute transition-all duration-200 z-10 flex shadow-[2px_4px_16px_rgba(0,0,0,0.5)] ${
            isMaximized 
              ? 'top-0 left-0 w-full h-[calc(100vh-30px)] translate-x-0 translate-y-0' 
              : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-[55%] w-[960px] h-[640px] max-w-[95vw] max-h-[85vh]'
          } ${isMinimized ? 'scale-0 opacity-0 pointer-events-none origin-bottom' : 'scale-100 opacity-100'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <section className={`flex flex-col w-full h-full bg-[#efefef] border-[3px] border-[#0831d9] ${isMaximized ? '' : 'rounded-t-lg'}`}>
            {/* Title Bar like Windows XP */}
            <header 
              className="xp-titlebar cursor-default select-none"
              onDoubleClick={() => setIsMaximized(!isMaximized)}
            >
              <div className="flex items-center gap-1.5 pl-1 text-[12px]">
                <img src="/favicon.ico" alt="" className="w-3.5 h-3.5" />
                <span className="drop-shadow-[1px_1px_1px_rgba(0,0,0,0.7)]">EOS Exam Explorer</span>
              </div>
              <div className="xp-button-container text-[10px]">
                <button 
                  className="xp-button xp-button-min"
                  onClick={() => setIsMinimized(true)}
                >
                  <div className="xp-icon-min" />
                </button>
                <button 
                  className="xp-button xp-button-max"
                  onClick={() => setIsMaximized(!isMaximized)}
                >
                  <div className="xp-icon-max" />
                </button>
                <button 
                  className="xp-button xp-button-close" 
                  onClick={() => {
                    setIsOpen(false);
                    setIsMinimized(false);
                    setIsMaximized(false);
                  }}
                >
                  <span className="xp-icon-close">×</span>
                </button>
              </div>
            </header>

            {/* Menu Bar */}
            <div className="flex gap-4 px-2 py-[2px] text-[11px] mb-1">
              <span className="cursor-pointer hover:bg-[#000080] hover:text-white px-1">File</span>
              <span className="cursor-pointer hover:bg-[#000080] hover:text-white px-1">Edit</span>
              <span className="cursor-pointer hover:bg-[#000080] hover:text-white px-1">View</span>
              <span className="cursor-pointer hover:bg-[#000080] hover:text-white px-1">Help</span>
            </div>

            {/* Tool Bar */}
            <div className="flex flex-wrap items-center gap-[2px] px-2 pb-1 border-b border-[#9f9f9f] mb-1 shadow-[0_1px_0_#fff]">
                <button className="win-button px-2 py-[2px] flex items-center gap-1 text-[11px] active:translate-y-px" onClick={() => { setSelectedSemester(null); setSearchQuery(''); }}>
                    <span className="text-[14px] grayscale">🔙</span> Back
                </button>
                <div className="flex items-center gap-1 bg-white win-sunken px-2 py-[2px] ml-1 shadow-none border-[#9a9a9a]">
                  <span className="text-[12px] grayscale">🔍</span>
                  <input 
                    type="text" 
                    placeholder="Search subjects..." 
                    className="bg-transparent border-none outline-none text-[11px] w-[150px]"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button 
                  className={`win-button px-3 py-[2px] flex items-center gap-1 text-[11px] active:translate-y-px font-bold ${viewMode === 'curriculum' ? 'bg-[#d0d0d0]' : ''}`}
                  onClick={() => { setViewMode(viewMode === 'date' ? 'curriculum' : 'date'); setSelectedSemester(null); }}
                >
                    <span className="text-[14px] grayscale">📊</span> {viewMode === 'date' ? 'By Major' : 'By Date'}
                </button>
                <button className="win-button px-2 py-[2px] flex items-center gap-1 text-[11px] active:translate-y-px" onClick={() => { setSearchQuery(''); }}>
                    <span className="text-[14px] grayscale">📁</span> Folders
                </button>
                <div className="border-l border-[#ccc] mx-1 h-5 shadow-[1px_0_#fff] hidden sm:block"></div>
                <span className="flex items-center text-[11px] ml-1">Address:</span>
                <div className="win-sunken bg-white px-2 py-[2px] ml-1 flex-1 text-[11px] truncate shadow-none border-[#9a9a9a]">
                  {searchQuery ? `Search Results: ${searchQuery}` : selectedSemester ? `C:\\EOS\\Database\\${selectedSemester.id}` : `C:\\EOS\\Database\\${viewMode === 'date' ? 'ByDate' : 'ByMajor'}`}
                </div>
            </div>

            {/* Content Explorer */}
            <div className="flex-1 flex min-h-0 p-1 gap-[2px]">
              {/* Left Pane: Directory Tree (Semesters) */}
              <div className="w-[200px] shrink-0 win-sunken overflow-auto bg-white p-1">
                <ul className="text-[12px] leading-tight space-y-1">
                  {/* Main DB */}
                  <li 
                    className={`font-bold flex items-center gap-1 mb-1 cursor-pointer hover:bg-[#000080]/10 p-1 rounded-sm ${selectedSemester?.type === 'main' && selectedSemester.id === 'ROOT' ? 'bg-[#000080] text-white' : ''}`}
                    onClick={() => setSelectedSemester({ id: 'ROOT', type: 'main' })}
                  >
                    <span className="text-[14px]">🖥️</span> EOS Database
                  </li>
                  <li>
                    <ul className="pl-4 space-y-1 border-l border-dotted border-[#aaa] ml-2 mb-2">
                      {(viewMode === 'date' ? sortedSemesters : sortedCurriculumKy).map(semester => (
                        <li key={semester} className="pl-2 relative">
                          <span className="absolute -left-[1px] top-2 w-[8px] border-t border-dotted border-[#aaa]"></span>
                          <div 
                            className={`flex items-center gap-1 cursor-pointer hover:bg-[#000080] hover:text-white group pr-1 break-all ${selectedSemester?.id === semester && selectedSemester.type === 'main' ? 'bg-[#000080] text-white' : ''}`}
                            onClick={(e) => { e.stopPropagation(); setSelectedSemester({ id: semester, type: 'main' }); }}
                          >
                            <span className="text-[14px] filter grayscale group-hover:grayscale-0">📁</span>
                            <span className="truncate">{semester}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </li>

                  {/* Remainder DB */}
                  <li 
                    className={`font-bold flex items-center gap-1 mb-1 cursor-pointer hover:bg-[#000080]/10 p-1 rounded-sm ${selectedSemester?.type === 'remainder' && selectedSemester.id === 'ROOT' ? 'bg-[#000080] text-white' : ''}`}
                    onClick={() => setSelectedSemester({ id: 'ROOT', type: 'remainder' })}
                  >
                    <span className="text-[14px]">⚠️</span> Incomplete Database
                  </li>
                  <li>
                    <ul className="pl-4 space-y-1 border-l border-dotted border-[#aaa] ml-2">
                      {(viewMode === 'date' ? sortedRemainderSemesters : sortedCurriculumRemainderKy).map(semester => (
                        <li key={semester} className="pl-2 relative">
                          <span className="absolute -left-[1px] top-2 w-[8px] border-t border-dotted border-[#aaa]"></span>
                          <div 
                            className={`flex items-center gap-1 cursor-pointer hover:bg-[#000080] hover:text-white group pr-1 break-all ${selectedSemester?.id === semester && selectedSemester.type === 'remainder' ? 'bg-[#000080] text-white' : ''}`}
                            onClick={(e) => { e.stopPropagation(); setSelectedSemester({ id: semester, type: 'remainder' }); }}
                          >
                            <span className="text-[14px] filter grayscale group-hover:grayscale-0">📁</span>
                            <span className="truncate">{semester}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </li>
                </ul>
              </div>

              {/* Right Pane: Subjects and Exams List */}
              <div className="flex-1 win-sunken overflow-auto bg-white p-3">
                <div className="flex flex-col gap-6">
                  {allUniqueSemesters
                    .filter(sem => {
                      if (searchQuery !== '') return true;
                      if (selectedSemester === null) return true;
                      // Show this semester header if it's the selected one OR if the ROOT of its type is selected
                      return (selectedSemester.id === 'ROOT' || selectedSemester.id === sem);
                    })
                    .map(semester => {
                      const mainSubjects = (viewMode === 'date' ? semestersData[semester] : curriculumData.main[semester]) || {};
                      const remainderSubjects = (viewMode === 'date' ? remainderSemestersData[semester] : curriculumData.remainder[semester]) || {};
                      
                      // Combine and filter subjects based on selection
                      const showMain = selectedSemester === null || selectedSemester.type === 'main';
                      const showRemainder = selectedSemester === null || selectedSemester.type === 'remainder';

                      const combinedSubjects: Record<string, { main: ThreadData[], remainder: ThreadData[] }> = {};
                      
                      if (showMain) {
                        Object.entries(mainSubjects).forEach(([sub, threads]) => {
                          if (!combinedSubjects[sub]) combinedSubjects[sub] = { main: [], remainder: [] };
                          combinedSubjects[sub].main = threads;
                        });
                      }
                      
                      if (showRemainder) {
                        Object.entries(remainderSubjects).forEach(([sub, threads]) => {
                          if (!combinedSubjects[sub]) combinedSubjects[sub] = { main: [], remainder: [] };
                          combinedSubjects[sub].remainder = threads;
                        });
                      }

                      const filteredSubjectKeys = Object.keys(combinedSubjects).filter(sub => 
                        sub.toLowerCase().includes(searchQuery.toLowerCase())
                      );
                      
                      if (filteredSubjectKeys.length === 0) return null;

                      // Visual XP headers for Curriculum mode
                      const isKyHeader = viewMode === 'curriculum' && semester.startsWith('Kỳ');
                      const kyNumber = isKyHeader ? semester.split(' ')[1] : null;

                      return (
                        <div key={semester} className="mb-2 max-w-full relative">
                          {isKyHeader && (
                            <div className="absolute -left-12 top-0 w-10 h-10 bg-[#009688] text-white flex items-center justify-center font-bold text-[20px] shadow-md rounded-sm hidden lg:flex">
                              {kyNumber}
                            </div>
                          )}
                          <h3 className={`font-bold text-[14px] border-b border-[#ccc] mb-2 pb-1 flex items-center gap-1 w-full ${isKyHeader ? 'text-[#005a9e] text-[18px]' : 'text-[#000080]'}`}>
                            <span className="text-[14px] filter grayscale">📁</span> {semester}
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-4 pl-4">
                            {filteredSubjectKeys.map(subject => (
                              <div key={subject} className="min-w-0">
                                <div className="font-bold text-[#2a2a2a] flex items-center gap-1 mb-1 truncate">
                                  <span className="text-[14px] filter grayscale">📂</span> {subject}
                                </div>
                                <ul className="pl-5 space-y-[2px]">
                                  {/* Render Main threads first */}
                                  {combinedSubjects[subject].main.map(thread => (
                                    <li key={thread.thread_url} className="flex flex-col group min-w-0">
                                      <div 
                                        onClick={() => handleOpenExam(subject, thread.globalIndex, false)}
                                        className="cursor-pointer text-black hover:text-white hover:bg-[#000080] px-1 py-[1px] flex gap-1 items-start min-w-0 w-max max-w-full"
                                        title={thread.thread_name}
                                      >
                                        <span className="text-[10px] mt-[1px] opacity-70 filter grayscale group-hover:grayscale-0 group-hover:invert shrink-0">📄</span>
                                        <span className="truncate">{thread.thread_name}</span>
                                      </div>
                                    </li>
                                  ))}
                                  {/* Then Render Remainder threads with different labels */}
                                  {combinedSubjects[subject].remainder.map(thread => (
                                    <li key={thread.thread_url} className="flex flex-col group min-w-0">
                                      <div 
                                        onClick={() => handleOpenExam(subject, thread.globalIndex, true)}
                                        className={`cursor-pointer hover:text-white hover:bg-[#000080] px-1 py-[1px] flex gap-1 items-start min-w-0 w-max max-w-full ${
                                          thread.answerStatus === 'none' ? 'text-[#8b0000] opacity-60' : 'text-[#6d4c41]'
                                        }`}
                                        title={thread.thread_name}
                                      >
                                        <span className={`text-[10px] mt-[1px] opacity-70 group-hover:grayscale-0 group-hover:invert shrink-0 ${
                                          thread.answerStatus === 'none' ? 'filter grayscale' : 'filter sepia'
                                        }`}>📄</span>
                                        <span className={`truncate italic ${thread.answerStatus === 'none' ? 'font-normal' : 'opacity-85'}`}>
                                          {thread.thread_name} {thread.answerStatus === 'none' ? '(No Ans)' : '(Partial)'}
                                        </span>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Status Bar */}
            <div className="win-sunken h-[22px] bg-[#efefef] flex items-center px-2 text-[11px] text-[#2a2a2a] mx-1 mb-[2px] border-l-[#9a9a9a] border-t-[#9a9a9a] border-r-white border-b-white">
              <div className="flex-1">Ready</div>
              <div className="border-l border-[#848484] shadow-[-1px_0_#fff] pl-2 pr-4 h-full flex items-center">
                {sortedSemesters.length + sortedRemainderSemesters.length} object(s)
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Groq Config Window */}
      {isGroqConfigOpen && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-[400px] flex shadow-[2px_4px_16px_rgba(0,0,0,0.5)]">
          <section className="flex flex-col w-full bg-[#efefef] border-[3px] border-[#0831d9] rounded-t-lg">
            <header className="xp-titlebar cursor-default select-none h-[30px]">
              <div className="flex items-center gap-1.5 pl-1 text-[12px]">
                <span className="text-[14px]">🤖</span>
                <span className="drop-shadow-[1px_1px_1px_rgba(0,0,0,0.7)]">Groq AI Configuration</span>
              </div>
              <div className="xp-button-container text-[10px]">
                <button className="xp-button xp-button-close" onClick={() => setIsGroqConfigOpen(false)}>
                  <span className="xp-icon-close">×</span>
                </button>
              </div>
            </header>
            <div className="p-4 bg-white m-1 win-sunken flex flex-col gap-4">
              <div>
                <p className="text-[12px] font-bold mb-1 ml-1 text-[#2a2a2a]">AI Model (Native Vision)</p>
                <div className="win-sunken px-2 py-1.5 bg-[#f5f5f5] text-[12px] font-bold text-[#000080]">
                  Llama 4 Scout (17B Instruct)
                </div>
                <p className="text-[10px] text-[#666] mt-1 ml-1 leading-tight">
                  High-performance native vision model curated for EOS tasks.
                </p>
              </div>

              <div>
                <p className="text-[12px] font-bold mb-1 ml-1 text-[#2a2a2a]">Groq API Keys</p>
                <textarea 
                  className="w-full h-[120px] win-sunken p-2 text-[11px] font-mono outline-none resize-none bg-white"
                  placeholder="Enter one Groq API Key per line...&#10;gsk_xxxxxxx&#10;gsk_yyyyyyy"
                  value={groqApiKey}
                  onChange={(e) => setGroqApiKey(e.target.value)}
                />
                <p className="text-[10px] text-[#000080] mt-1 ml-1">
                  💡 Multiple keys will be rotated automatically to bypass rate limits.
                </p>
              </div>
              
              <div className="flex justify-end gap-2 px-1">
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-[10px] text-[#2a2a2a]">Active Solver?</span>
                  <input 
                    type="checkbox" 
                    checked={activeAiProvider === 'groq'} 
                    onChange={() => {
                        const newP = activeAiProvider === 'groq' ? 'gemini' : 'groq';
                        setActiveAiProvider(newP);
                        localStorage.setItem('active_ai_provider', newP);
                    }} 
                  />
                </div>
                <button 
                  className="win-button px-4 py-1 text-[12px] min-w-[75px]"
                  onClick={() => setIsGroqConfigOpen(false)}
                >
                  Cancel
                </button>
                <button 
                  className="win-button px-4 py-1 text-[12px] min-w-[75px] font-bold"
                  onClick={() => saveGroqConfig(groqApiKey)}
                >
                  Save Config
                </button>
              </div>
            </div>
            <div className="h-6 bg-[#efefef] flex items-center px-2 text-[10px] text-[#555] border-t border-[#9a9a9a]">
              Status: {activeAiProvider === 'groq' ? '🟢 ACTIVE' : '⚪ IDLE'} • Model: llama-4-scout
            </div>
          </section>
        </div>
      )}

      {/* Gemini Config Window */}
      {isGeminiConfigOpen && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-[400px] flex shadow-[2px_4px_16px_rgba(0,0,0,0.5)]">
          <section className="flex flex-col w-full bg-[#efefef] border-[3px] border-[#0831d9] rounded-t-lg">
            <header className="xp-titlebar cursor-default select-none h-[30px]">
              <div className="flex items-center gap-1.5 pl-1 text-[12px]">
                <span className="text-[14px]">💎</span>
                <span className="drop-shadow-[1px_1px_1px_rgba(0,0,0,0.7)]">Gemini AI Configuration</span>
              </div>
              <div className="xp-button-container text-[10px]">
                <button className="xp-button xp-button-close" onClick={() => setIsGeminiConfigOpen(false)}>
                  <span className="xp-icon-close">×</span>
                </button>
              </div>
            </header>
            <div className="p-4 bg-white m-1 win-sunken flex flex-col gap-4">
              <div>
                <p className="text-[12px] font-bold mb-1 ml-1 text-[#2a2a2a]">Gemini Model</p>
                <div className="win-sunken px-2 py-1.5 bg-[#f5f5f5] text-[12px] font-bold text-[#9c27b0]">
                  gemini-2.5-flash-lite
                </div>
                <p className="text-[10px] text-[#666] mt-1 ml-1 leading-tight">
                  Next-generation Google model with high token throughput.
                </p>
              </div>

              <div>
                <p className="text-[12px] font-bold mb-1 ml-1 text-[#2a2a2a]">Gemini API Keys</p>
                <textarea 
                  className="w-full h-[120px] win-sunken p-2 text-[11px] font-mono outline-none resize-none bg-white"
                  placeholder="Enter one Gemini API Key per line...&#10;AIzaSyxxxxxxxxx&#10;AIzaSyyyyyyyyy"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                />
                <p className="text-[10px] text-[#9c27b0] mt-1 ml-1">
                  💡 Multiple keys will be rotated automatically.
                </p>
              </div>
              
              <div className="flex justify-end gap-2 px-1">
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-[10px] text-[#2a2a2a]">Active Solver?</span>
                  <input 
                    type="checkbox" 
                    checked={activeAiProvider === 'gemini'} 
                    onChange={() => {
                        const newP = activeAiProvider === 'gemini' ? 'groq' : 'gemini';
                        setActiveAiProvider(newP);
                        localStorage.setItem('active_ai_provider', newP);
                    }} 
                  />
                </div>
                <button 
                  className="win-button px-4 py-1 text-[12px] min-w-[75px]"
                  onClick={() => setIsGeminiConfigOpen(false)}
                >
                  Cancel
                </button>
                <button 
                  className="win-button px-4 py-1 text-[12px] min-w-[75px] font-bold"
                  onClick={() => saveGeminiConfig(geminiApiKey)}
                >
                  Save Config
                </button>
              </div>
            </div>
            <div className="h-6 bg-[#efefef] flex items-center px-2 text-[10px] text-[#555] border-t border-[#9a9a9a]">
              Status: {activeAiProvider === 'gemini' ? '🟣 ACTIVE' : '⚪ IDLE'} • Model: gemini-2.5-flash-lite
            </div>
          </section>
        </div>
      )}

      {/* Taskbar */}
      <div className="absolute bottom-0 w-full h-[30px] bg-gradient-to-b from-[#245edb] via-[#3f8cf3] to-[#245edb] border-t border-[#103099] flex items-center z-50">
        <button className="h-[30px] bg-gradient-to-br from-[#4db458] to-[#1a8525] hover:brightness-110 px-4 rounded-r-2xl flex items-center gap-2 shadow-[2px_0_4px_rgba(0,0,0,0.4)] border-r border-t border-[#81d88a]">
          <span className="italic text-white font-bold text-[18px] drop-shadow-[1px_1px_1px_rgba(0,0,0,0.6)] pr-2">start</span>
        </button>
        <div className="flex-1 mx-2 h-full flex items-center gap-1">
          {isOpen && (
            <div 
              className={`h-[22px] rounded-sm text-white text-[11px] flex items-center px-2 gap-1 shadow-[inset_0_0_2px_rgba(0,0,0,0.8)] w-[150px] cursor-pointer border border-[#0d2a73] transition-colors ${
                isMinimized ? 'bg-[#1d52cc] opacity-70' : 'bg-[#245edb] border-t-[#3f8cf3]'
              }`}
              onClick={() => setIsMinimized(!isMinimized)}
            >
              <img src="/favicon.ico" alt="icon" className="w-[12px] h-[12px]" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              <span className="truncate">EOS Exam Explorer</span>
            </div>
          )}
        </div>
        <div className="h-full bg-[#0d8ee6] text-white text-[11px] flex items-center px-4 border-l border-[#0a5eb5] shadow-[inset_1px_0_2px_rgba(255,255,255,0.3)] min-w-[70px] justify-center">
          {time}
        </div>
      </div>
    </div>
  );
}
