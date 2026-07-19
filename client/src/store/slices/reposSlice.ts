import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { GithubApi, Repo, getApiErrorMessage } from "../../api/client";

interface ReposState {
  items: Repo[] | null;
  loading: boolean;
  error: string | null;
}

const initialState: ReposState = {
  items: null,
  loading: false,
  error: null,
};

export const fetchRepos = createAsyncThunk(
  "repos/fetchRepos",
  async (_: void, { rejectWithValue }) => {
    try {
      return await GithubApi.repos();
    } catch (err) {
      return rejectWithValue(getApiErrorMessage(err, "Couldn't load your GitHub repositories."));
    }
  }
);

const reposSlice = createSlice({
  name: "repos",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchRepos.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRepos.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchRepos.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) ?? "Couldn't load your GitHub repositories. Try refreshing.";
        state.items = [];
      });
  },
});

export default reposSlice.reducer;
