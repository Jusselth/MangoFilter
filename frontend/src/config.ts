import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * URL del backend. Orden de prioridad:
 * 1. `EXPO_PUBLIC_API_URL` (frontend/.env) — p. ej. un servidor desplegado.
 * 2. En desarrollo, la misma IP desde la que Expo sirve la app (puerto 3000):
 *    así el celular con Expo Go encuentra el backend en la red local sin
 *    configurar nada.
 * 3. localhost (web / emulador iOS).
 */
function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  const hostUri = Constants.expoConfig?.hostUri; // "192.168.1.20:8081"
  const host = hostUri?.split(':')[0];
  if (host && Platform.OS !== 'web') return `http://${host}:3000`;

  if (Platform.OS === 'web' && typeof window !== 'undefined') return `http://${window.location.hostname}:3000`;
  return 'http://localhost:3000';
}

export const API_URL = resolveApiUrl();
