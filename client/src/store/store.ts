import { configureStore } from "@reduxjs/toolkit";
import reposReducer from "./slices/reposSlice";
import findingsReducer from "./slices/findingsSlice";
import securityReducer from "./slices/securitySlice";
import preferencesReducer from "./slices/preferencesSlice";
import uiReducer from "./slices/uiSlice";
import findingWorkflowReducer from "./slices/findingWorkflowSlice";

export const store = configureStore({
  reducer: {
    repos: reposReducer,
    findings: findingsReducer,
    security: securityReducer,
    preferences: preferencesReducer,
    ui: uiReducer,
    findingWorkflow: findingWorkflowReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
