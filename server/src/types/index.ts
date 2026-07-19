export type Severity = "critical" | "high" | "medium" | "low";

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
  /** One-line, plain-English gist of the issue — hard-capped at 50 chars, shown in list/preview UI. */
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
  confidence: number; // 0-100
}

export interface PullRequestDraftResult {
  title: string;
  /** One-line, plain-English gist of the fix — hard-capped at 50 chars, shown in list/preview UI. */
  shortSummary: string;
  description: string;
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
  findingId: string;
  branchName: string;
  title: string;
  description: string;
  filesChanged: string[];
}
