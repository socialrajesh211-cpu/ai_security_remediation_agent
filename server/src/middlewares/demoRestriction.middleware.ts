import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

/**
 * Confines demo sessions to exactly one repository (`DEMO_REPO_OWNER/DEMO_REPO_NAME`).
 * The shared `DEMO_GITHUB_TOKEN` is a fine-grained PAT scoped to that repo on
 * GitHub's side already, so this is defense-in-depth: it rejects mismatched
 * owner/repo before an outbound GitHub call is even made, and produces a
 * clear 403 instead of a confusing GitHub-side permission error.
 *
 * No-ops entirely for real GitHub sessions (`req.demoUser` unset) — only
 * apply after `requireGithubToken` on routes that take an owner/repo.
 */
export function restrictDemoRepo(getOwnerRepo: (req: Request) => { owner?: string; repo?: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.demoUser) return next();

    const { owner, repo } = getOwnerRepo(req);
    const allowedOwner = env.demo.repoOwner;
    const allowedRepo = env.demo.repoName;

    const matches =
      typeof owner === "string" &&
      typeof repo === "string" &&
      owner.toLowerCase() === allowedOwner.toLowerCase() &&
      repo.toLowerCase() === allowedRepo.toLowerCase();

    if (!matches) {
      return res.status(403).json({
        error: "Demo Mode is restricted to a single repository",
        code: "DEMO_REPO_RESTRICTED",
        reason: `Demo sessions can only access ${allowedOwner}/${allowedRepo}.`,
      });
    }

    next();
  };
}

/** Convenience variant for routes shaped `/:owner/:repo*`. */
export const restrictDemoRepoParams = restrictDemoRepo((req) => ({
  owner: req.params.owner,
  repo: req.params.repo,
}));

/** Convenience variant for routes that carry owner/repo in the JSON body (e.g. POST /ai/pull-request). */
export const restrictDemoRepoBody = restrictDemoRepo((req) => ({
  owner: req.body?.owner,
  repo: req.body?.repo,
}));
