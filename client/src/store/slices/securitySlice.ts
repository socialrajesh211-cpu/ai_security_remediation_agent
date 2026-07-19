import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { GithubApi, SecurityStatus, getApiErrorMessage } from "../../api/client";

interface SecurityState {
  byRepo: Record<string, SecurityStatus | undefined>;
  loadingByRepo: Record<string, boolean>;
  enablingByRepo: Record<string, { dependabot?: boolean; codeScanning?: boolean }>;
  errorByRepo: Record<string, string | undefined>;
}

const initialState: SecurityState = {
  byRepo: {},
  loadingByRepo: {},
  enablingByRepo: {},
  errorByRepo: {},
};

export const fetchSecurityStatus = createAsyncThunk(
  "security/fetchStatus",
  async ({ owner, repo }: { owner: string; repo: string }, { rejectWithValue }) => {
    try {
      const status = await GithubApi.securityStatus(owner, repo);
      return { repoFullName: `${owner}/${repo}`, status };
    } catch (err: any) {
      return rejectWithValue({
        repoFullName: `${owner}/${repo}`,
        message: getApiErrorMessage(err, "Couldn't read security status."),
      });
    }
  }
);

export const enableDependabot = createAsyncThunk(
  "security/enableDependabot",
  async ({ owner, repo }: { owner: string; repo: string }, { rejectWithValue }) => {
    try {
      const result = await GithubApi.enableDependabot(owner, repo);
      return { repoFullName: `${owner}/${repo}`, dependabot: result.dependabot };
    } catch (err: any) {
      return rejectWithValue({
        repoFullName: `${owner}/${repo}`,
        message: getApiErrorMessage(err, "Couldn't enable Dependabot."),
      });
    }
  }
);

export const enableCodeScanning = createAsyncThunk(
  "security/enableCodeScanning",
  async ({ owner, repo }: { owner: string; repo: string }, { rejectWithValue }) => {
    try {
      const result = await GithubApi.enableCodeScanning(owner, repo);
      return { repoFullName: `${owner}/${repo}`, codeScanning: result.codeScanning };
    } catch (err: any) {
      return rejectWithValue({
        repoFullName: `${owner}/${repo}`,
        message: getApiErrorMessage(err, "Couldn't enable code scanning."),
      });
    }
  }
);

const securitySlice = createSlice({
  name: "security",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSecurityStatus.pending, (state, action) => {
        state.loadingByRepo[`${action.meta.arg.owner}/${action.meta.arg.repo}`] = true;
      })
      .addCase(fetchSecurityStatus.fulfilled, (state, action) => {
        state.loadingByRepo[action.payload.repoFullName] = false;
        state.byRepo[action.payload.repoFullName] = action.payload.status;
        state.errorByRepo[action.payload.repoFullName] = undefined;
      })
      .addCase(fetchSecurityStatus.rejected, (state, action) => {
        const payload = action.payload as { repoFullName: string; message: string } | undefined;
        if (payload) {
          state.loadingByRepo[payload.repoFullName] = false;
          state.errorByRepo[payload.repoFullName] = payload.message;
        }
      })

      .addCase(enableDependabot.pending, (state, action) => {
        const key = `${action.meta.arg.owner}/${action.meta.arg.repo}`;
        state.enablingByRepo[key] = { ...state.enablingByRepo[key], dependabot: true };
      })
      .addCase(enableDependabot.fulfilled, (state, action) => {
        const key = action.payload.repoFullName;
        state.enablingByRepo[key] = { ...state.enablingByRepo[key], dependabot: false };
        const existing = state.byRepo[key];
        state.byRepo[key] = {
          dependabot: action.payload.dependabot,
          codeScanning: existing?.codeScanning ?? {
            status: "unknown",
            message: "",
            manageUrl: action.payload.dependabot.manageUrl,
          },
        };
      })
      .addCase(enableDependabot.rejected, (state, action) => {
        const payload = action.payload as { repoFullName: string; message: string } | undefined;
        if (payload) {
          state.enablingByRepo[payload.repoFullName] = {
            ...state.enablingByRepo[payload.repoFullName],
            dependabot: false,
          };
          state.errorByRepo[payload.repoFullName] = payload.message;
        }
      })

      .addCase(enableCodeScanning.pending, (state, action) => {
        const key = `${action.meta.arg.owner}/${action.meta.arg.repo}`;
        state.enablingByRepo[key] = { ...state.enablingByRepo[key], codeScanning: true };
      })
      .addCase(enableCodeScanning.fulfilled, (state, action) => {
        const key = action.payload.repoFullName;
        state.enablingByRepo[key] = { ...state.enablingByRepo[key], codeScanning: false };
        const existing = state.byRepo[key];
        state.byRepo[key] = {
          codeScanning: action.payload.codeScanning,
          dependabot: existing?.dependabot ?? {
            status: "unknown",
            message: "",
            manageUrl: action.payload.codeScanning.manageUrl,
          },
        };
      })
      .addCase(enableCodeScanning.rejected, (state, action) => {
        const payload = action.payload as { repoFullName: string; message: string } | undefined;
        if (payload) {
          state.enablingByRepo[payload.repoFullName] = {
            ...state.enablingByRepo[payload.repoFullName],
            codeScanning: false,
          };
          state.errorByRepo[payload.repoFullName] = payload.message;
        }
      });
  },
});

export default securitySlice.reducer;
