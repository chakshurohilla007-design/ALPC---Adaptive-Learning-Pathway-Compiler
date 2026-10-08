const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('learnsmart_token');
}

export function setToken(token: string) {
  localStorage.setItem('learnsmart_token', token);
}

export function clearToken() {
  localStorage.removeItem('learnsmart_token');
  localStorage.removeItem('learnsmart_user');
}

export function getUser(): { id: string; name: string; email: string; diagnosticCompleted: boolean } | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('learnsmart_user');
  return raw ? JSON.parse(raw) : null;
}

export function setUser(user: { id: string; name: string; email: string; diagnosticCompleted: boolean }) {
  localStorage.setItem('learnsmart_user', JSON.stringify(user));
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new BackendUnavailableError();
  }
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data.error || `The server answered ${res.status} without saying why.`, res.status, data.code);
  }
  return data as T;
}

/** An error response from the backend, with its HTTP status and optional machine-readable code. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Thrown when the backend cannot be reached at all. */
export class BackendUnavailableError extends Error {
  constructor() {
    super(`The backend is not reachable at ${API_URL}. Start it with npm run dev:backend and try again.`);
    this.name = 'BackendUnavailableError';
  }
}

export const api = {
  getTheoryQuestions: () => request<{ questions: TheoryQuestion[] }>('/api/theory/questions'),
  getTheoryAttempts: () => request<{ attempts: TheoryAttempt[] }>('/api/theory/attempts'),
  getTheoryReviewers: () => request<{ reviewers: { name: string; email: string }[]; canReview: boolean }>('/api/theory/reviewers'),
  getTheoryReviews: () => request<{ attempts: (TheoryAttempt & { userId: { _id: string; name: string }; prompt: string })[] }>('/api/theory/reviews'),
  confirmTheoryReview: (id: string, score: number, comment: string) => request<{ confirmed: true; mastery: number }>(`/api/theory/reviews/${id}/confirm`, { method: 'POST', body: JSON.stringify({ score, comment }) }),
  submitTheory: (body: { questionId: string; marks: number; answer: string; textConfirmed: boolean; reviewerEmail?: string }) =>
    request<TheoryResult>('/api/theory/submit', { method: 'POST', body: JSON.stringify(body) }),
  register: (body: { name: string; email: string; password: string }) =>
    request<{ token: string; user: ReturnType<typeof getUser> }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    request<{ token: string; user: ReturnType<typeof getUser> }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getDiagnostic: () =>
    request<{ questions: QuizQuestion[] }>('/api/quiz/diagnostic'),

  submitDiagnostic: (answers: AnswerSubmission[]) =>
    request<{ results: QuizResult[]; masteryMap: Record<string, number> }>(
      '/api/quiz/diagnostic/submit',
      { method: 'POST', body: JSON.stringify({ answers }) }
    ),

  getAdaptiveQuiz: (skill?: string) =>
    request<{ questions: QuizQuestion[]; count: number; skill?: string }>(
      skill ? `/api/quiz/adaptive?skill=${encodeURIComponent(skill)}` : '/api/quiz/adaptive'
    ),

  deleteAccount: (password: string) =>
    request<{ deleted: true; removed: Record<string, number> }>('/api/auth/account', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    }),

  submitAdaptive: (answers: AnswerSubmission[]) =>
    request<AdaptiveResult>('/api/quiz/adaptive/submit', {
      method: 'POST',
      body: JSON.stringify({ answers }),
    }),

  getDashboard: () => request<DashboardData>('/api/dashboard'),

  getHistory: () =>
    request<{ improvementOverTime: { date: string; accuracy: number; attempts: number }[] }>(
      '/api/history'
    ),

  // ── ALPC Compiler Integration ─────────────────────────────────────────────
  compilePathLang: (source: string) =>
    request<AlpcCompileResult>('/api/alpc/compile', {
      method: 'POST',
      body: JSON.stringify({ source }),
    }),

  checkPathLang: (source: string, signal?: AbortSignal) =>
    request<AlpcCheckResult>('/api/alpc/check', {
      method: 'POST',
      body: JSON.stringify({ source }),
      signal,
    }),

  generatePathway: (body: {
    skill: string;
    performance?: number;
    mastery?: number;
    attempts?: number;
    completionRate?: number;
    pathwayId?: string;
  }) =>
    request<AlpcCompileResult & { source: string; decisionId: string }>(
      '/api/alpc/pathway/generate',
      { method: 'POST', body: JSON.stringify(body) }
    ),

  getAlpcDecisions: () =>
    request<{ decisions: AlpcDecision[] }>('/api/alpc/decisions'),

  getAlpcDecision: (id: string) =>
    request<{ decision: AlpcDecision & { stages: AlpcStage[] }; content: AlpcContent | null }>(
      `/api/alpc/decisions/${id}`
    ),

  // ── Study pages ───────────────────────────────────────────────────────────
  getStudyTopics: () =>
    request<{ topics: StudyTopic[] }>('/api/study'),

  getStudy: (skill: string) =>
    request<StudyPage>(`/api/study/${encodeURIComponent(skill)}`),

  setStudyDone: (skill: string, resourceId: string, done: boolean) =>
    request<{ resourceId: string; doneAt: string | null }>(
      `/api/study/${encodeURIComponent(skill)}/done/${encodeURIComponent(resourceId)}`,
      { method: done ? 'PUT' : 'DELETE' }
    ),

  getPathways: () =>
    request<{ pathways: AlpcPathway[] }>('/api/alpc/pathways'),

  createPathway: (body: {
    name: string; topic: string; description?: string;
    outcomes: { name: string; adjustment: number }[];
    rules: PathwayRule[];
  }) =>
    request<{ pathway: AlpcPathway }>('/api/alpc/pathways', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  simulatePathway: (pathwayId: string, studentData: {
    performance: number; mastery: number; attempts?: number; completionRate?: number;
  }) =>
    request<AlpcCompileResult & { source: string }>(
      `/api/alpc/pathways/${pathwayId}/simulate`,
      { method: 'POST', body: JSON.stringify(studentData) }
    ),
};

