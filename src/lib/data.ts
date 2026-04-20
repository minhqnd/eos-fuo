import originalDb from '../../eos_web/db_final_clean.json';
import remainderDbRaw from '../../eos_web/db_final_remainder.json';

export type Question = {
  id: string;
  image_url: string;
  answer: string;
};

export type ExamThread = {
  thread_url: string;
  thread_name: string;
  questions: Question[];
  answerStatus: 'full' | 'partial' | 'none';
};

export type Database = Record<string, Record<string, ExamThread[]>>;

const db: Database = originalDb as Database;
const remainderDb: Database = remainderDbRaw as Database;

export function extractSemester(threadName: string): string {
  const match = threadName.match(/(FA|SP|SU|FALL|SPRING|SUM|SUMMER)\s*-?\s*(\d{2,4})/i);
  if (match) {
      let term = match[1].toUpperCase();
      if (term.startsWith('FALL') || term === 'FA') term = 'FA';
      else if (term.startsWith('SPR') || term === 'SP') term = 'SP';
      else if (term.startsWith('SUM') || term === 'SU') term = 'SU';
      
      let year = match[2];
      if (year.length === 2) year = '20' + year;
      return `${term}${year}`;
  }
  return "Other";
}

function buildAllSubjects(targetDb: Database): Record<string, ExamThread[]> {
  const subjectsToThreads: Record<string, ExamThread[]> = {};
  for (const pageId in targetDb) {
    const pageObj = targetDb[pageId];
    for (const subject in pageObj) {
      if (!subjectsToThreads[subject]) {
        subjectsToThreads[subject] = [];
      }
      const validThreads = pageObj[subject].filter(t => t.questions && t.questions.length > 0);
      if (validThreads.length > 0) {
        subjectsToThreads[subject].push(...validThreads);
      }
    }
  }
  return subjectsToThreads;
}

function buildExamsBySemester(targetDb: Database): Record<string, Record<string, ExamThread[]>> {
  const result: Record<string, Record<string, ExamThread[]>> = {};

  for (const pageId in targetDb) {
    const pageObj = targetDb[pageId];
    for (const subject in pageObj) {
      const threads: ExamThread[] = (pageObj[subject] || []).filter(t => t.questions && t.questions.length > 0);
      
      if (threads.length === 0) continue;

      for (const thread of threads) {
        const semester = extractSemester(thread.thread_name);
        
        // Calculate answer status
        const answeredCount = thread.questions.filter(q => q.answer && q.answer !== null && q.answer !== "").length;
        const totalCount = thread.questions.length;
        
        let status: 'full' | 'partial' | 'none' = 'none';
        if (answeredCount === totalCount) status = 'full';
        else if (answeredCount > 0) status = 'partial';
        else status = 'none';
        
        thread.answerStatus = status;
        
        if (!result[semester]) {
          result[semester] = {};
        }
        if (!result[semester][subject]) {
          result[semester][subject] = [];
        }
        
        result[semester][subject].push(thread);
      }
    }
  }

  return result;
}

export const getAllSubjects = () => buildAllSubjects(db);
export const getExamsBySemester = () => buildExamsBySemester(db);

export const getAllRemainderSubjects = () => buildAllSubjects(remainderDb);
export const getRemainderExamsBySemester = () => buildExamsBySemester(remainderDb);
