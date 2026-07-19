import { Router } from "express";
import { validate } from "../middlewares/validate.middleware";
import { asyncHandler } from "../utils/asyncHandler";
import { requireGithubToken } from "../middlewares/auth.middleware";
import { restrictDemoRepoBody } from "../middlewares/demoRestriction.middleware";
import { aiLimiter } from "../middlewares/rateLimit.middleware";
import { analyze, patch, pullRequest, analyzeSchema, patchSchema, pullRequestSchema } from "../controllers/ai.controller";

const router = Router();

// AI calls cost real money and are the most expensive route in the app —
// require auth (so it isn't open to anonymous scraping) and apply a
// stricter, dedicated rate limit on top of the general one.
router.use(requireGithubToken, aiLimiter);

router.post("/analyze", validate(analyzeSchema), asyncHandler(analyze));
router.post("/patch", validate(patchSchema), asyncHandler(patch));
// validate() runs first so owner/repo are guaranteed to be well-formed strings
// before the demo-repo check reads them out of the body.
router.post("/pull-request", validate(pullRequestSchema), restrictDemoRepoBody, asyncHandler(pullRequest));

export default router;
