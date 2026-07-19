import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type FindingsViewMode = "cards" | "table";
export type FindingsSortKey = "severity" | "title" | "file" | "source";
export type SortDir = "asc" | "desc";
export type Severity = "critical" | "high" | "medium" | "low";

interface UiState {
  /** "owner/repo" of the currently selected sidebar item — the "selected tab". */
  selectedRepoFullName: string | null;
  search: string;

  /** Findings explorer state — kept here (not local component state) so it
   * survives navigating to a finding's details page and back. */
  sourceTab: string; // "all" | "codeql" | "dependabot" | ...
  viewMode: FindingsViewMode;
  severityFilter: Severity[];
  sortKey: FindingsSortKey;
  sortDir: SortDir;
}

const initialState: UiState = {
  selectedRepoFullName: null,
  search: "",
  sourceTab: "all",
  viewMode: "cards",
  severityFilter: [],
  sortKey: "severity",
  sortDir: "desc",
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setSelectedRepo(state, action: PayloadAction<string | null>) {
      state.selectedRepoFullName = action.payload;
    },
    setSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
    },
    setSourceTab(state, action: PayloadAction<string>) {
      state.sourceTab = action.payload;
    },
    setViewMode(state, action: PayloadAction<FindingsViewMode>) {
      state.viewMode = action.payload;
    },
    toggleSeverityFilter(state, action: PayloadAction<Severity>) {
      const idx = state.severityFilter.indexOf(action.payload);
      if (idx === -1) state.severityFilter.push(action.payload);
      else state.severityFilter.splice(idx, 1);
    },
    setSort(state, action: PayloadAction<{ key: FindingsSortKey; dir: SortDir }>) {
      state.sortKey = action.payload.key;
      state.sortDir = action.payload.dir;
    },
  },
});

export const {
  setSelectedRepo,
  setSearch,
  setSourceTab,
  setViewMode,
  toggleSeverityFilter,
  setSort,
} = uiSlice.actions;
export default uiSlice.reducer;
