import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../components/ui';
import { useTheme } from '../theme/ThemeContext';

/**
 * Aviso de privacidad (Ley 1581 de 2012 y Decreto 1377 de 2013, Colombia).
 * Debe mantenerse fiel a lo que el código realmente hace: si cambia qué datos
 * se guardan o por cuánto tiempo, hay que actualizar este texto.
 */
const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'Quién es el responsable',
    body: [
      'MangoFilter es un proyecto académico de Ingeniería Informática de la Universidad de La Sabana, desarrollado por Jusselth Chica, Juan Mora y Santiago Álvarez, quienes son responsables del tratamiento de los datos.',
      'Para cualquier solicitud sobre tus datos, responde al correo desde el que te llegan los códigos de MangoFilter.',
    ],
  },
  {
    title: 'Qué datos guardamos',
    body: [
      'Si creas una cuenta: tu correo electrónico, la fecha en que aceptaste este aviso, tus productos guardados y tus preferencias (ciudad, criterio de comparación, tema y vibración).',
      'Con o sin cuenta: las búsquedas que haces (texto y ciudad) y los enlaces de tiendas que abres desde la app. Sin cuenta, se asocian a un identificador aleatorio del dispositivo que no revela quién eres.',
      'No pedimos contraseñas, nombre, teléfono, ubicación GPS ni datos de pago.',
    ],
  },
  {
    title: 'Menores de edad',
    body: [
      'MangoFilter está dirigida a mayores de 18 años y no recoge a sabiendas datos de menores de edad. Los menores solo deben usar la app con la supervisión de su padre, madre o acudiente, y no deben crear una cuenta.',
      'Si eres padre, madre o acudiente y crees que un menor creó una cuenta, escríbenos y la eliminaremos junto con sus datos.',
    ],
  },
  {
    title: 'Para qué los usamos',
    body: [
      'Para que tus guardados y preferencias se conserven y se recarguen cuando inicias sesión en cualquier dispositivo.',
      'Para mostrarte recomendaciones basadas en tus propias búsquedas, vistas y guardados.',
      'Para calcular estadísticas anónimas y agregadas: lo más buscado por ciudad (solo búsquedas hechas por varias personas) y las tiendas más visitadas. Nadie puede ver qué buscaste tú.',
      'No vendemos ni compartimos tus datos con las tiendas ni con terceros para publicidad.',
    ],
  },
  {
    title: 'Dónde se guardan y por cuánto tiempo',
    body: [
      'En una base de datos de Supabase (proveedor en la nube que puede almacenar los datos fuera de Colombia). Los correos con códigos se envían a través de Gmail (Google).',
      'Los códigos de verificación se guardan cifrados (nunca en texto plano) y se borran al día siguiente. Las sesiones vencen tras 60 días sin uso.',
      'Las búsquedas y visitas se conservan como máximo 12 meses.',
    ],
  },
  {
    title: 'Tus derechos',
    body: [
      'Puedes conocer, actualizar, rectificar y suprimir tus datos, y revocar esta autorización en cualquier momento.',
      'Desde Ajustes puedes borrar tu historial (tus búsquedas y visitas dejan de estar ligadas a ti; solo quedan en los conteos anónimos) y eliminar tu cuenta, lo que borra tu correo, guardados, preferencias y sesiones.',
      'También puedes presentar quejas ante la Superintendencia de Industria y Comercio (SIC).',
    ],
  },
];

export default function PrivacyScreen() {
  const { spacing } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }}>
      <AppText tone="muted">Última actualización: 12 de noviembre de 2026.</AppText>
      {SECTIONS.map((s) => (
        <View key={s.title} style={{ gap: spacing.xs }}>
          <AppText variant="heading" accessibilityRole="header">
            {s.title}
          </AppText>
          {s.body.map((p) => (
            <AppText key={p} style={{ lineHeight: 23 }}>
              {p}
            </AppText>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
