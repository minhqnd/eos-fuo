import DesktopEnvironment, { ExplorerTreeData } from '../components/DesktopEnvironment';
import { getExamsBySemester, getAllSubjects, getRemainderExamsBySemester, getAllRemainderSubjects } from '../lib/data';

function mapToExplorerData(
  semestersData: Record<string, Record<string, any[]>>,
  allSubjects: Record<string, any[]>
): ExplorerTreeData {
  const result: ExplorerTreeData = {};
  for (const sem in semestersData) {
    result[sem] = {};
    for (const sub in semestersData[sem]) {
      result[sem][sub] = semestersData[sem][sub].map(thread => ({
        thread_name: thread.thread_name,
        thread_url: thread.thread_url,
        globalIndex: allSubjects[sub].findIndex(t => t.thread_name === thread.thread_name),
        answerStatus: thread.answerStatus
      }));
    }
  }
  return result;
}

export default function HomePage() {
  const semestersData = getExamsBySemester();
  const allSubjects = getAllSubjects();
  const clntSemestersData = mapToExplorerData(semestersData, allSubjects);

  const remainderSemestersData = getRemainderExamsBySemester();
  const remainderAllSubjects = getAllRemainderSubjects();
  const clntRemainderSemestersData = mapToExplorerData(remainderSemestersData, remainderAllSubjects);

  return (
    <DesktopEnvironment 
      semestersData={clntSemestersData} 
      remainderSemestersData={clntRemainderSemestersData} 
    />
  );
}
