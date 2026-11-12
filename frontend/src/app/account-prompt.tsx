import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, GradientButton, IconTile, Tag, TextButton, type IconName } from '../components/ui';
import type { AccountPromptReason } from '../hooks/useAccountPrompt';
import { useTheme } from '../theme/ThemeContext';

const BENEFITS: { icon: IconName; text: string }[] = [
  { icon: 'sync-outline', text: 'Tus guardados sincronizados en todos tus dispositivos.' },
  { icon: 'options-outline', text: 'Tu ciudad y tus preferencias se recargan solas al entrar.' },
  { icon: 'sparkles-outline', text: 'Recomendaciones según lo que buscas, ves y guardas.' },
  { icon: 'phone-portrait-outline', text: 'Si cambias de celular o borras la app, no pierdes nada.' },
];

/**
 * Invitación a crear cuenta, como diálogo sobre la pantalla actual.
 * La abre `useAccountPrompt` (máximo una vez por apertura de la app):
 *  - reason=welcome: al terminar la bienvenida.
 *  - reason=save:    al guardar el primer producto (el producto YA quedó guardado en el dispositivo).
 */
export default function AccountPromptScreen() {
  const { reason = 'welcome' } = useLocalSearchParams<{ reason?: AccountPromptReason }>();
  const { colors, radius, spacing, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const fromSave = reason === 'save';

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View style={styles.root}>
      <Animated.View entering={FadeIn.duration(180)} style={StyleSheet.absoluteFill}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Cerrar, ahora no"
        />
      </Animated.View>

      <Animated.View
        entering={SlideInDown.springify().damping(18).reduceMotion(ReduceMotion.System)}
        accessibilityViewIsModal
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingBottom: insets.bottom + spacing.lg,
          },
          shadow(3),
        ]}
      >
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} bounces={false}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {fromSave ? <Tag icon="heart" tone="leaf" label="Producto guardado en este dispositivo" /> : null}

          <View style={styles.head}>
            <IconTile icon={fromSave ? 'cloud-upload-outline' : 'person-add-outline'} size={52} />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="title" accessibilityRole="header">
                {fromSave ? 'No pierdas tus guardados' : 'Crea tu cuenta gratis'}
              </AppText>
            </View>
          </View>

          <AppText tone="muted" style={{ lineHeight: 22 }}>
            {fromSave
              ? 'Por ahora lo que guardas vive solo en este celular. Con una cuenta se sincroniza y lo encuentras en cualquier dispositivo.'
              : 'Es opcional, pero muy útil: con una cuenta tus guardados y preferencias quedan sincronizados.'}
          </AppText>

          <View style={{ gap: 10 }}>
            {BENEFITS.map((b) => (
              <View key={b.text} style={styles.benefit}>
                <View style={[styles.benefitIcon, { backgroundColor: colors.brandSoft }]}>
                  <Ionicons name={b.icon} size={16} color={colors.brandStrong} />
                </View>
                <AppText variant="caption" style={{ flex: 1 }}>
                  {b.text}
                </AppText>
              </View>
            ))}
          </View>

          <View style={[styles.note, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md }]}>
            <Ionicons name="key-outline" size={16} color={colors.textMuted} />
            <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
              Sin contraseña: te enviamos un código a tu correo. Lo que ya guardaste en este celular se suma a tu cuenta.
            </AppText>
          </View>

          <GradientButton
            label="Crear cuenta o entrar"
            icon="mail-outline"
            onPress={() => router.replace('/login')}
            accessibilityHint="Abre el inicio de sesión con tu correo"
          />
          <View style={{ alignItems: 'center' }}>
            <TextButton label="Ahora no" tone="muted" onPress={close} />
            <AppText variant="caption" tone="muted" style={{ textAlign: 'center' }}>
              Puedes crearla cuando quieras en Ajustes → Cuenta.
            </AppText>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '92%', width: '100%', maxWidth: 560, alignSelf: 'center' },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  benefitIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  note: { flexDirection: 'row', gap: 8, padding: 12, alignItems: 'flex-start' },
});
