import { Octokit } from "@octokit/rest";
import { Finding, Severity } from "../types";

function client(token: string) {
  return new Octokit({ auth: token });
}

/**
 * GitHub's alert descriptions (esp. Dependabot/GHSA advisory writeups, which
 * can include full markdown with tables and reference lists) and CodeQL
 * `full_description`s have no upstream size limit. Truncating once here,
 * right after the raw GitHub response comes in, means every downstream
 * consumer — MongoDB storage, the finding-detail UI, and the AI request
 * payload — automatically gets a small, well-formed value instead of each
 * one needing its own defensive cap.
 */
const MAX_DESCRIPTION_CHARS = 1_200;

function truncateDescription(text: string | undefined | null): string {
  if (!text) return "";
  const cleaned = text.trim();
  if (cleaned.length <= MAX_DESCRIPTION_CHARS) return cleaned;
  return `${cleaned.slice(0, MAX_DESCRIPTION_CHARS)}…`;
}

/**
 * Verifies a GitHub token and returns the authenticated user's public profile.
 * Used both to gate access (landing page vs dashboard) and to upsert the User record.
 */
export async function getAuthenticatedUser(token: string) {
  const octokit = client(token);
  const { data } = await octokit.users.getAuthenticated();
  return {
    id: data.id,
    username: data.login,
    name: data.name ?? undefined,
    avatarUrl: data.avatar_url,
  };
}

export async function listRepositories(token: string) {
  const octokit = client(token);
  const { data } = await octokit.repos.listForAuthenticatedUser({
    per_page: 50,
    sort: "updated",
  });
  return data.map((r) => ({
    id: r.id,
    name: r.name,
    fullName: r.full_name,
    private: r.private,
    defaultBranch: r.default_branch,
    updatedAt: r.updated_at,
    description: r.description ?? undefined,
    language: r.language ?? undefined,
    htmlUrl: r.html_url,
  }));
}

/**
 * Reads GitHub code scanning alerts (CodeQL / third-party SARIF uploads) for a repo.
 * Falls back gracefully if the repo has no code scanning enabled or the token
 * lacks the `security_events` scope — callers should offer SARIF upload instead.
 */
export async function listCodeScanningAlerts(token: string, owner: string, repo: string) {
  const octokit = client(token);
  const { data } = await octokit.request(
    "GET /repos/{owner}/{repo}/code-scanning/alerts",
    { owner, repo, state: "open", per_page: 50 }
  );
  return data;
}

export async function listDependabotAlerts(token: string, owner: string, repo: string) {
  const octokit = client(token);
  const { data } = await octokit.request(
    "GET /repos/{owner}/{repo}/dependabot/alerts",
    { owner, repo, state: "open", per_page: 50 }
  );
  return data;
}

/* -------------------------------------------------------------------------- */
/*                    Security feature status / enablement                    */
/* -------------------------------------------------------------------------- */

export type FeatureStatus = "enabled" | "disabled" | "in_progress" | "restricted" | "unknown";

export interface FeatureState {
  status: FeatureStatus;
  message: string;
  manageUrl: string;
}

/**
 * GitHub Advanced Security features (code scanning default setup) are only free
 * on public repos. On private repos they require a GHAS license — GitHub replies
 * with 403/404 in that case, which we surface as "restricted" rather than a hard error.
 */
function isGhasRestriction(err: any): boolean {
  const status = err?.status ?? err?.response?.status;
  const message: string = (err?.message ?? err?.response?.data?.message ?? "").toLowerCase();
  return (
    status === 403 ||
    status === 451 ||
    message.includes("advanced security") ||
    message.includes("must be enabled")
  );
}

/**
 * Reads whether Dependabot alerts (vulnerability-alerts) are enabled for a repo.
 * GitHub returns 204 when enabled and 404 when disabled — neither is an "error" for us.
 */
