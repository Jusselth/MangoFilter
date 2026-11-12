import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { accountLoaded, signedOut } from './sessionSlice';

const MAX_HISTORY = 8;

interface HistoryState {
  queries: string[];
}

const initialState: HistoryState = { queries: [] };

const historySlice = createSlice({
  name: 'history',
  initialState,
  reducers: {
    addQuery(state, action: PayloadAction<string>) {
      const q = action.payload.trim();
      if (!q) return;
      state.queries = [q, ...state.queries.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, MAX_HISTORY);
    },
    removeQuery(state, action: PayloadAction<string>) {
      state.queries = state.queries.filter((x) => x !== action.payload);
    },
    clearHistory(state) {
      state.queries = [];
    },
  },
  extraReducers: (builder) => {
    builder.addCase(accountLoaded, (state, action) => {
      state.queries = action.payload.history.slice(0, MAX_HISTORY);
    });
    builder.addCase(signedOut, (state) => {
      state.queries = [];
    });
  },
});

export const { addQuery, removeQuery, clearHistory } = historySlice.actions;
export default historySlice.reducer;
