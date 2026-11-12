import { router } from 'expo-router';
import { useCallback } from 'react';

import { useAppDispatch, useAppSelector } from '../store';
import { useGetHealthQuery } from '../store/api';
import { accountPromptDisplayed } from '../store/slices/sessionSlice';

export type AccountPromptReason = 'welcome' | 'save';

/**
 * Invitación a crear cuenta (pantalla `account-prompt`). Se muestra como mucho
 * UNA vez por apertura de la app, y solo si:
 *  - la persona no tiene sesión iniciada (es invitada), y
 *  - el backend tiene las cuentas activas (`/api/health` → features.accounts).
 *    Sin base de datos o sin conexión no se invita a algo que no funcionaría.
 *
 * Devuelve `true` si la abrió.
 */
export function useAccountPrompt() {
  const dispatch = useAppDispatch();
  const status = useAppSelector((s) => s.session.status);
  const alreadyShown = useAppSelector((s) => s.session.accountPromptShown);
  const health = useGetHealthQuery();
  const accountsEnabled = health.data?.features.accounts === true;

  return useCallback(
    (reason: AccountPromptReason): boolean => {
      if (status !== 'guest' || alreadyShown || !accountsEnabled) return false;
      dispatch(accountPromptDisplayed());
      router.push({ pathname: '/account-prompt', params: { reason } });
      return true;
    },
    [status, alreadyShown, accountsEnabled, dispatch],
  );
}
