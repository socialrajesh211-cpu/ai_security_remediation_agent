import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { GithubApi, Finding, getApiErrorMessage } from "../../api/client";
import { enableDependabot, enableCodeScanning } from "./securitySlice";

interface FindingsState {
  byRepo: Record<string, Finding[]>;
  warningsByRepo: Record<string, string[]>;
  loading: boolean;
  error: string | null;
}

const initialState: FindingsState = {
  byRepo: {},
  warningsByRepo: {},
  loading: false,
  error: null,
};

export const scanRepo = createAsyncThunk(
  "findings/scanRepo",
  async ({ owner, repo }: { owner: string; repo: string }, { rejectWithValue }) => {
    try {
      const result = await GithubApi.scan(owner, repo);
      return { repoFullName: `${owner}/${repo}`, findings: result.findings, warnings: result.warnings ?? [] };
    } catch (err: any) {
      return rejectWithValue(getApiErrorMessage(err, "Couldn't run the agent against this repository."));
    }
  }
);

const findingsSlice = createSlice({
  name: "findings",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(scanRepo.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(scanRepo.fulfilled, (state, action) => {
        state.loading = false;
        state.byRepo[action.payload.repoFullName] = action.payload.findings;
        state.warningsByRepo[action.payload.repoFullName] = action.payload.warnings;
      })
      .addCase(scanRepo.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) ?? "Couldn't run the agent against this repository.";
      })
      // The "not enabled" warnings above come from the last scan, so turning a
      // feature on afterwards doesn't touch them on its own — without this, the
      // warning banner would keep showing "Dependabot alerts are not enabled"
      // even right after the user enables it from the Settings page. Drop the
      // matching warning as soon as GitHub confirms the feature is on (or being
      // provisioned); leave it in place if it came back "restricted", since it's
      // genuinely still not enabled and needs a manual step.
      .addCase(enableDependabot.fulfilled, (state, action) => {
        const key = action.payload.repoFullName;
        const status = action.payload.dependabot.status;
        if ((status === "enabled" || status === "in_progress") && state.warningsByRepo[key]) {
          state.warningsByRepo[key] = state.warningsByRepo[key].filter(
            (w) => !w.toLowerCase().includes("dependabot")
          );
        }
      })
      .addCase(enableCodeScanning.fulfilled, (state, action) => {
        const key = action.payload.repoFullName;
        const status = action.payload.codeScanning.status;
        if ((status === "enabled" || status === "in_progress") && state.warningsByRepo[key]) {
          state.warningsByRepo[key] = state.warningsByRepo[key].filter(
            (w) => !w.toLowerCase().includes("code scanning")
          );
        }
      });
  },
});

export default findingsSlice.reducer;
