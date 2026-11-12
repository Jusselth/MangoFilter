import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { AccountUser } from '../api/types';

/**
 * Dónde vive la sesión en el dispositivo:
 *  - Celular: expo-secure-store (Keychain en iOS, Keystore cifrado en Android).
 *  - Web: localStorage (no existe almacenamiento seguro equivalente en el navegador).
 * Nunca en AsyncStorage/redux-persist, que guardan en texto plano.
 */
const SESSION_KEY = 'mangofilter.session';
const DEVICE_KEY = 'mangofilter-device-id';

export interface StoredSession {
  token: string;
  user: AccountUser;
}

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const raw = Platform.OS === 'web' ? globalThis.localStorage?.getItem(SESSION_KEY) : await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    return parsed?.token && parsed.user?.email ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveSession(session: StoredSession): Promise<void> {
  const raw = JSON.stringify(session);
  if (Platform.OS === 'web') globalThis.localStorage?.setItem(SESSION_KEY, raw);
  else await SecureStore.setItemAsync(SESSION_KEY, raw);
}

export async function clearSession(): Promise<void> {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.removeItem(SESSION_KEY);
    else await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch {
    // Nada que borrar.
  }
}

let deviceId: Promise<string> | null = null;

/**
 * Identificador ANÓNIMO del dispositivo (UUID aleatorio, no deriva de ningún
 * dato del teléfono). Permite contar búsquedas y vistas de invitados sin saber
 * quiénes son; el backend solo guarda un seudónimo de él.
 */
export function getDeviceId(): Promise<string> {
  deviceId ??= (async () => {
    try {
      const existing = await AsyncStorage.getItem(DEVICE_KEY);
      if (existing) return existing;
    } catch {
      // Se genera uno nuevo.
    }
    const id = Crypto.randomUUID();
    await AsyncStorage.setItem(DEVICE_KEY, id).catch(() => undefined);
    return id;
  })();
  return deviceId;
}