export async function getDependabotStatus(
  token: string,
  owner: string,
  repo: string
): Promise<FeatureState> {
  const manageUrl = `https://github.com/${owner}/${repo}/settings/security_analysis`;
  const octokit = client(token);

  try {
    await octokit.request("GET /repos/{owner}/{repo}/vulnerability-alerts", { owner, repo });
    return { status: "enabled", message: "Dependabot alerts are enabled for this repository.", manageUrl };
  } catch (err: any) {
    const status = err?.status ?? err?.response?.status;
    if (status === 404) {
      return {
        status: "disabled",
        message: "Dependabot alerts are turned off for this repository.",
        manageUrl,
      };
    }
    if (isGhasRestriction(err)) {
      return {
        status: "restricted",
        message:
          "This repository doesn't allow enabling Dependabot alerts via the API (private repo permissions or plan limits). Enable it manually in GitHub settings.",
        manageUrl,
      };
    }
    return {
      status: "unknown",
      message: "Couldn't determine Dependabot status from GitHub.",
      manageUrl,
    };
  }
}

/**
 * Reads the CodeQL "default setup" state for code scanning.
 * `state` is one of: "configured" | "not-configured".
 * A repo mid-way through GitHub provisioning the analysis returns "configured"
 * immediately but alerts take a few minutes to appear — we treat a very recent
 * `updated_at` with no alerts yet as "in_progress" from the caller side.
 */
export async function getCodeScanningStatus(
  token: string,
  owner: string,
  repo: string
): Promise<FeatureState> {
  const manageUrl = `https://github.com/${owner}/${repo}/settings/security_analysis`;
  const octokit = client(token);

  try {
    const { data } = await octokit.request(
      "GET /repos/{owner}/{repo}/code-scanning/default-setup",
      { owner, repo }
    );

    const state = (data as any)?.state;
    if (state === "configured") {
      // GitHub is provisioning/has provisioned CodeQL. If it was configured in the
      // last few minutes, the first analysis run is very likely still in progress.
      const updatedAt = (data as any)?.updated_at ? new Date((data as any).updated_at) : null;
      const justConfigured = updatedAt ? Date.now() - updatedAt.getTime() < 5 * 60 * 1000 : false;
      return justConfigured
        ? {
            status: "in_progress",
            message: "Code scanning was just enabled — GitHub is running the first CodeQL analysis. This can take a few minutes.",
            manageUrl,
          }
        : { status: "enabled", message: "Code scanning (CodeQL default setup) is enabled.", manageUrl };
    }

    return {
      status: "disabled",
      message: "Code scanning is not enabled for this repository.",
      manageUrl,
    };
  } catch (err: any) {
    if (isGhasRestriction(err)) {
      return {
        status: "restricted",
        message:
          "Code scanning can't be enabled via the API for this repository (private repos need GitHub Advanced Security). Enable it manually in GitHub settings.",
        manageUrl,
      };
    }
    return {
      status: "unknown",
      message: "Couldn't determine code scanning status from GitHub.",
      manageUrl,
    };
  }
}

/** Enables Dependabot alerts + Dependabot security updates (default GitHub settings). */
export async function enableDependabot(token: string, owner: string, repo: string) {
  const octokit = client(token);

  await octokit.request("PUT /repos/{owner}/{repo}/vulnerability-alerts", { owner, repo });

  // Best-effort: automated security fixes require vulnerability-alerts to already be on.
  try {
    await octokit.request("PUT /repos/{owner}/{repo}/automated-security-fixes", { owner, repo });
  } catch {
    // Non-fatal — alerts are the primary ask; security-update PRs are a bonus.
  }
}

/** Enables CodeQL "default setup" code scanning with GitHub's default configuration. */
export async function enableCodeScanningDefaultSetup(token: string, owner: string, repo: string) {
  const octokit = client(token);
  await octokit.request("PATCH /repos/{owner}/{repo}/code-scanning/default-setup", {
    owner,
    repo,
    state: "configured",
  });
}

