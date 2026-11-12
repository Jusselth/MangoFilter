import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAppDispatch, useAppSelector } from '../store';
import { api, describeApiError, useGetHealthQuery } from '../store/api';
import { signedOut } from '../store/slices/sessionSlice';
import { useTheme } from '../theme/ThemeContext';
import { AppText, Card, GradientButton, SectionTitle, Skeleton, TextButton } from './ui';

/** Ajustes → Cuenta: entrar, cerrar sesión o eliminar la cuenta. */
export function AccountSection() {
  const { colors, spacing } = useTheme();
  const dispatch = useAppDispatch();
  const session = useAppSelector((s) => s.session);
  const health = useGetHealthQuery();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logout = async () => {
    setBusy(true);
    // Se invalida la sesión en el servidor; si no hay conexión, igual se cierra en el dispositivo.
    await dispatch(api.endpoints.logout.initiate(undefined, { track: false })).catch(() => undefined);
    dispatch(signedOut());
    setBusy(false);
  };

  const deleteAccount = async () => {
    setBusy(true);
    setError(null);
    const result = await dispatch(api.endpoints.deleteAccount.initiate(undefined, { track: false }));
    setBusy(false);
    if ('error' in result && result.error) return setError(describeApiError(result.error));
    setConfirmDelete(false);
    dispatch(signedOut());
  };

  let content: React.ReactNode;
  if (session.status === 'loading') {
    content = <Skeleton height={72} />;
  } else if (session.status === 'authenticated' && session.user) {
    content = (
      <Card style={styles.card}>
        <View style={styles.row}>
          <Ionicons name="person-circle-outline" size={36} color={colors.brandStrong} />
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {session.user.email}
            </AppText>
            <AppText variant="caption" tone="muted">
              Tus guardados y preferencias se guardan en tu cuenta y se recargan al iniciar sesión.
            </AppText>
          </View>
        </View>
        {confirmDelete ? (
          <View style={{ gap: spacing.sm }} accessibilityLiveRegion="polite">
            <AppText variant="caption" tone="danger">
              ¿Eliminar tu cuenta? Se borran tu correo, guardados, preferencias y sesiones. No se puede deshacer.
            </AppText>
            <View style={styles.actions}>
              <TextButton label="Cancelar" onPress={() => setConfirmDelete(false)} />
              <TextButton icon="trash-outline" tone="danger" label={busy ? 'Eliminando…' : 'Sí, eliminar mi cuenta'} onPress={() => void deleteAccount()} />
            </View>
          </View>
        ) : (
          <View style={styles.actions}>
            <TextButton icon="log-out-outline" label={busy ? 'Cerrando…' : 'Cerrar sesión'} onPress={() => void logout()} />
            <TextButton icon="trash-outline" tone="danger" label="Eliminar cuenta" onPress={() => setConfirmDelete(true)} />
          </View>
        )}
        {error ? (
          <AppText variant="caption" tone="danger">
            {error}
          </AppText>
        ) : null}
      </Card>
    );
  } else if (health.data && !health.data.features.accounts) {
    content = (
      <AppText variant="caption" tone="muted">
        Las cuentas no están disponibles en este servidor. Tus datos se guardan solo en este dispositivo.
      </AppText>
    );
  } else {
    content = (
      <Card style={styles.card}>
        <AppText variant="bodyStrong">Guarda tus productos en tu cuenta</AppText>
        <AppText variant="caption" tone="muted">
          Ahora tus guardados y preferencias están solo en este dispositivo. Con una cuenta (solo tu correo, sin contraseña) los recuperas al
          iniciar sesión en cualquier celular.
        </AppText>
        <GradientButton label="Entrar o crear cuenta" icon="mail-outline" onPress={() => router.push('/login')} />
      </Card>
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <SectionTitle title="Cuenta" />
      {content}
      <TextButton icon="shield-checkmark-outline" label="Aviso de privacidad" onPress={() => router.push('/privacy')} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
});
