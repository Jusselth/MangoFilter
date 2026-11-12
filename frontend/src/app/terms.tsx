import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Card, TextButton } from '../components/ui';
import { TERMS_SUMMARY } from '../legal';
import { useAppSelector } from '../store';
import { useTheme } from '../theme/ThemeContext';

/**
 * Términos de uso y exención de responsabilidad.
 * Debe mantenerse fiel a lo que la app realmente hace. Si se cambia algo
 * importante, hay que subir TERMS_VERSION en store/slices/onboardingSlice.ts
 * para que la bienvenida vuelva a pedir la aceptación.
 */
const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: '1. Qué es MangoFilter (y qué no es)',
    body: [
      'MangoFilter es un proyecto académico de Ingeniería Informática de la Universidad de La Sabana. Es una herramienta gratuita que consulta en vivo las tiendas en línea y te ayuda a comparar y filtrar sus ofertas según el precio, el envío a tu ciudad y el tiempo de entrega.',
      'MangoFilter NO es una tienda: no vende productos, no recibe pagos, no guarda datos de tarjetas, no gestiona pedidos ni envíos y no actúa como intermediario ni representante de ninguna tienda.',
      'MangoFilter no cobra comisiones a las tiendas ni recibe pagos por mostrar o destacar una oferta. La "Mejor opción" se calcula solo con el criterio que eliges (menor precio, equilibrado o llega antes).',
    ],
  },
  {
    title: '2. Las compras son entre tú y la tienda',
    body: [
      'Al tocar "Ver en {tienda}" sales de MangoFilter y entras al sitio de esa tienda. Si decides comprar, la compraventa es únicamente entre tú y la tienda (o el vendedor que la tienda indique).',
      'El pago, la factura, el despacho, la garantía, los cambios, las devoluciones, el derecho de retracto y cualquier reclamo se tramitan directamente con la tienda, según sus propios términos y el Estatuto del Consumidor (Ley 1480 de 2011).',
      'MangoFilter no se hace responsable de las compras que realices, ni de la calidad, el estado, la entrega o la garantía de los productos, ni de los cobros que haga la tienda.',
    ],
  },
  {
    title: '3. Precios, envíos e información',
    body: [
      'Los precios, costos de envío, días de entrega, fotos y descripciones vienen de las tiendas en el momento de la consulta. Pueden cambiar en cualquier momento, tener errores o no coincidir con lo que la tienda muestre al pagar.',
      'El envío y los días de entrega son una cotización de la tienda para tu ciudad, no un compromiso de MangoFilter. Las fechas reales dependen de la tienda y de la transportadora.',
      'La agrupación de "el mismo producto" entre tiendas es automática y puede equivocarse. Antes de comprar, revisa en la tienda que el modelo, la referencia, el color y la capacidad sean los que quieres.',
      'Por eso, el precio y las condiciones que valen son siempre los que muestre la tienda al finalizar la compra.',
    ],
  },
  {
    title: '4. Edad',
    body: [
      'MangoFilter está dirigida a personas mayores de 18 años, que es la mayoría de edad en Colombia.',
      'Si eres menor de edad, solo debes usar la app con la supervisión y autorización de tu padre, madre o acudiente, y no debes comprar en las tiendas sin su permiso. No crees una cuenta si eres menor de edad.',
      'Si eres padre, madre o acudiente y crees que un menor creó una cuenta, escríbenos para eliminarla (ver la sección 7).',
    ],
  },
  {
    title: '5. Enlaces y marcas de terceros',
    body: [
      'Los sitios de las tiendas son de terceros. MangoFilter no controla su contenido, su seguridad ni sus políticas de privacidad, y no responde por ellos.',
      'Los nombres, marcas y fotos de productos y tiendas pertenecen a sus dueños y se muestran solo para identificar las ofertas. MangoFilter no está afiliado ni patrocinado por ninguna de las tiendas.',
    ],
  },
  {
    title: '6. Limitación de responsabilidad',
    body: [
      'La app se ofrece "tal como está", de forma gratuita y con fines académicos. Puede tener fallas, no estar disponible o no mostrar todas las tiendas u ofertas que existen.',
      'En la medida que lo permita la ley, MangoFilter y sus desarrolladores no son responsables por decisiones de compra tomadas con base en la información de la app, ni por pérdidas o daños derivados de las compras hechas en las tiendas.',
    ],
  },
  {
    title: '7. Datos personales y contacto',
    body: [
      'El tratamiento de tus datos se explica en el aviso de privacidad. Para cualquier solicitud, responde al correo desde el que te llegan los códigos de MangoFilter.',
    ],
  },
];

export default function TermsScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const acceptedAt = useAppSelector((s) => s.onboarding.acceptedAt);

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }}>
      <AppText tone="muted">Última actualización: 12 de noviembre de 2026.</AppText>

      <Card elevated={0} style={{ padding: 16, gap: 10, backgroundColor: colors.surfaceAlt, borderRadius: radius.lg }}>
        <AppText variant="heading" accessibilityRole="header">
          En resumen
        </AppText>
        {TERMS_SUMMARY.map((line) => (
          <View key={line} style={styles.bullet}>
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.brandStrong} style={{ marginTop: 2 }} />
            <AppText style={{ flex: 1, lineHeight: 22 }}>{line}</AppText>
          </View>
        ))}
      </Card>

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

      <TextButton icon="shield-checkmark-outline" label="Leer el aviso de privacidad" onPress={() => router.push('/privacy')} />

      {acceptedAt ? (
        <AppText variant="caption" tone="muted">
          Aceptaste estos términos en este dispositivo el{' '}
          {new Date(acceptedAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}.
        </AppText>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bullet: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
});