function mapCodeScanningSeverity(level?: string): Severity {
  switch (level) {
    case "error":
      return "critical";
    case "warning":
      return "high";
    case "note":
      return "medium";
    default:
      return "low";
  }
}

function mapDependabotSeverity(severity?: string): Severity {
  switch ((severity ?? "").toLowerCase()) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    case "medium":
    case "moderate":
      return "medium";
    default:
      return "low";
  }
}

/** Normalizes GitHub Code Scanning (CodeQL / Semgrep / Trivy → SARIF → GitHub) alerts into Findings. */
export function normalizeCodeScanningAlerts(alerts: any[], repoFullName: string): Finding[] {
  return (alerts ?? []).map((alert) => {
    const location = alert?.most_recent_instance?.location ?? {};
    const rule = alert?.rule ?? {};
    const tags: string[] = rule?.tags ?? [];
    const cwe = tags.find((t: string) => /^cwe-/i.test(t) || /^external\/cwe/i.test(t));

    const finding: Finding = {
      id: `codeql-${alert.number}`,
      repo: repoFullName,
      title: rule?.description ?? rule?.name ?? alert?.most_recent_instance?.message?.text ?? "Security finding",
      severity: mapCodeScanningSeverity(rule?.severity ?? rule?.security_severity_level),
      cwe,
      description: truncateDescription(alert?.most_recent_instance?.message?.text ?? rule?.full_description),
      file: location?.path ?? "unknown",
      startLine: location?.start_line ?? 1,
      endLine: location?.end_line ?? location?.start_line ?? 1,
      source: "codeql",
      codeSnippet: "",
    };
    return finding;
  });
}

/** Normalizes GitHub Dependabot alerts into Findings. */
export function normalizeDependabotAlerts(alerts: any[], repoFullName: string): Finding[] {
  return (alerts ?? []).map((alert) => {
    const advisory = alert?.security_advisory ?? {};
    const pkg = alert?.dependency?.package ?? {};

    const finding: Finding = {
      id: `dependabot-${alert.number}`,
      repo: repoFullName,
      title: advisory?.summary ?? `Vulnerable dependency: ${pkg?.name ?? "unknown"}`,
      severity: mapDependabotSeverity(advisory?.severity),
      cve: advisory?.cve_id ?? advisory?.ghsa_id,
      cwe: advisory?.cwes?.[0]?.cwe_id,
      description: truncateDescription(advisory?.description),
      file: alert?.dependency?.manifest_path ?? "package manifest",
      startLine: 1,
      endLine: 1,
      source: "dependabot",
      codeSnippet: `${pkg?.name ?? "unknown"}@${alert?.security_vulnerability?.vulnerable_version_range ?? "?"}`,
    };
    return finding;
  });
}

/**
 * Reads a small, line-numbered snippet of a file straight from the repo's default
 * branch so finding details can show real code instead of "// no snippet captured".
 * Best-effort: returns "" (never throws) if the file can't be read (binary, too large,
 * deleted since the alert was raised, insufficient token scope, etc).
 */
