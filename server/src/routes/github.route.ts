import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { requireGithubToken } from "../middlewares/auth.middleware";
import { restrictDemoRepoParams } from "../middlewares/demoRestriction.middleware";
import { authLimiter } from "../middlewares/rateLimit.middleware";
import {
  login,
  callback,
  me,
  repos,
  scan,
  securityStatus,
  enableDependabotHandler,
  enableCodeScanningHandler,
  getPreferences,
  putPreferences,
} from "../controllers/github.controller";

const router = Router();

// Unauthenticated entry points — rate limited separately since they're the
// easiest target for abuse (no token required to hit them).
router.get("/login", authLimiter, login);
router.get("/callback", authLimiter, asyncHandler(callback));

// Determines auth state itself (returns 401 rather than redirecting), so it
// isn't behind requireGithubToken.
router.get("/me", asyncHandler(me));

// Everything below requires a verified GitHub Bearer token.
router.use(requireGithubToken);

router.get("/repos", asyncHandler(repos));
router.post("/repos/:owner/:repo/scan", restrictDemoRepoParams, asyncHandler(scan));
router.get("/repos/:owner/:repo/security-status", restrictDemoRepoParams, asyncHandler(securityStatus));
router.post("/repos/:owner/:repo/enable-dependabot", restrictDemoRepoParams, asyncHandler(enableDependabotHandler));
router.post("/repos/:owner/:repo/enable-code-scanning", restrictDemoRepoParams, asyncHandler(enableCodeScanningHandler));

router.get("/preferences", asyncHandler(getPreferences));
router.put("/preferences", asyncHandler(putPreferences));

export default router;
