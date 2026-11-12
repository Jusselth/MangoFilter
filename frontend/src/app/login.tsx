import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, GradientButton, IconTile, TextButton } from '../components/ui';
import { useHaptics } from '../hooks/useHaptics';
import { useAppDispatch } from '../store';
import { describeApiError, useRequestCodeMutation, useVerifyCodeMutation } from '../store/api';
import { signedIn } from '../store/slices/sessionSlice';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/palette';

const RESEND_SECONDS = 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Entrar o crear cuenta SIN contraseña: correo → código de 6 dígitos que
 * llega por correo → listo. La primera vez se crea la cuenta (con aceptación
 * del aviso de privacidad). Los guardados y preferencias de este dispositivo
 * se suben a la cuenta automáticamente.
 */
export default function LoginScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const haptic = useHaptics();
  const [requestCode, codeState] = useRequestCodeMutation();
  const [verifyCode, verifyState] = useVerifyCodeMutation();

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const validEmail = EMAIL_RE.test(email.trim());

  const sendCode = async () => {
    setError(null);
    if (!validEmail) return setError('Escribe un correo electrónico válido.');
    if (!accepted) return setError('Para continuar debes aceptar el aviso de privacidad.');
    try {
      await requestCode({ email: email.trim() }).unwrap();
      setStep('code');
      setCode('');
      setResendIn(RESEND_SECONDS);
    } catch (e) {
      setError(describeApiError(e));
    }
  };

  const submitCode = async (value = code) => {
    setError(null);
    if (value.length !== 6) return setError('El código tiene 6 dígitos.');
    try {
      const res = await verifyCode({ email: email.trim(), code: value, acceptPrivacy: accepted }).unwrap();
      haptic('success');
      dispatch(signedIn({ token: res.token, user: res.user }));
      if (router.canGoBack()) router.back();
      else router.replace('/settings');
    } catch (e) {
      setError(describeApiError(e));
      setCode('');
    }
  };

  const onCodeChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length === 6) void submitCode(digits);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: 'center', gap: spacing.sm, marginTop: spacing.md }}>
          <IconTile icon={step === 'email' ? 'mail-outline' : 'keypad-outline'} />
          <AppText variant="title" accessibilityRole="header" style={{ textAlign: 'center' }}>
            {step === 'email' ? 'Entra con tu correo' : 'Revisa tu correo'}
          </AppText>
          <AppText tone="muted" style={{ textAlign: 'center' }}>
            {step === 'email'
              ? 'Te enviamos un código de 6 dígitos. Sin contraseñas. Si es tu primera vez, creamos tu cuenta.'
              : `Escribe el código que enviamos a ${email.trim().toLowerCase()}. Vence en 10 minutos. Si no lo ves, revisa la carpeta de spam.`}
          </AppText>
        </View>

        {step === 'email' ? (
          <>
            <TextInput
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={sendCode}
              placeholder="tucorreo@ejemplo.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="send"
              autoFocus
              accessibilityLabel="Correo electrónico"
              maxFontSizeMultiplier={1.6}
              style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.md, color: colors.text }]}
            />

            <View style={styles.consentRow}>
              <Pressable
                onPress={() => setAccepted((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: accepted }}
                accessibilityLabel="Acepto el aviso de privacidad y el tratamiento de mis datos"
                hitSlop={6}
                style={styles.checkbox}
              >
                <Ionicons name={accepted ? 'checkbox' : 'square-outline'} size={24} color={accepted ? colors.brandStrong : colors.textMuted} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <AppText variant="caption">
                  Acepto el aviso de privacidad y el tratamiento de mis datos (correo, guardados, preferencias y búsquedas) según la Ley 1581 de
                  2012.
                </AppText>
                <TextButton label="Leer el aviso de privacidad" onPress={() => router.push('/privacy')} />
              </View>
            </View>
          </>
        ) : (
          <>
            <TextInput
              autoFocus
              value={code}
              onChangeText={onCodeChange}
              placeholder="000000"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={6}
              accessibilityLabel="Código de 6 dígitos"
              maxFontSizeMultiplier={1.4}
              style={[
                styles.input,
                styles.codeInput,
                { borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.md, color: colors.text },
              ]}
            />
            <View style={styles.row}>
              <TextButton icon="arrow-back" label="Cambiar correo" onPress={() => setStep('email')} />
              <TextButton
                icon="refresh"
                label={resendIn > 0 ? `Reenviar en ${resendIn} s` : 'Reenviar código'}
                onPress={() => (resendIn > 0 ? undefined : void sendCode())}
              />
            </View>
          </>
        )}

        {error ? (
          <View accessibilityLiveRegion="assertive" style={[styles.error, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md }]}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <AppText variant="caption" tone="danger" style={{ flex: 1 }}>
              {error}
            </AppText>
          </View>
        ) : null}

        <GradientButton
          label={step === 'email' ? 'Enviar código' : 'Entrar'}
          icon={step === 'email' ? 'send-outline' : 'log-in-outline'}
          loading={codeState.isLoading || verifyState.isLoading}
          onPress={() => (step === 'email' ? void sendCode() : void submitCode())}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 52, borderWidth: 1, paddingHorizontal: 16, fontFamily: fonts.regular, fontSize: 16 },
  codeInput: { fontFamily: fonts.bold, fontSize: 28, letterSpacing: 10, textAlign: 'center', minHeight: 64 },
  consentRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  checkbox: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: -10, marginLeft: -10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
  error: { flexDirection: 'row', gap: 8, padding: 12, alignItems: 'flex-start' },
});
