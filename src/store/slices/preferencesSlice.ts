import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { CityId, Criterion } from '../../domain/types';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface PreferencesState {
  city: CityId;
  criterion: Criterion;
  themeMode: ThemeMode;
  haptics: boolean;
}

const initialState: PreferencesState = {
  city: 'bogota',
  criterion: 'equilibrado',
  themeMode: 'system',
  haptics: true,
};

const preferencesSlice = createSlice({
  name: 'preferences',
  initialState,
  reducers: {
    setCity(state, action: PayloadAction<CityId>) {
      state.city = action.payload;
    },
    setCriterion(state, action: PayloadAction<Criterion>) {
      state.criterion = action.payload;
    },
    setThemeMode(state, action: PayloadAction<ThemeMode>) {
      state.themeMode = action.payload;
    },
    setHaptics(state, action: PayloadAction<boolean>) {
      state.haptics = action.payload;
    },
  },
});

export const { setCity, setCriterion, setThemeMode, setHaptics } = preferencesSlice.actions;
export default preferencesSlice.reducer;
