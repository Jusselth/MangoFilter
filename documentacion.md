# Documentación — MangoFilter

Agregador y comparador de productos y servicios de varias tiendas online. En lugar de depender de una sola tienda, MangoFilter reúne las opciones y muestra cuál es la mejor compra según el **costo total (precio + envío a tu ciudad)** y el **tiempo de entrega**.

- Propuesta técnica original: [propuesta_t_cnica_mangofilter.md](propuesta_t_cnica_mangofilter.md)
- Arquitectura detallada: [arquitectura.md](arquitectura.md)

> Este archivo se actualiza con cada cambio. Las entradas nuevas van arriba en el **Registro de cambios**.

---

## Cómo ejecutar

Requisitos: Node 20 o superior y la app **Expo Go** (o un emulador) para probar en el celular.

```bash
npm install
npm start            # abre Expo; escanea el QR con Expo Go
npm run web          # versión web en el navegador
npm run android      # emulador Android
npm test             # pruebas unitarias (Jest)
npm run typecheck    # TypeScript estricto
npm run lint         # ESLint
```

> **Importante (OneDrive):** el proyecto está dentro de una carpeta sincronizada con OneDrive y Metro **no detecta los cambios de archivos** en esa ubicación. Si editas código y no ves el cambio, reinicia con `npx expo start --clear`. Lo recomendable es mover el proyecto fuera de OneDrive (por ejemplo, `C:\dev\MangoFilter`).

---

## Funcionalidades (v0.1)

### Productos
- **Búsqueda federada** en 5 tiendas en paralelo (Mercado Libre, Falabella, AliExpress, Homecenter, Alkosto). Tolera tildes, errores de tipeo y términos en inglés (por ejemplo, "audífonos" encuentra "headphones").
- **Agrupación automática del mismo producto** entre tiendas (Entity Resolution con Jaro‑Winkler y códigos de modelo). No mezcla variantes como XM4/XM5 o 128/256 GB.
- **Costo total real** = precio + envío según la ciudad y la política de cada tienda (envío gratis desde cierto monto, recargos por artículos voluminosos, zonas remotas).
- **Tres criterios de orden:** Menor precio, Equilibrado y Llega antes.
- **Filtros:** presupuesto máximo, tiempo de entrega, solo envío gratis, tiendas y categorías. Se aplican al instante sin volver a consultar.
- **Comparación detallada:** desglose de precio y envío, precio anterior tachado, días hábiles, notas (por ejemplo, impuestos de importación) y enlace a la tienda.
- **Resiliencia:** si una tienda falla o tarda más de 3 s, se muestran las demás y se avisa cuál no respondió.

### Servicios
- Catálogo de streaming, música, conectividad y hogar.
- Comparación de integradores por **precio mensual** o por **más valor** (costo neto = precio menos el valor de los servicios incluidos en el paquete), con la permanencia mínima visible.

### Personal
- **Guardados** con seguimiento de precio: "Bajó $X", "Subió $X" o "Sin cambios" desde que lo guardaste.
- **Historial** de búsquedas recientes.
- **Ajustes:** ciudad de entrega, criterio por defecto, tema (sistema, claro u oscuro), vibración y vaciar caché.

---

## Stack técnico

| Área | Elección | Motivo |
|---|---|---|
| Framework | Expo SDK 58, React Native 0.88, React 19, TypeScript estricto | Base del curso y versión actual de Expo |
| Navegación | Expo Router (sobre React Navigation: Native Stack + Bottom Tabs) | Rutas tipadas y deep links (`mangofilter://`) sin configuración extra |
| Estado global | **Redux Toolkit** + `react-redux` | Pedido explícito: Redux y Context en lugar de Zustand |
| Estado de servidor | **RTK Query** (parte de Redux Toolkit) | Caché, deduplicación y estados de carga sin otra librería (reemplaza a TanStack Query) |
| Persistencia | `redux-persist` + AsyncStorage | Preferencias, guardados e historial sobreviven al cierre de la app |
| Tema | **React Context** (`ThemeProvider` / `useTheme`) | Modo claro/oscuro/sistema, degradados y sombras |
| UI | `expo-linear-gradient`, `@expo/vector-icons`, Inter (`@expo-google-fonts/inter`) | Degradados mango, íconos y tipografía legible |
| Animación | Reanimated 4 | Entradas suaves y skeletons que respetan "reducir movimiento" |
| Pruebas | Jest + jest-expo | Pruebas del dominio y del agregador |

---

## Decisiones y cambios respecto a la propuesta

La propuesta es la guía. Estos son los ajustes hechos sin cambiar el objetivo de la app:

