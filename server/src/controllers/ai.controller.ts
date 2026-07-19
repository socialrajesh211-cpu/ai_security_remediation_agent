import { Request, Response } from "express";
import { z } from "zod";
import { analyzeFinding, generatePatch, draftPullRequest } from "../services/ai.service";
import { createSecurityPatchPR } from "../services/github.service";

export const findingSchema = z.object({
  id: z.string().max(200),
  repo: z.string().max(200),
  title: z.string().max(500),
  severity: z.enum(["critical", "high", "medium", "low"]),
  cve: z.string().max(50).optional(),
  cwe: z.string().max(50).optional(),
  // Findings are truncated to ~1200 chars at the source (github.service.ts
  // normalizers) — this cap is a generous ceiling above that, not the
  // primary control. Keeping it well under the old 5000 stops any future
  // caller that bypasses normalization from sending an oversized prompt.
  description: z.string().max(2_000),
  file: z.string().max(1_000),
  startLine: z.number().int().nonnegative(),
  endLine: z.number().int().nonnegative(),
  // getFileSnippet() caps snippets at 60 lines (~8k chars worst case).
  // Same relationship to that cap as description above.
  codeSnippet: z.string().max(10_000),
  source: z.enum(["codeql", "dependabot", "semgrep", "sarif"]),
});

export const analyzeSchema = z.object({
  finding: findingSchema,
  audience: z.enum(["senior", "junior", "product"]).optional(),
});

export const patchSchema = z.object({
  finding: findingSchema,
});

export const pullRequestSchema = z.object({
  finding: findingSchema,
  patch: z.object({
    findingId: z.string().max(200),
    originalCode: z.string().max(20_000),
    patchedCode: z.string().max(20_000),
    explanation: z.string().max(5_000),
    confidence: z.number().min(0).max(100),
    testsRecommended: z.boolean(),
  }),
  owner: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/, "Invalid GitHub owner"),
  repo: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/, "Invalid GitHub repo name"),
  baseBranch: z.string().max(255).default("main"),
  openPr: z.boolean().default(false),
});

/** Analysis Agent */
export async function analyze(req: Request, res: Response) {
  const { finding, audience } = req.body as z.infer<typeof analyzeSchema>;
  const analysis = await analyzeFinding(finding, audience);
  res.json({ analysis });
}

/** Remediation Agent */
export async function patch(req: Request, res: Response) {
  const { finding } = req.body as z.infer<typeof patchSchema>;
  const result = await generatePatch(finding);
  res.json({ patch: result });
}

/** PR Agent: draft copy, then optionally open the real PR via GitHub */
export async function pullRequest(req: Request, res: Response) {
  const { finding, patch: patchInput, owner, repo, baseBranch, openPr } =
    req.body as z.infer<typeof pullRequestSchema>;

  const draft = await draftPullRequest(finding, patchInput);

  if (!openPr) {
    return res.json({ draft });
  }

  const token = req.githubToken!;

  // Multiple demo visitors share one repo — suffix the branch with this
  // session's id so their fixes never collide with each other.
  const branchSuffix = req.demoUser ? `demo-${req.identity!.id}` : undefined;

  const pr = await createSecurityPatchPR({
    token,
    owner,
    repo,
    baseBranch,
    finding,
    patchedCode: patchInput.patchedCode,
    prTitle: draft.title,
    prBody: draft.description,
    branchSuffix,
  });

  res.json({ draft, pr });
}
