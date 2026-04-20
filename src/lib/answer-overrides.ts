export interface QuestionWithAnswer {
  id: string;
  answer: string | null;
}

export type AnswerOverrideMap = Record<string, string>;

const STORAGE_PREFIX = "eos.answerOverrides.v1";

export function normalizeExamName(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function normalizeAnswerValue(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

export function hasAnswerKey(answer: string | null | undefined) {
  return /[A-Z]/.test(normalizeAnswerValue(answer));
}

function getStorageKey(subjectCode: string, examName: string) {
  return `${STORAGE_PREFIX}:${subjectCode}:${normalizeExamName(examName)}`;
}

export function readAnswerOverrides(subjectCode: string, examName: string): AnswerOverrideMap {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(getStorageKey(subjectCode, examName));
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    return Object.entries(parsed).reduce<AnswerOverrideMap>((acc, [questionId, value]) => {
      if (typeof questionId !== "string" || typeof value !== "string") return acc;
      acc[questionId] = normalizeAnswerValue(value);
      return acc;
    }, {});
  } catch {
    return {};
  }
}

export function writeAnswerOverrides(subjectCode: string, examName: string, overrides: AnswerOverrideMap) {
  if (typeof window === "undefined") return;

  const cleaned = Object.entries(overrides).reduce<AnswerOverrideMap>((acc, [questionId, value]) => {
    if (!questionId) return acc;
    acc[questionId] = normalizeAnswerValue(value);
    return acc;
  }, {});

  window.localStorage.setItem(getStorageKey(subjectCode, examName), JSON.stringify(cleaned));
}

export function getEffectiveAnswerForQuestion(question: QuestionWithAnswer, overrides: AnswerOverrideMap) {
  if (Object.prototype.hasOwnProperty.call(overrides, question.id)) {
    const overrideAnswer = normalizeAnswerValue(overrides[question.id]);
    return overrideAnswer.length > 0 ? overrideAnswer : null;
  }

  const originalAnswer = normalizeAnswerValue(question.answer);
  return originalAnswer.length > 0 ? originalAnswer : null;
}

export function countMissingAnswersForQuestions(questions: QuestionWithAnswer[], overrides: AnswerOverrideMap) {
  return questions.reduce((missingCount, question) => {
    const effectiveAnswer = getEffectiveAnswerForQuestion(question, overrides);
    return hasAnswerKey(effectiveAnswer) ? missingCount : missingCount + 1;
  }, 0);
}
