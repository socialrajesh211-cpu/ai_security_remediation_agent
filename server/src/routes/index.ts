import { Router } from "express";
import githubRoutes from "./github.route";
import findingsRoutes from "./findings.route";
import aiRoutes from "./ai.route";
import demoRoutes from "./demo.route";

const router = Router();

router.use("/github", githubRoutes);
router.use("/findings", findingsRoutes);
router.use("/ai", aiRoutes);
// Demo Mode's Google OAuth entry points: GET /api/auth/google/login, /api/auth/google/callback
router.use("/auth", demoRoutes);

export default router;
