import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

import { persistor, store } from '../store';
import { bootstrapSession } from '../store/accountSync';
import { ThemeProvider, useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/palette';

void SplashScreen.preventAutoHideAsync();

/**
 * Raíz de la app. Orden de proveedores:
 * Redux (estado global) → PersistGate (rehidrata preferencias/guardados)
 * → ThemeProvider (React Context, depende de Redux) → navegación.
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const ready = fontsLoaded || !!fontError;

  if (!ready) return null;

  return (
    <Provider store={store}>
      <PersistGate
        persistor={persistor}
        onBeforeLift={async () => {
          // Primero se rehidratan los datos del dispositivo; luego se restaura la sesión de la cuenta.
          await bootstrapSession(store.dispatch);
          await SplashScreen.hideAsync();
        }}
      >
        <ThemeProvider>
          <RootStack />
        </ThemeProvider>
      </PersistGate>
    </Provider>
  );
}

function RootStack() {
  const { colors, isDark } = useTheme();

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.text },
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="search" options={{ headerShown: false }} />
        <Stack.Screen name="product/[id]" options={{ title: '' }} />
        <Stack.Screen name="filters" options={{ presentation: 'modal', title: 'Filtros' }} />
        <Stack.Screen name="city" options={{ presentation: 'modal', title: 'Ciudad de entrega' }} />
        <Stack.Screen name="login" options={{ presentation: 'modal', title: 'Tu cuenta' }} />
        <Stack.Screen name="privacy" options={{ title: 'Aviso de privacidad' }} />
      </Stack>
    </>
  );
}