1. **El backend federado corre en la app con datos de demostración.** El API Gateway en Go, Redis y los adaptadores reales necesitan infraestructura y acuerdos con las tiendas. Se implementó la misma arquitectura (adaptadores → normalización → matching → caché → ranking) en TypeScript dentro de la app, separada por contratos (`StoreAdapter`, RTK Query) para migrarla al servidor sin tocar las pantallas.
2. **Precios y tiendas de demostración.** Los productos y sus precios son simulados. Cada adaptador devuelve un formato "crudo" distinto (texto con miles, USD, porcentaje de descuento…) para ejercitar de verdad la normalización. Los enlaces abren la búsqueda del producto en cada tienda. La app lo indica en Inicio, en el detalle y en Ajustes.
3. **Integradores de servicios ficticios** (FibraNet Hogar, MóvilPlus, PagoYa Prime, ConectaCasa, HogarYa), para no atribuir alianzas falsas a empresas reales.
4. **Embeddings reemplazados por huellas de modelo y códigos de fabricante** en el matching. Son deterministas, ligeros en el dispositivo y muy precisos en este dominio. Ver arquitectura §6.
5. **Criterio "Equilibrado" con w = 0.5** (en lugar de 0.6). Las pruebas mostraron que con 0.6 seguía ganando la opción más barata aunque tardara 14 días.
6. **Sin sliders de arrastre en filtros** (propuesta §4.3): todo se controla con chips y un campo numérico.
7. **Accesibilidad:** se cumple lo aplicable a una app móvil de la sección 4 (lectores de pantalla, texto al 200 %, no depender solo del color, 44 pt, modo oscuro, sin patrones oscuros). Los filtros de color para daltonismo y WebVTT quedan pendientes; la app no tiene audio.

---

## Registro de cambios

### v0.1.0 — 2026‑11‑11 · Base funcional
**Proyecto**
- Proyecto Expo SDK 58 con TypeScript, Expo Router (`src/app`), esquema `mangofilter`, rutas tipadas y splash claro/oscuro.
- Scripts `test`, `typecheck` y `lint`. ESLint con `eslint-config-expo`. Jest con `jest-expo`.

**Dominio (`src/domain`)**
- Esquema canónico `Offer` / `ProductGroup` / `RankedGroup` y tipos de servicios.
- `jaroWinkler.ts`: similitud Jaro y Jaro‑Winkler.
- `normalize.ts`: limpieza de texto, unidades, códigos de modelo, alias, detección de marca, huella de modelo, búsqueda con sinónimos y tolerancia a errores de tipeo.
- `matching.ts`: Entity Resolution con reglas duras, código de fabricante compartido, clustering por enlace promedio y elección del nombre del grupo.
- `logistics.ts`: 8 ciudades en 3 zonas, políticas de envío de 5 tiendas y tasa USD→COP.
- `ranking.ts`: costo total, puntaje multicriterio, filtros, orden de grupos y costo neto de servicios.

**Datos (`src/data`)**
- 5 adaptadores de tienda con formatos crudos distintos y latencia simulada cancelable.
- Agregador federado: consulta en paralelo, timeout de 3 s, tolerancia a fallos parciales y estado por tienda.
- Caché L1 con TTL por tienda y límite LRU. Guarda la respuesta cruda para recalcular el envío al cambiar de ciudad.
- Catálogo de 25 productos (con señuelos) y 9 servicios con 24 planes.

**Estado (`src/store`)**
- RTK Query: `searchProducts`, `listServices`, `getServiceOffers`.
- Slices `preferences`, `filters`, `saved` e `history`, persistidos (salvo los filtros) con redux-persist.
- Hook `useRankedSearch`, que combina estado de servidor y de cliente.

**UI**
- Tema mango claro/oscuro con React Context, degradados, sombras cálidas y tipografía Inter.
- Pantallas: Inicio, Resultados, Comparación de producto, Filtros (modal), Ciudad (modal), Servicios, Detalle de servicio, Guardados y Ajustes.
- Componentes: `AppText`, `Card`, `PressableCard`, `GradientButton`, `TextButton`, `IconButton`, `Chip`, `SegmentedControl`, `Tag`, `StoreBadge`, `IconTile`, `Skeleton`, `EmptyState`, `SearchBar`, `ProductCard`, `OfferCard`, `CityList` y `TabScreen`.

**Verificación**
- 19 pruebas en verde. Typecheck y lint limpios. `expo-doctor` 20/20. El bundle de Android compila.
- Recorrido completo en el navegador (Chrome sin interfaz, viewport móvil) en modo claro y oscuro: inicio → búsqueda → detalle → guardar → filtros → servicios → guardados → ajustes, **sin errores de consola**.

**Correcciones durante la verificación**
- Matching: "139 cm" y "2 baterías" impedían agrupar el mismo TV y el mismo taladro → se agregó la regla del código de fabricante compartido.
- Agregador: un timeout se reportaba como "error" porque la cancelación ganaba la carrera → ahora se rechaza primero con `TimeoutError`.
- Web: el campo de búsqueda empujaba el botón "borrar" encima del botón de filtros → `minWidth: 0` en el input.
- Guardados: había un botón dentro de otro (HTML inválido en web y botón inaccesible con lector de pantalla) → ahora son controles hermanos.
- Nombre del grupo: se tomaba el título en MAYÚSCULAS o en inglés → ahora se prefieren títulos de tiendas locales con mayúsculas normales.
- Texto "Llega mañana hábiles" → "Llega mañana" / "Llega en N días hábiles".

---

## Próximos pasos sugeridos
1. Backend real: API Gateway y adaptadores en servidor (ver arquitectura §11).
2. Historial de precios (caché L2) con un gráfico simple en el detalle.
3. Filtros de color para daltonismo (propuesta §4.1) y opción de tipografía Atkinson Hyperlegible.
4. Pruebas de componentes con React Native Testing Library.
5. Builds con EAS para Android e iOS.
