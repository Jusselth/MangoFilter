# Arquitectura — MangoFilter (app móvil)

Este documento describe cómo está construida la app. Para el registro de cambios, cómo ejecutarla y las decisiones tomadas, ver [documentacion.md](documentacion.md).

## 1. Vista general

MangoFilter es una app **React Native + Expo (SDK 58) + TypeScript** que consulta varias tiendas en paralelo, normaliza sus respuestas a un esquema común, identifica cuándo distintas publicaciones son el mismo producto y ordena las ofertas por **Costo Total = Precio Base + Costo de Envío** (ecuación 1 de la propuesta) y por tiempo de entrega.

En esta versión, la arquitectura federada de la propuesta (API Gateway → adaptadores → normalización → caché) **corre dentro de la app** con datos de demostración. Las capas están separadas por contratos, de modo que pasar a un backend real cambia los adaptadores y la `baseQuery`, no las pantallas.

```
┌──────────────────────────────────────────────────────────────────────┐
│ PRESENTACIÓN   src/app (Expo Router)  ·  src/components              │
│   Pantallas, navegación tipada, tema (React Context)                 │
├──────────────────────────────────────────────────────────────────────┤
│ ESTADO         src/store (Redux Toolkit)                             │
│   ├─ Estado de servidor: RTK Query  (api.ts)                         │
│   └─ Estado de cliente: slices preferences / filters / saved / history│
│      persistidos con redux-persist + AsyncStorage                    │
├──────────────────────────────────────────────────────────────────────┤
│ DATOS          src/data                                              │
│   aggregator.ts  → consulta federada con timeout + tolerancia a fallos│
│   cache.ts       → caché L1 (TTL + LRU) por tienda y búsqueda         │
│   adapters/      → un adaptador por tienda (formato crudo → Offer)    │
│   servicesRepository.ts → módulo de servicios                         │
│   seed/          → catálogo de demostración                          │
├──────────────────────────────────────────────────────────────────────┤
│ DOMINIO        src/domain  (TypeScript puro, sin React, 100% testeable)│
│   types.ts       → esquema canónico                                  │
│   normalize.ts   → limpieza de texto, marca, huella de modelo         │
│   jaroWinkler.ts → similitud de cadenas                              │
│   matching.ts    → Entity Resolution (agrupar el mismo producto)      │
│   logistics.ts   → ciudades, zonas, políticas de envío por tienda     │
│   ranking.ts     → costo total, puntaje multicriterio, filtros        │
└──────────────────────────────────────────────────────────────────────┘
```

**Regla de dependencias:** cada capa solo importa de las de abajo. `domain` no conoce React, Redux ni Expo.

## 2. Estructura de carpetas

```
src/
├─ app/                        Rutas (Expo Router = React Navigation por archivos)
│  ├─ _layout.tsx              Proveedores + Stack raíz
│  ├─ (tabs)/_layout.tsx       Bottom Tabs: Buscar · Servicios · Guardados · Ajustes
│  ├─ (tabs)/index.tsx         Inicio / búsqueda
│  ├─ (tabs)/services.tsx      Catálogo de servicios
│  ├─ (tabs)/saved.tsx         Productos guardados con variación de precio
│  ├─ (tabs)/settings.tsx      Ciudad, criterio, tema, hápticos, datos
│  ├─ search.tsx               Resultados (?q=)
│  ├─ product/[id].tsx         Comparación entre tiendas (?q=)
│  ├─ service/[id].tsx         Comparación de integradores de un servicio
│  ├─ filters.tsx              Modal de filtros
│  └─ city.tsx                 Modal de ciudad de entrega
├─ components/                 UI reutilizable (ui.tsx, ProductCard, OfferCard, …)
├─ hooks/                      useRankedSearch, useHaptics
├─ store/                      Redux: index.ts, api.ts, slices/
├─ theme/                      palette.ts (tokens), ThemeContext.tsx
├─ data/                       aggregator, cache, adapters, repositorio, seed
├─ domain/                     Lógica pura + __tests__
└─ utils/format.ts             Moneda COP, textos para lector de pantalla
```

## 3. Navegación

Se usa **Expo Router**, que está construido sobre **React Navigation** (Native Stack + Bottom Tabs) y añade rutas por archivo, rutas tipadas (`experiments.typedRoutes`) y **deep links** automáticos con el esquema `mangofilter://`.

```
Stack (raíz)
├─ (tabs)  ── Bottom Tabs
│   ├─ index      /            Buscar
│   ├─ services   /services    Servicios
│   ├─ saved      /saved       Guardados
│   └─ settings   /settings    Ajustes
├─ search          /search?q=…
├─ product/[id]    /product/<idOferta>?q=…
├─ service/[id]    /service/<idServicio>
├─ filters         (modal)
└─ city            (modal)
```

Ejemplos de deep link: `mangofilter://search?q=parlante%20jbl`, `mangofilter://service/netflix`.

## 4. Gestión de estado

Se separan explícitamente los tres tipos de estado vistos en el curso, usando **Redux Toolkit** y **React Context** (no Zustand):

