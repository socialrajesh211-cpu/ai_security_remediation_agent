import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { authLimiter } from "../middlewares/rateLimit.middleware";
import { login, callback } from "../controllers/demo.controller";

const router = Router();

// Same rate-limit treatment as GitHub's unauthenticated entry points — no
// token required to hit these, so they're the easiest abuse target.
router.get("/google/login", authLimiter, login);
router.get("/google/callback", authLimiter, asyncHandler(callback));

export default router;
