import { createAction, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { AccountData, AccountUser } from '../../api/types';

/**
 * Sesión de la cuenta. NO se persiste con redux-persist: el token vive en
 * almacenamiento seguro (auth/storage.ts) y se restaura al abrir la app.
 *  - loading:        restaurando la sesión al arrancar.
 *  - guest:          sin cuenta (los datos solo están en este dispositivo).
 *  - authenticated:  con cuenta (los datos se guardan también en el servidor).
 */
export interface SessionState {
  status: 'loading' | 'guest' | 'authenticated';
  token: string | null;
  user: AccountUser | null;
}

const initialState: SessionState = { status: 'loading', token: null, user: null };

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    /** Se restauró una sesión guardada en el dispositivo (aún sin confirmar con el servidor). */
    sessionRestored(state, action: PayloadAction<{ token: string; user: AccountUser }>) {
      state.status = 'authenticated';
      state.token = action.payload.token;
      state.user = action.payload.user;
    },
    /** Inicio de sesión recién hecho con el código del correo. Dispara la sincronización. */
    signedIn(state, action: PayloadAction<{ token: string; user: AccountUser }>) {
      state.status = 'authenticated';
      state.token = action.payload.token;
      state.user = action.payload.user;
    },
    becameGuest(state) {
      state.status = 'guest';
      state.token = null;
      state.user = null;
    },
    /** Cerrar sesión, sesión vencida o cuenta eliminada: se borran del dispositivo los datos de la cuenta. */
    signedOut(state) {
      state.status = 'guest';
      state.token = null;
      state.user = null;
    },
  },
});

export const { sessionRestored, signedIn, becameGuest, signedOut } = sessionSlice.actions;

/**
 * Datos de la cuenta llegados del servidor (GET /api/me o POST /api/me/sync).
 * Lo manejan los slices `preferences`, `saved` e `history`.
 */
export const accountLoaded = createAction<AccountData>('session/accountLoaded');

export default sessionSlice.reducer;
