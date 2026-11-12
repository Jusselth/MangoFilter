import { createListenerMiddleware, isAnyOf, type ThunkDispatch, type UnknownAction } from '@reduxjs/toolkit';

import type { AccountPreferences } from '../api/types';
import { clearSession, loadSession, saveSession } from '../auth/storage';
import { api } from './api';
import { clearHistory } from './slices/historySlice';
import { setCity, setCriterion, setHaptics, setThemeMode, type PreferencesState } from './slices/preferencesSlice';
import { removeSaved, toggleSaved, type SavedProduct } from './slices/savedSlice';
import { accountLoaded, becameGuest, sessionRestored, signedIn, signedOut, type SessionState } from './slices/sessionSlice';

/**
 * Sincronización entre el dispositivo y la cuenta (Redux listener middleware).
 *
 * - Invitado: todo se guarda solo en el dispositivo (redux-persist), como antes.
 * - Al iniciar sesión: los guardados y preferencias del invitado se suben a la
 *   cuenta (sin pisar lo que la cuenta ya tenía) y se descarga todo lo de la cuenta.
 * - Con sesión: cada cambio de guardados o preferencias se envía al servidor.
 * - Al abrir la app con sesión: se recarga todo desde el servidor.
 * - Al cerrar sesión: se borran del dispositivo el token, guardados e historial.
 */
interface SyncState {
  session: SessionState;
  preferences: PreferencesState;
  saved: { items: SavedProduct[] };
}
type SyncDispatch = ThunkDispatch<SyncState, unknown, UnknownAction>;

export const accountSync = createListenerMiddleware();
const startListening = accountSync.startListening.withTypes<SyncState, SyncDispatch>();

const accountPrefs = (p: PreferencesState): AccountPreferences => ({
  city: p.city,
  cityName: p.cityName,
  criterion: p.criterion,
  themeMode: p.themeMode,
  haptics: p.haptics,
});

// Inicio de sesión: guardar el token de forma segura y unir los datos del invitado con la cuenta.
startListening({
  actionCreator: signedIn,
  effect: async (action, { dispatch, getState }) => {
    await saveSession(action.payload);
    const state = getState();
    const result = await dispatch(
      api.endpoints.syncAccount.initiate({ preferences: accountPrefs(state.preferences), saved: state.saved.items }, { track: false }),
    );
    if (result.data) dispatch(accountLoaded(result.data));
    dispatch(api.util.invalidateTags(['Recommendations']));
  },
});

// App abierta con sesión guardada: recargar los datos de la cuenta (un 401 cierra la sesión en api.ts).
startListening({
  actionCreator: sessionRestored,
  effect: async (_action, { dispatch }) => {
    const request = dispatch(api.endpoints.getMe.initiate(undefined, { forceRefetch: true }));
    const result = await request;
    request.unsubscribe();
    // Sin conexión se conservan los datos que ya estaban en el dispositivo.
    if (result.data) dispatch(accountLoaded(result.data));
  },
});

startListening({
  actionCreator: signedOut,
  effect: async (_action, { dispatch }) => {
    await clearSession();
    dispatch(api.util.invalidateTags(['Recommendations']));
  },
});

// Guardados: cada cambio se refleja en la cuenta.
startListening({
  matcher: isAnyOf(toggleSaved, removeSaved),
  effect: (action, { dispatch, getState }) => {
    const state = getState();
    if (state.session.status !== 'authenticated') return;
    const id = toggleSaved.match(action) ? action.payload.id : removeSaved.match(action) ? action.payload : null;
    if (!id) return;
    const item = state.saved.items.find((p) => p.id === id);
    if (item) void dispatch(api.endpoints.putSaved.initiate(item, { track: false }));
    else void dispatch(api.endpoints.deleteSaved.initiate(id, { track: false }));
  },
});

// Preferencias: se agrupan los cambios seguidos (800 ms) en una sola petición.
startListening({
  matcher: isAnyOf(setCity, setCriterion, setThemeMode, setHaptics),
  effect: async (_action, { dispatch, getState, cancelActiveListeners, delay }) => {
    if (getState().session.status !== 'authenticated') return;
    cancelActiveListeners();
    await delay(800);
    void dispatch(api.endpoints.putPreferences.initiate(accountPrefs(getState().preferences), { track: false }));
  },
});

// Borrar historial: también en el servidor (con o sin cuenta).
startListening({
  actionCreator: clearHistory,
  effect: (_action, { dispatch }) => {
    void dispatch(api.endpoints.clearRemoteHistory.initiate(undefined, { track: false }));
  },
});

/** Al arrancar la app (después de rehidratar Redux): restaurar la sesión guardada, si hay. */
export async function bootstrapSession(dispatch: SyncDispatch): Promise<void> {
  const stored = await loadSession();
  dispatch(stored ? sessionRestored(stored) : becameGuest());
}
