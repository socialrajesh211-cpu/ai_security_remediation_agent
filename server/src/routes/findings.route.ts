import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { requireGithubToken } from "../middlewares/auth.middleware";
import { restrictDemoRepoParams } from "../middlewares/demoRestriction.middleware";
import { listFindings, getFinding } from "../controllers/findings.controller";

const router = Router();

// Findings mirror GitHub security data for a repo — require a verified
// GitHub session so one user can't enumerate another's private repo findings
// just by guessing an owner/repo pair.
router.use(requireGithubToken);
router.use(restrictDemoRepoParams);

router.get("/:owner/:repo", asyncHandler(listFindings));
router.get("/:owner/:repo/:findingId", asyncHandler(getFinding));

export default router;
