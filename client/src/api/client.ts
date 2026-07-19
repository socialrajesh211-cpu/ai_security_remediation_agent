import axios, { AxiosError } from "axios";

// In dev, Vite's proxy forwards "/api" to the local server (see vite.config.ts).
// In production, the client is usually deployed on a different domain than the
// server (e.g. Vercel + Render), so VITE_API_URL must point at the full server URL,
// e.g. https://your-server.onrender.com/api
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 45_000, // AI calls can be slow; comfortably above the server's own 30s AI provider timeout
});

/**
 * Called whenever a request comes back 401 (expired/invalid GitHub session).
 * Wired up once from AuthContext so this module doesn't need to know about
 * React/router — it just clears the token and notifies whoever's listening.
 */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      setAuthToken(null);
      onUnauthorized?.();
    }
    return Promise.reject(error);
  }
);

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    localStorage.setItem("github_token", token);
  } else {
    delete api.defaults.headers.common.Authorization;
    localStorage.removeItem("github_token");
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem("github_token");
}

/**
 * The server's error middleware always responds with this shape (see
 * server/src/middlewares/error.middleware.ts). `reason` is the human-readable
 * explanation and is usually the better string to show a user than `error`,
 * which is a short stable label.
 */
export interface ApiErrorPayload {
  error: string;
  code?: string;
  reason?: string;
  adminActionRequired?: boolean;
  requestId?: string;
}

/** Pulls a user-facing message out of any axios/network error, with a sensible fallback. */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  const axiosErr = err as AxiosError<ApiErrorPayload>;
  const data = axiosErr?.response?.data;
  if (data?.reason) return data.reason;
  if (data?.error) return data.error;
  if (axiosErr?.code === "ECONNABORTED") return "The request timed out. Please try again.";
  if (!axiosErr?.response) return "Couldn't reach the server. Check your connection and try again.";
  return fallback;
}

// ---- Types shared with the server ----
export type Severity = "critical" | "high" | "medium" | "low";

export interface GitHubUser {
  id: number | string;
  username: string;
  name?: string;
  avatarUrl?: string;
}

export interface MeResponse {
  user: GitHubUser;
  isDemo?: boolean;
  /** Only present when isDemo is true — the single repo the demo session is scoped to. */
  demoRepo?: string;
}

export interface Repo {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  updatedAt: string;
  description?: string;
  language?: string;
  htmlUrl: string;
}

export interface Finding {
  id: string;
  repo: string;
  title: string;
  severity: Severity;
  cve?: string;
  cwe?: string;
  description: string;
  file: string;
  startLine: number;
  endLine: number;
  source: "codeql" | "dependabot" | "semgrep" | "sarif";
  codeSnippet: string;
}

export interface AIAnalysis {
  findingId: string;
  /** One-line gist of the issue, capped at 50 characters. */
  shortSummary: string;
  rootCause: string;
  whyVulnerable: string;
  attackExample: string;
  owaspCategory: string;
  businessImpact: string;
  likelihood: "low" | "medium" | "high";
  exploitability: "low" | "medium" | "high";
  priority: "low" | "medium" | "high" | "critical";
  recommendation: string;
  confidence: number;
}

export interface Patch {
  findingId: string;
  originalCode: string;
  patchedCode: string;
  explanation: string;
  confidence: number;
  testsRecommended: boolean;
}

export interface PullRequestDraft {
  title: string;
  /** One-line gist of the fix, capped at 50 characters. */
  shortSummary: string;
  description: string;
}

/** Status of a GitHub security feature (Dependabot alerts / code scanning) for a repo. */
export type FeatureStatus = "enabled" | "disabled" | "in_progress" | "restricted" | "unknown";

export interface FeatureState {
  status: FeatureStatus;
  message: string;
  manageUrl: string;
}

export interface SecurityStatus {
  dependabot: FeatureState;
  codeScanning: FeatureState;
}

// ---- API calls ----
export const GithubApi = {
  me: () => api.get<MeResponse>("/github/me").then((r) => r.data),
  repos: () => api.get<{ repos: Repo[] }>("/github/repos").then((r) => r.data.repos),
  /** Runs the remediation agent's discovery step against a repo (CodeQL + Dependabot → Findings, persisted in MongoDB). */
  scan: (owner: string, repo: string) =>
    api
      .post(`/github/repos/${owner}/${repo}/scan`)
      .then((r) => r.data as { repo: string; count: number; findings: Finding[]; warnings: string[] }),
  /** Whether Dependabot alerts / code scanning are enabled, disabled, in progress, or restricted for a repo. */
  securityStatus: (owner: string, repo: string) =>
    api.get(`/github/repos/${owner}/${repo}/security-status`).then((r) => r.data as SecurityStatus),
  enableDependabot: (owner: string, repo: string) =>
    api
      .post(`/github/repos/${owner}/${repo}/enable-dependabot`)
      .then((r) => r.data as { dependabot: FeatureState }),
  enableCodeScanning: (owner: string, repo: string) =>
    api
      .post(`/github/repos/${owner}/${repo}/enable-code-scanning`)
      .then((r) => r.data as { codeScanning: FeatureState }),
};

/** Demo Mode's Google OAuth entry point — see server routes/demo.route.ts. */
export const DemoApi = {
  loginUrl: () => `${import.meta.env.VITE_API_URL || "/api"}/auth/google/login`,
};

export const PreferencesApi = {
  get: () =>
    api.get("/github/preferences").then((r) => r.data as { lastSelectedRepo: string | null }),
  setLastSelectedRepo: (lastSelectedRepo: string) =>
    api
      .put("/github/preferences", { lastSelectedRepo })
      .then((r) => r.data as { lastSelectedRepo: string }),
};

export const FindingsApi = {
  list: (owner: string, repo: string) =>
    api.get(`/findings/${owner}/${repo}`).then((r) => r.data.findings as Finding[]),
  get: (owner: string, repo: string, findingId: string) =>
    api.get(`/findings/${owner}/${repo}/${findingId}`).then((r) => r.data.finding as Finding),
};

export const AiApi = {
  analyze: (finding: Finding, audience?: "senior" | "junior" | "product") =>
    api.post("/ai/analyze", { finding, audience }).then((r) => r.data.analysis as AIAnalysis),
  patch: (finding: Finding) => api.post("/ai/patch", { finding }).then((r) => r.data.patch as Patch),
  pullRequest: (params: {
    finding: Finding;
    patch: Patch;
    owner: string;
    repo: string;
    baseBranch?: string;
    openPr?: boolean;
  }) =>
    api
      .post("/ai/pull-request", params)
      .then((r) => r.data as { draft: PullRequestDraft; pr?: { url: string; number: number; branch: string } }),
};