| Tipo | Dónde | Qué guarda | Persistencia |
|---|---|---|---|
| **Servidor** | RTK Query (`store/api.ts`) | Resultados de búsqueda, servicios | Caché en memoria (5 min sin uso) |
| **Global de cliente** | Slices de Redux | Ciudad, criterio, tema, hápticos · filtros · guardados · historial | `redux-persist` + AsyncStorage para preferences, saved e history. Los filtros duran solo la sesión |
| **Tema** | React Context (`ThemeContext`) | Paleta resuelta, degradados, sombras | Deriva de `preferences.themeMode` + esquema del sistema |
| **Local** | `useState` | Texto del buscador, orden en servicios | — |

**Por qué RTK Query:** ya trae caché por argumentos, deduplica peticiones (Guardados e Inicio pueden pedir la misma búsqueda sin duplicarla), maneja estados de carga y error y permite `refetch`. Hoy usa `fakeBaseQuery` sobre el agregador local. Con un backend real se cambia por `fetchBaseQuery({ baseUrl })`.

**Ordenar sin volver a consultar:** `useRankedSearch` combina los datos crudos de RTK Query con criterio y filtros (Redux) usando `useMemo`. Cambiar un filtro reordena al instante, sin llamar de nuevo a las tiendas.

## 5. Flujo de una búsqueda

```
Usuario escribe "audífonos sony"
  → dispatch(addQuery)                         historial persistido
  → router.push('/search?q=…')
  → useRankedSearch → useSearchProductsQuery({ q, city })   (RTK Query)
      → aggregator.searchProducts(q, city)
          ├─ cleanText(q)                       normaliza la consulta
          ├─ Promise.all(adaptadores)           EN PARALELO, cada uno con:
          │    ├─ caché L1 (clave tienda|consulta) → si hay, no hay red
          │    ├─ fetchRaw() con timeout 3 s + AbortController
          │    └─ normalize(raw, city) → Offer (precio COP + envío + días)
          ├─ groupOffers(offers)                Entity Resolution
          └─ { groups, stores: [estado por tienda], tookMs }
  → rankResults(groups, criterio, filtros)      motor multicriterio
  → FlatList de ProductCard
```

- **Tolerancia a fallos:** si una tienda falla o supera el timeout se marca `error` o `timeout`, la UI avisa ("No respondió: …") y muestra lo que sí llegó.
- **La caché guarda la respuesta cruda**, no la normalizada. Al cambiar de ciudad se recalculan envío y días sin consultar de nuevo a las tiendas.
- **TTL por tienda:** Mercado Libre 2 min (marketplace volátil), Falabella y Alkosto 10 min, Homecenter 15 min, AliExpress 30 min.

## 6. Normalización y Entity Resolution

### Esquema canónico (`Offer`)
`id` (ID_Interno = `tienda:sku`), `title`, `normalizedTitle`, `brand`, `category`, `basePrice`, `listPrice`, `shippingCost`, `deliveryDays`, `totalCost`, `url`, `bulky`, `notes`.

### Adaptadores (formatos crudos distintos a propósito)
| Tienda | Formato simulado | Traducción |
|---|---|---|
| Mercado Libre | `{ id, title, price, original_price, category_id: 'MCO1648', attributes[] }` | Mapea categoría MCO y detecta "voluminoso" por atributo |
| Falabella | precios como texto `"1.399.990"` en lista `prices[]` | Parseo de miles y elección entre `internetPrice` y `normalPrice` |
| AliExpress | `salePrice: { amount, currency: 'USD' }`, títulos en inglés | Conversión USD→COP y nota de importación |
| Homecenter | `precioNormal` / `precioOferta` | Elige la oferta si existe |
| Alkosto | `price.value: "1234900.00"` y `discountPercent` | Reconstruye el precio anterior |

### Algoritmo de coincidencia (`matching.ts`)
1. **Limpieza** (`cleanText`): minúsculas, quita tildes, une códigos (`WH-1000XM5 → wh1000xm5`), unifica unidades (`128 GB → 128gb`, `55" → 55in`, `4 litros → 4l`), quita ordinales (`2da → 2`) y aplica alias (`ps5 → playstation 5`).
2. **Tokens significativos:** se descarta el ruido comercial y descriptivo ("envío gratis", "inalámbricos", colores…).
3. **Reglas duras** (similitud = 0): categoría distinta, marca distinta o **huella de modelo en conflicto**. La huella son los tokens con dígitos, y hay conflicto si cada lado tiene un código que el otro no tiene (`128gb` vs `256gb`). Si un lado es subconjunto del otro, no hay conflicto (una tienda omitió "5G").
4. **Código de fabricante compartido** (tipo MPN, p. ej. `du7000`, `dcd7781d2`): si ambos lo tienen, se ignoran números sueltos ("139 cm", "2 baterías") y la similitud mínima es 0.92.
5. **Similitud** = 0.65 × solapamiento difuso de tokens (Jaro‑Winkler por token) + 0.35 × Jaro‑Winkler del nombre normalizado.
6. **Clustering voraz por enlace promedio** con umbral 0.80. Una oferta no se une a un grupo que ya tenga otra de la **misma tienda**, para no fusionar variantes.
7. **Nombre del grupo:** el título más "central" del grupo. Se prefieren títulos que no estén TODO EN MAYÚSCULAS y que vengan de tiendas locales en español.