export interface TheoryQuestion { id: string; skill: string; prompt: string }
export interface TheoryResult {
  score: number; maxMarks: number; status: 'estimated' | 'pending'; masteryUpdated: false;
  feedback: { label: string; marks: number; maxMarks: number; detected: boolean; guidance: string }[];
  modelAnswer: string; attemptId: string; skill: string;
}
export interface TheoryAttempt {
  _id: string; skill: string; questionId: string; answer: string; score: number; maxMarks: number;
  createdAt: string; feedback: TheoryResult['feedback']; status: 'estimated' | 'pending' | 'confirmed';
  confirmedScore?: number; reviewComment?: string; masteryApplied?: boolean; reviewerEmail?: string;
}

export interface QuizQuestion {
  id: string;
  skill: string;
  difficulty: string;
  text: string;
  options: string[];
  /** Stored index of the option shown at each position; send that index back. */
  optionIndex?: number[];
  targetMastery?: number;
  recommendedDifficulty?: string;
}

export interface AnswerSubmission {
  questionId: string;
  selectedOption: number;
}

export interface QuizResult {
  questionId: string;
  skill: string;
  correct: boolean;
  updatedMastery: number;
  question?: string;
  yourAnswer?: string | null;
  correctAnswer?: string;
  explanation?: string | null;
}

export interface DashboardData {
  skills: {
    skill: string;
    masteryScore: number;
    masteryPercent: number;
    level: 'weak' | 'moderate' | 'strong';
  }[];
  masteryMap: Record<string, number>;
  /** Topics past their review interval, most overdue first. */
  review?: { skill: string; masteryPercent: number; lastPracticed: string; daysSince: number; intervalDays: number }[];
  weakestSkills: { skill: string; masteryScore: number; masteryPercent: number }[];
  learningPath: string[];
  nextTopic: {
    skill: string;
    masteryScore: number;
    masteryPercent: number;
    reason: string;
  } | null;
  analytics: {
    averageMastery: number;
    averageMasteryPercent: number;
    weakestSkill: { skill: string; masteryScore: number };
    strongestSkill: { skill: string; masteryScore: number };
  };
  recommendations: {
    skill: string;
    masteryScore?: number;
    explanation: string;
    commonError?: string;
    suggestedAction?: string;
  }[];
}