export async function getFileSnippet(
  token: string,
  owner: string,
  repo: string,
  path: string,
  startLine: number,
  endLine: number,
  contextLines = 3
): Promise<string> {
  if (!path || path === "unknown") return "";

  // Hard ceiling on how many source lines a snippet can ever contain — some
  // CodeQL rules (whole-function taint flows) report line ranges spanning
  // hundreds of lines. Without this, a single finding's snippet could blow
  // past the UI's usable height and the AI request's size budget on its own.
  const MAX_SNIPPET_LINES = 60;

  try {
    const octokit = client(token);
    const { data } = await octokit.repos.getContent({ owner, repo, path });

    if (Array.isArray(data) || data.type !== "file" || !("content" in data)) return "";
    if (typeof data.size === "number" && data.size > 300_000) return ""; // skip huge/binary-ish files

    const content = Buffer.from(data.content, data.encoding as BufferEncoding).toString("utf-8");
    const lines = content.split("\n");

    const start = Math.max(1, startLine || 1);
    const end = Math.max(start, endLine || start);
    let from = Math.max(1, start - contextLines);
    let to = Math.min(lines.length, end + contextLines);

    const width = String(to).length;
    const render = (lineNo: number) => {
      const marker = lineNo >= start && lineNo <= end ? ">" : " ";
      return `${marker} ${String(lineNo).padStart(width, " ")} | ${lines[lineNo - 1]}`;
    };

    if (to - from + 1 <= MAX_SNIPPET_LINES) {
      const out: string[] = [];
      for (let n = from; n <= to; n++) out.push(render(n));
      return out.join("\n");
    }

    // Range too large to show in full — keep a window at the start and end
    // of the flagged range (where the vulnerable sink/source usually is)
    // and collapse the middle rather than truncating mid-line arbitrarily.
    const half = Math.floor(MAX_SNIPPET_LINES / 2);
    const headEnd = Math.min(to, from + half - 1);
    const tailStart = Math.max(from, to - half + 1);
    const out: string[] = [];
    for (let n = from; n <= headEnd; n++) out.push(render(n));
    out.push(`  … ${tailStart - headEnd - 1} lines omitted …`);
    for (let n = tailStart; n <= to; n++) out.push(render(n));
    return out.join("\n");
  } catch {
    return "";
  }
}

interface CreatePrParams {
  token: string;
  owner: string;
  repo: string;
  baseBranch: string;
  finding: Finding;
  patchedCode: string;
  prTitle: string;
  prBody: string;
  /**
   * Appended to the branch name (e.g. `demo-<sessionId>`). Multiple demo
   * visitors share one repo, so without this every demo fix would race to
   * create the same `security-fix/<findingId>` branch. Omit for real
   * GitHub sessions, where each user has their own fork/repo access anyway.
   */
  branchSuffix?: string;
}

/**
 * Creates (or reuses) a branch, commits the patched file content, and opens
 * a Pull Request. If the branch already exists — which happens when a demo
 * session re-runs a fix, or a caller retries — the existing branch is
 * reused instead of failing on a duplicate-ref error.
 */
export async function createSecurityPatchPR(params: CreatePrParams) {
  const { token, owner, repo, baseBranch, finding, patchedCode, prTitle, prBody, branchSuffix } = params;
  const octokit = client(token);

  const branchName = (branchSuffix ? `security-fix/${finding.id}-${branchSuffix}` : `security-fix/${finding.id}`).slice(
    0,
    200
  );

  const { data: baseRef } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${baseBranch}`,
  });

  try {
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: baseRef.object.sha,
    });
  } catch (err: any) {
    // 422 "Reference already exists" — reuse it rather than failing. Any
    // other error (permissions, rate limit, etc.) should still propagate.
    if (err?.status !== 422) throw err;
  }

  const { data: existingFile } = await octokit.repos.getContent({
    owner,
    repo,
    path: finding.file,
    ref: branchName,
  });

  const sha = Array.isArray(existingFile) ? undefined : existingFile.sha;

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: finding.file,
    message: `fix: remediate ${finding.title} (${finding.id})`,
    content: Buffer.from(patchedCode, "utf-8").toString("base64"),
    branch: branchName,
    sha,
  });

  let pr: any;
  try {
    ({ data: pr } = await octokit.pulls.create({
      owner,
      repo,
      title: prTitle,
      body: prBody,
      head: branchName,
      base: baseBranch,
    }));
  } catch (err: any) {
    // 422 here typically means a PR is already open for this branch (the
    // branch-reuse case above) — look it up and return that instead of failing.
    if (err?.status !== 422) throw err;
    const { data: existing } = await octokit.pulls.list({ owner, repo, head: `${owner}:${branchName}`, state: "open" });
    if (!existing.length) throw err;
    pr = existing[0];
  }

  return {
    url: pr.html_url,
    number: pr.number,
    branch: branchName,
  };
}