La prueba `matching.test.ts` pasa **todo el catálogo** por los adaptadores y verifica que se reconstruyan exactamente los 25 productos, incluidos los "señuelos" que no deben fusionarse: XM4 vs XM5, Galaxy A35 vs A55, iPhone 15 de 128 GB vs 256 GB.

> La propuesta menciona *embeddings* de texto locales. En esta versión se reemplazaron por huellas de modelo y códigos de fabricante, que son deterministas, no requieren un modelo en el dispositivo y resultan muy precisos en electrónica y hogar. Quedan como mejora futura del lado servidor.

## 7. Logística y motor multicriterio

- **Ciudades por zona** (principal, intermedia, remota). Cada tienda tiene su política: tarifa por zona, umbral de envío gratis, días por zona y reglas para artículos voluminosos (multiplicador, pérdida del envío gratis y días extra).
- **Costo total** = precio base + envío (`ranking.totalCost`).
- **Puntaje** (menor = mejor): `w · costoNorm + (1 − w) · díasNorm`, normalizando con min‑max dentro del conjunto comparado. A los días se les aplica raíz cuadrada, porque pasar de 1 a 3 días pesa más que pasar de 15 a 17.
- **Criterios:** `precio` (w = 1), `equilibrado` (w = 0.5) y `rapidez` (w = 0.15).
- **Filtros:** presupuesto máximo (sobre el total), solo envío gratis, días máximos, tiendas y categorías.
- **Servicios:** `netCost = precioMensual − valor de los servicios incluidos` (por ejemplo, un plan de fibra que incluye Netflix). Se ordena por precio o por "más valor".

## 8. Diseño visual

- **Tokens** en `theme/palette.ts`: paleta mango (amarillo maduro → naranja) con un verde hoja como acento, en versión clara y oscura, más espaciado, radios y tamaño táctil mínimo de 44.
- **Degradados** (`expo-linear-gradient`) solo en tres lugares: el encabezado de inicio, el botón principal y el borde de la "mejor opción". Así el degradado señala lo importante sin saturar.
- **Sombras cálidas** de tres niveles (`theme.shadow(n)`): `elevation` en Android y `shadow*` en iOS y web.
- **Tipografía Inter** (sugerida en la sección 4.4 de la propuesta) en cuatro pesos.
- **Animaciones** mínimas con Reanimated: entrada escalonada de resultados y skeleton de carga, ambas con `ReduceMotion.System`.

## 9. Accesibilidad (mapeo a la sección 4 de la propuesta)

| Requisito | Implementación |
|---|---|
| Lectores de pantalla | `accessibilityRole`, `accessibilityLabel` con resúmenes hablados ("1.349.900 pesos"), `accessibilityLiveRegion` en el conteo de resultados, encabezados con `role="header"` |
| Texto ampliable hasta 200 % | `maxFontSizeMultiplier={2}` en todo el texto; los layouts usan `flexWrap` y nada de alturas fijas en el texto |
| No depender solo del color | "Mejor opción" lleva etiqueta e ícono además del borde; chips seleccionados muestran ✓; variación de precio con flecha y texto ("Bajó $X") |
| Contraste AA | Texto oscuro sobre naranja (el blanco no llega a 4.5:1); `brandStrong #B4500E` sobre blanco ≈ 5.1:1 |
| Objetivos táctiles de 44 pt | `MIN_TOUCH`, `hitSlop` en chips y segmentos |
| Sin arrastre obligatorio | Los filtros usan chips y un campo numérico; no hay sliders |
| Sin patrones oscuros | Sin pop‑ups, contadores falsos ni banners parpadeantes |
| Modo oscuro | Tema claro/oscuro/sistema |
| Memoria de trabajo | Historial de búsquedas, filtros que se conservan en la sesión, resumen "mejor / más barato / más rápido" |

## 10. Pruebas y calidad

- `npm test`: 19 pruebas de Jest (jest-expo) sobre dominio y datos: Jaro‑Winkler con valores de referencia, normalización, reconstrucción del catálogo completo, envío por zona, criterios de orden, filtros, costo neto de servicios y un agregador con tienda caída, tienda lenta (timeout) y reuso de caché al cambiar de ciudad.
- `npm run typecheck`: TypeScript estricto.
- `npm run lint`: ESLint con `eslint-config-expo`.

## 11. Camino a producción

1. Implementar el **API Gateway** de la propuesta. En la app, cambiar `fakeBaseQuery` por `fetchBaseQuery` en `store/api.ts`. Los adaptadores, la normalización y el matching se mueven al servidor sin cambios, porque son TypeScript puro.
2. Agregar la caché L1 Redis y la L2 documental (historial de precios) del lado servidor. La app ya muestra la variación desde que se guardó un producto y podría mostrar el historial completo.
3. Autenticación (JWT en `expo-secure-store`) si se sincronizan los guardados entre dispositivos.
4. Builds con EAS (`eas build`, `eas submit`).