export interface AdaptiveResult {
  results: QuizResult[];
  summary: { total: number; correct: number; scorePercent: number };
  masteryMap: Record<string, number>;
  analytics: DashboardData['analytics'] & {
    weakestSkills: DashboardData['weakestSkills'];
    learningPath: string[];
    nextTopic: DashboardData['nextTopic'];
  };
  recommendations: {
    skill: string;
    masteryScore: number;
    masteryPercent: number;
    explanation: string;
    commonError: string;
    suggestedAction: string;
  }[];
}

// ── ALPC Compiler Integration Types ──────────────────────────────────────────

export interface AlpcStage {
  id: 'tokens' | 'parse' | 'ast' | 'ir' | 'run';
  status: 'success' | 'error' | 'skipped';
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export interface AlpcToken {
  line: number | null;
  col?: number;
  type: string;
  lexeme: string;
}

export interface AlpcDiagnostic {
  stage: string;
  kind?: 'lexical' | 'syntax' | 'semantic' | 'runtime' | 'internal';
  code?: string;
  line?: number;
  col?: number;
  message: string;
}

export interface AlpcCheckResult {
  success: boolean;
  diagnostics: AlpcDiagnostic[];
  backwardDesign: boolean | null;
}

export interface AlpcAstNode {
  label: string;
  depth: number;
  children: AlpcAstNode[];
}

export interface AlpcContent {
  label: string;
  tier: string;
  color: string;
  description: string;
  steps: string[];
  nextAction: string;
}

export interface AlpcCompileResult {
  success: boolean;
  outcome: string | null;
  alignmentScore: number | null;
  binaryOutput: string | null;
  tokens: AlpcToken[];
  traceLines: string[];
  ast: AlpcAstNode | null;
  irSource: string;
  stages: AlpcStage[];
  diagnostics: AlpcDiagnostic[];
  backwardDesign?: boolean | null;
  /** IR after LLVM's opt -O2 (playground only). */
  optimizedIr?: string | null;
  optimizeError?: string | null;
  content: AlpcContent | null;
  source?: string;
  decisionId?: string;
}

export interface PathwayRule {
  variable: string;
  operator: string;
  value: number;
  outcome: string;
  /** Optional second comparison joined with AND or OR. */
  also?: { connector: 'AND' | 'OR'; variable: string; operator: string; value: number };
}

export interface AlpcPathway {
  _id: string;
  name: string;
  topic: string;
  description: string;
  outcomes: { name: string; adjustment: number }[];
  rules: PathwayRule[];
  defaultPathLang: string;
  createdAt: string;
}

export interface AlpcDecision {
  _id: string;
  skill: string;
  outcome: string | null;
  alignmentScore: number | null;
  binaryOutput?: string | null;
  performance: number;
  mastery: number;
  pathLangSource: string;
  createdAt: string;
}

// ── Study pages ──────────────────────────────────────────────────────────────

export type StudyLevel = 'intro' | 'practice' | 'core' | 'advanced';

export interface StudyResource {
  id: string;
  level: StudyLevel;
  type: 'video' | 'article' | 'visualization' | 'problems';
  title: string;
  source: string;
  url: string;
  note: string;
  doneAt: string | null;
}

export interface StudyTopic {
  skill: string;
  masteryPercent: number | null;
  resources: number;
  done: number;
  outcome: string | null;
}

export interface StudyPage {
  skill: string;
  masteryPercent: number | null;
  decision: {
    decisionId: string | null;
    outcome: string | null;
    alignmentScore: number | null;
    createdAt: string;
    reused: boolean;
    error: string | null;
  };
  levels: StudyLevel[] | null;
  chosen: StudyResource[];
  others: StudyResource[];
}
