import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * Versión de los términos de uso (exención de responsabilidad y aviso de edad).
 * Si el texto de `app/terms.tsx` cambia de forma importante, se sube este número
 * y la bienvenida vuelve a pedir la aceptación a todos.
 */
export const TERMS_VERSION = 1;

export interface OnboardingState {
  /** Versión de los términos aceptada en este dispositivo (0 = nunca). */
  termsVersion: number;
  /** Fecha ISO de la aceptación. */
  acceptedAt: string | null;
}

const initialState: OnboardingState = { termsVersion: 0, acceptedAt: null };

const onboardingSlice = createSlice({
  name: 'onboarding',
  initialState,
  reducers: {
    /** Se completó la bienvenida: la persona confirmó la edad y aceptó los términos. */
    termsAccepted(state, action: PayloadAction<{ version: number; at: string }>) {
      state.termsVersion = action.payload.version;
      state.acceptedAt = action.payload.at;
    },
  },
});

export const { termsAccepted } = onboardingSlice.actions;
export default onboardingSlice.reducer;
