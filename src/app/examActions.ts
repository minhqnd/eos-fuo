"use server";

import { getAllSubjects, getAllRemainderSubjects } from '../lib/data';

export async function fetchExamData(subject: string, globalIndex: number, isRemainder: boolean) {
  const data = isRemainder ? getAllRemainderSubjects() : getAllSubjects();
  return data[subject]?.[globalIndex] || null;
}
