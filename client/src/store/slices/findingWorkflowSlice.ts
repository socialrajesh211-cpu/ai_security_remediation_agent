import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { AiApi, AIAnalysis, Finding, Patch } from "../../api/client";

export type WorkflowStage = "details" | "analysis" | "patch" | "pr";
export type Audience = "senior" | "junior" | "product";

export interface PrResult {
  draft: { title: string; description: string };
  pr?: { url: string; number: number; branch: string };
}

/**
 * Structured error surfaced from the server (see server/src/utils/errors.ts +
 * constants/ai.constants.ts). `reason` is the human explanation, and
 * `adminActionRequired` tells the UI whether to say "try again" or
 * "contact your admin" — instead of always showing a flat "X failed".
 */
export interface WorkflowError {
  message: string;
  reason?: string;
  code?: string;
  adminActionRequired?: boolean;
}

export interface FindingWorkflowState {
  stage: WorkflowStage;
  audience: Audience;
  analysis: AIAnalysis | null;
  patch: Patch | null;
  prResult: PrResult | null;
  analyzing: boolean;
  patching: boolean;
  creatingPr: boolean;
  error: WorkflowError | null;
}

interface State {
  byFinding: Record<string, FindingWorkflowState>;
}

const emptyWorkflow: FindingWorkflowState = {
  stage: "details",
  audience: "senior",
  analysis: null,
  patch: null,
  prResult: null,
  analyzing: false,
  patching: false,
  creatingPr: false,
  error: null,
};

const initialState: State = { byFinding: {} };

function ensure(state: State, findingId: string): FindingWorkflowState {
  if (!state.byFinding[findingId]) {
    state.byFinding[findingId] = { ...emptyWorkflow };
  }
  return state.byFinding[findingId];
}

/**
 * Pulls the server's structured error response (error/code/reason/adminActionRequired)
 * off an axios error, falling back gracefully for network failures or responses
 * that didn't go through our error middleware (e.g. a proxy 502).
 */
function extractError(err: any, fallbackMessage: string): WorkflowError {
  const data = err?.response?.data;
  if (data?.error) {
    return {
      message: data.error,
      reason: data.reason,
      code: data.code,
      adminActionRequired: data.adminActionRequired,
    };
  }
  if (!err?.response) {
    return {
      message: fallbackMessage,
      reason: "Couldn't reach the server. Check your connection and try again.",
      adminActionRequired: false,
    };
  }
  return { message: fallbackMessage, adminActionRequired: false };
}

export const runAnalysis = createAsyncThunk(
  "findingWorkflow/runAnalysis",
  async (
    { finding, audience }: { finding: Finding; audience: Audience },
    { rejectWithValue }
  ) => {
    try {
      const analysis = await AiApi.analyze(finding, audience);
      return { findingId: finding.id, analysis };
    } catch (err: any) {
      return rejectWithValue(extractError(err, "AI analysis failed"));
    }
  }
);

export const runPatch = createAsyncThunk(
  "findingWorkflow/runPatch",
  async ({ finding }: { finding: Finding }, { rejectWithValue }) => {
    try {
      const patch = await AiApi.patch(finding);
      return { findingId: finding.id, patch };
    } catch (err: any) {
      return rejectWithValue(extractError(err, "Patch generation failed"));
    }
  }
);

export const runPullRequest = createAsyncThunk(
  "findingWorkflow/runPullRequest",
  async (
    {
      finding,
      patch,
      owner,
      repo,
      openPr,
    }: { finding: Finding; patch: Patch; owner: string; repo: string; openPr: boolean },
    { rejectWithValue }
  ) => {
    try {
      const result = await AiApi.pullRequest({ finding, patch, owner, repo, baseBranch: "main", openPr });
      return { findingId: finding.id, result };
    } catch (err: any) {
      return rejectWithValue(extractError(err, "Pull request step failed"));
    }
  }
);

const findingWorkflowSlice = createSlice({
  name: "findingWorkflow",
  initialState,
  reducers: {
    setAudience(state, action: PayloadAction<{ findingId: string; audience: Audience }>) {
      ensure(state, action.payload.findingId).audience = action.payload.audience;
    },
    setStage(state, action: PayloadAction<{ findingId: string; stage: WorkflowStage }>) {
      ensure(state, action.payload.findingId).stage = action.payload.stage;
    },
    clearWorkflow(state, action: PayloadAction<{ findingId: string }>) {
      delete state.byFinding[action.payload.findingId];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(runAnalysis.pending, (state, action) => {
        const w = ensure(state, action.meta.arg.finding.id);
        w.analyzing = true;
        w.error = null;
      })
      .addCase(runAnalysis.fulfilled, (state, action) => {
        const w = ensure(state, action.payload.findingId);
        w.analyzing = false;
        w.analysis = action.payload.analysis;
        w.stage = "analysis";
      })
      .addCase(runAnalysis.rejected, (state, action) => {
        const w = ensure(state, action.meta.arg.finding.id);
        w.analyzing = false;
        w.error = (action.payload as WorkflowError) ?? { message: "AI analysis failed" };
      })

      .addCase(runPatch.pending, (state, action) => {
        const w = ensure(state, action.meta.arg.finding.id);
        w.patching = true;
        w.error = null;
      })
      .addCase(runPatch.fulfilled, (state, action) => {
        const w = ensure(state, action.payload.findingId);
        w.patching = false;
        w.patch = action.payload.patch;
        w.stage = "patch";
      })
      .addCase(runPatch.rejected, (state, action) => {
        const w = ensure(state, action.meta.arg.finding.id);
        w.patching = false;
        w.error = (action.payload as WorkflowError) ?? { message: "Patch generation failed" };
      })

      .addCase(runPullRequest.pending, (state, action) => {
        const w = ensure(state, action.meta.arg.finding.id);
        w.creatingPr = true;
        w.error = null;
      })
      .addCase(runPullRequest.fulfilled, (state, action) => {
        const w = ensure(state, action.payload.findingId);
        w.creatingPr = false;
        w.prResult = action.payload.result;
        w.stage = "pr";
      })
      .addCase(runPullRequest.rejected, (state, action) => {
        const w = ensure(state, action.meta.arg.finding.id);
        w.creatingPr = false;
        w.error = (action.payload as WorkflowError) ?? { message: "Pull request step failed" };
      });
  },
});

export const { setAudience, setStage, clearWorkflow } = findingWorkflowSlice.actions;
export default findingWorkflowSlice.reducer;
