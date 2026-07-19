import { Request, Response } from "express";
import { FindingModel } from "../models/Finding.model";
import { AppError } from "../utils/errors";

/** Alphabetical order ("critical" < "high" < "low" < "medium") is not severity
 * order, so findings are re-ranked in application code after the DB fetch
 * rather than relying on Mongo's default string sort. */
const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function toFinding(doc: any) {
  return {
    id: doc.findingId,
    repo: doc.repoFullName,
    title: doc.title,
    severity: doc.severity,
    cve: doc.cve,
    cwe: doc.cwe,
    description: doc.description,
    file: doc.file,
    startLine: doc.startLine,
    endLine: doc.endLine,
    source: doc.source,
    codeSnippet: doc.codeSnippet,
  };
}

/**
 * Read back the findings most recently scanned for a repo (persisted in MongoDB
 * by POST /api/github/repos/:owner/:repo/scan). There is no upload path — the
 * only way findings get created is by running the agent against a connected
 * GitHub repository.
 */
export async function listFindings(req: Request, res: Response) {
  const { owner, repo } = req.params;
  const repoFullName = `${owner}/${repo}`;

  try {
    const docs = await FindingModel.find({ repoFullName }).sort({ scannedAt: -1 }).lean();
    const sorted = docs.sort(
      (a, b) => (SEVERITY_RANK[a.severity] ?? 99) - (SEVERITY_RANK[b.severity] ?? 99)
    );
    res.json({ findings: sorted.map(toFinding) });
  } catch (err) {
    throw new AppError({
      message: "Failed to load findings",
      statusCode: 500,
      code: "FINDINGS_LIST_FAILED",
      reason: "The findings for this repository couldn't be loaded.",
      details: `${err}`,
    });
  }
}

export async function getFinding(req: Request, res: Response) {
  const { owner, repo, findingId } = req.params;
  const repoFullName = `${owner}/${repo}`;

  try {
    const doc = await FindingModel.findOne({ repoFullName, findingId }).lean();
    if (!doc) return res.status(404).json({ error: "Finding not found" });
    res.json({ finding: toFinding(doc) });
  } catch (err) {
    throw new AppError({
      message: "Failed to load finding",
      statusCode: 500,
      code: "FINDING_LOAD_FAILED",
      reason: "This finding couldn't be loaded.",
      details: `${err}`,
    });
  }
}
