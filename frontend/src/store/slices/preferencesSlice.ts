import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { Criterion } from '../../domain/ranking';
import { accountLoaded } from './sessionSlice';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface PreferencesState {
  /** ID de ciudad del backend (GET /api/cities). */
  city: string;
  /** Nombre para mostrar sin esperar a la API. */
  cityName: string;
  criterion: Criterion;
  themeMode: ThemeMode;
  haptics: boolean;
}

const initialState: PreferencesState = {
  city: 'bogota',
  cityName: 'Bogotá',
  criterion: 'equilibrado',
  themeMode: 'system',
  haptics: true,
};

const preferencesSlice = createSlice({
  name: 'preferences',
  initialState,
  reducers: {
    setCity(state, action: PayloadAction<{ id: string; name: string }>) {
      state.city = action.payload.id;
      state.cityName = action.payload.name;
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
  extraReducers: (builder) => {
    // Al entrar a la cuenta se aplican las preferencias guardadas en el servidor.
    builder.addCase(accountLoaded, (state, action) => (action.payload.preferences ? { ...state, ...action.payload.preferences } : state));
  },
});

export const { setCity, setCriterion, setThemeMode, setHaptics } = preferencesSlice.actions;
export default preferencesSlice.reducer;
