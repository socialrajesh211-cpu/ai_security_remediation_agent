import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { PreferencesApi } from "../../api/client";

const LOCAL_CACHE_KEY = "last_selected_repo";

interface PreferencesState {
  lastSelectedRepo: string | null;
  loaded: boolean;
  saving: boolean;
}

const initialState: PreferencesState = {
  // Instant, optimistic restore from localStorage while the server round-trip is in flight.
  lastSelectedRepo: typeof window !== "undefined" ? localStorage.getItem(LOCAL_CACHE_KEY) : null,
  loaded: false,
  saving: false,
};

export const fetchPreferences = createAsyncThunk("preferences/fetch", async () => {
  return PreferencesApi.get();
});

export const saveLastSelectedRepo = createAsyncThunk(
  "preferences/saveLastSelectedRepo",
  async (repoFullName: string) => {
    localStorage.setItem(LOCAL_CACHE_KEY, repoFullName);
    return PreferencesApi.setLastSelectedRepo(repoFullName);
  }
);

const preferencesSlice = createSlice({
  name: "preferences",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPreferences.fulfilled, (state, action) => {
        state.loaded = true;
        if (action.payload.lastSelectedRepo) {
          state.lastSelectedRepo = action.payload.lastSelectedRepo;
          localStorage.setItem(LOCAL_CACHE_KEY, action.payload.lastSelectedRepo);
        }
      })
      .addCase(fetchPreferences.rejected, (state) => {
        // Non-fatal — we already have the localStorage fallback loaded above.
        state.loaded = true;
      })
      .addCase(saveLastSelectedRepo.pending, (state, action) => {
        state.saving = true;
        state.lastSelectedRepo = action.meta.arg;
      })
      .addCase(saveLastSelectedRepo.fulfilled, (state) => {
        state.saving = false;
      })
      .addCase(saveLastSelectedRepo.rejected, (state) => {
        state.saving = false;
      });
  },
});

export default preferencesSlice.reducer;
