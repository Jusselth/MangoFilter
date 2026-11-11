# Documentación — MangoFilter

Comparador de productos entre tiendas online colombianas. En lugar de depender de una sola tienda, MangoFilter consulta varias **en vivo** y muestra cuál es la mejor compra según el **costo total real (precio + envío cotizado a tu ciudad)** y el **tiempo de entrega**, con enlace directo a la publicación en cada tienda.

- Propuesta técnica original: [propuesta_t_cnica_mangofilter.md](propuesta_t_cnica_mangofilter.md)
- Arquitectura detallada: [arquitectura.md](arquitectura.md)

> Este archivo se actualiza con cada cambio. Las entradas nuevas van arriba en el **Registro de cambios**.

---

## Estructura del repositorio

```
MangoFilter/
├─ backend/     API (Node + TypeScript + Fastify): consulta tiendas reales, matching, envíos
├─ frontend/    App móvil Expo (React Native): consume la API
├─ documentacion.md · arquitectura.md · README.md · propuesta
└─ package.json scripts de conveniencia para ambos proyectos
```

## Cómo ejecutar

Requisitos: **Node 20 o superior**, y en el celular la app **Expo Go**, conectado a la **misma red Wi‑Fi** que el computador.

```bash
# 1) Instalar dependencias (una vez)
npm run install:all

# 2) Terminal 1 — backend (http://localhost:3000)
npm run backend

# 3) Terminal 2 — app (escanea el QR con Expo Go)
npm run frontend
```

- La app detecta sola la IP del computador (la misma que usa Expo) y llama al backend en el puerto 3000. Si quieres usar otra URL, copia `frontend/.env.example` como `frontend/.env` y define `EXPO_PUBLIC_API_URL`.
- **Windows:** la primera vez que arranque el backend, acepta el aviso del Firewall para "redes privadas"; si no, el celular no podrá conectarse.
- **Mercado Libre (opcional):** copia `backend/.env.example` como `backend/.env` y pon `ML_CLIENT_ID` y `ML_CLIENT_SECRET` de una app gratuita creada en https://developers.mercadolibre.com.co/devcenter.

Otros comandos:

```bash
npm test                                                    # pruebas de backend (19) y frontend (7)
npm run typecheck                                           # TypeScript en ambos proyectos
npm --prefix backend run smoke -- "licuadora oster" cali    # consulta EN VIVO las tiendas
npm --prefix frontend run web                               # app en el navegador
```

> **OneDrive:** el proyecto está en una carpeta sincronizada y Metro **no detecta los cambios de archivos** ahí. Si editas código y no ves el cambio, reinicia con `npx expo start --clear`. Lo ideal es mover el repo fuera de OneDrive.

---

## Funcionalidades (v0.2)

- **Búsqueda en vivo** en 5 tiendas reales a la vez: Olímpica, Jumbo, Carulla, Pepe Ganga y Panamericana. Mercado Libre se suma si hay credenciales.
- **Precio real para tu ciudad** (algunas tiendas tienen precios regionales) y **envío cotizado por la propia tienda**: costo y días hábiles, en 22 ciudades. Si una tienda no despacha a tu ciudad, se avisa ("32 productos no se despachan a Leticia").
- **Agrupa el mismo producto entre tiendas** con Entity Resolution (Jaro‑Winkler, códigos de fabricante y reglas de variante y precio), para compararlo lado a lado.
- **Tres criterios** para elegir la mejor oferta: Menor precio, Equilibrado y Llega antes.
- **Filtros instantáneos:** presupuesto máximo, días de entrega, solo envío gratis y tiendas.
- **Comparación detallada:** foto real, precio, precio anterior tachado, envío, días hábiles, vendedor (si es un tercero) y botón **"Ver en {tienda}"** con el enlace exacto.
- **Guardados** con seguimiento del precio ("Bajó $X" / "Subió $X"), **historial** de búsquedas, **ciudad** de entrega y **tema** claro/oscuro.
- **Resiliencia:** si una tienda falla o tarda, se muestran las demás y se indica cuál no respondió.

---

## Stack técnico

| Área | Elección | Motivo |
|---|---|---|
| Backend | **Node.js + TypeScript + Fastify 5** | Reutiliza el motor de matching ya probado en TypeScript; un solo lenguaje para el equipo |
| Datos | APIs públicas **VTEX** (Intelligent Search + Simulación de carrito) | Gratis, sin clave, con precio y envío reales por ciudad |
| Pruebas backend | Vitest + fixtures con respuestas reales | Rápido y con soporte nativo de TypeScript/ESM |
| App | Expo SDK 58, React Native 0.88, React 19 | Base del curso |
| Navegación | Expo Router (sobre React Navigation: Stack + Tabs) | Rutas tipadas y deep links (`mangofilter://`) |
| Estado global | **Redux Toolkit** + `react-redux` | Pedido explícito: Redux y Context en lugar de Zustand |
| Estado de servidor | **RTK Query** (`fetchBaseQuery` → backend) | Caché, deduplicación y estados de carga sin otra librería |
| Persistencia | `redux-persist` + AsyncStorage | Preferencias, guardados e historial |
| Tema | **React Context** | Claro/oscuro/sistema, degradados y sombras |
| UI | `expo-linear-gradient`, `expo-image`, `@expo/vector-icons`, Inter | Degradados mango, fotos reales con caché, íconos y tipografía legible |

---

## Decisiones y cambios respecto a la propuesta

1. **Datos 100 % reales.** El backend consulta en vivo las APIs públicas que las mismas tiendas usan en su web. La app no contiene datos de productos.
2. **Tiendas.** Solo se incluyen las que tienen una API pública verificada. Éxito bloquea con Cloudflare. Alkosto, Ktronix, Homecenter y Falabella no tienen API pública, y no se usan endpoints internos no documentados.
3. **Mercado Libre opcional.** Su API exige registrar una aplicación (gratis). El adaptador está escrito según la documentación oficial, pero **no se ha verificado en vivo** por falta de credenciales.
4. **Backend en Node/TypeScript, no en Go.** Se reutiliza el dominio ya probado y se mantiene un solo lenguaje. La arquitectura de la propuesta se conserva: API Gateway, adaptadores, normalización y matching, caché L1 y ranking.
5. **Envío real por código DANE.** VTEX Colombia identifica el destino con el código DANE del municipio, no con el código postal de 6 dígitos (hallazgo de la verificación).
6. **Se retiró el módulo de Servicios** (streaming, internet). No existe una API gratuita con precios reales en Colombia y la regla es no mostrar datos inventados.
7. **El orden de la lista es por relevancia**, no por precio. Ordenar todo por precio pondría primero los accesorios. El criterio elegido decide la mejor oferta dentro de cada producto. Los productos comparados en varias tiendas suben un poco.
8. **Reglas de matching nuevas**, motivadas por datos reales: palabras de variante (Pro/Max/reacondicionado…) y relación de precio máxima de 1.9×. Ver arquitectura §3.
9. **Embeddings → huellas de modelo y códigos de fabricante:** deterministas y precisos para electrodomésticos y tecnología.
10. **Accesibilidad:** se cumple lo aplicable de la sección 4 de la propuesta. Quedan pendientes los filtros para daltonismo.

---

## Registro de cambios

### v0.2.0 — 2026‑11‑11 · Datos reales y separación backend/frontend
**Repositorio**
- Monorepo: la app pasó a `frontend/` y se creó `backend/`. `package.json` raíz con `install:all`, `backend`, `frontend`, `test` y `typecheck`. Cada proyecto tiene su `.gitignore` y `.env.example`.

**Backend (nuevo)**
- Fastify 5 con rutas `GET /api/health`, `/api/stores`, `/api/cities` y `/api/search?q=&city=` (validación con JSON Schema y CORS).
- Adaptador **VTEX** genérico: Intelligent Search, filtro de relevancia, elección de SKU y vendedor con stock, simulación de carrito con el código DANE (precio regional y envío más barato) y conteo de productos que no se despachan.
- Tiendas activas verificadas en vivo: Olímpica, Jumbo, Carulla, Pepe Ganga y Panamericana. Adaptador opcional de **Mercado Libre** (OAuth client_credentials), activable por `.env`.
- 22 ciudades con código DANE y postal.
- Agregador federado con timeout por tienda (9 s), tolerancia a fallos, caché de respuesta (5 min), caché por tienda (búsqueda 10 min, simulación 15 min) y orden por relevancia.
- Dominio movido desde la app: `normalize`, `jaroWinkler`, `matching`. Se agregó `normalizeBrand`, más marcas reales, reglas de **variante** y de **precio**, y se quitó la comparación por categoría.
- Pruebas (19, Vitest) con **fixtures de respuestas reales** de Jumbo y Carulla, más el script `npm run smoke` para pruebas en vivo.

**Frontend**
- Eliminados todos los datos locales (`src/data`, catálogo simulado, logística y módulo de Servicios).
- RTK Query ahora usa `fetchBaseQuery` contra el backend. `config.ts` detecta la IP del computador desde Expo.
- Fotos reales con `expo-image` (`ProductImage`). `StoreBadge` toma nombre y color de la API, con texto de contraste calculado.
- Ciudades y tiendas vienen de la API. La ciudad elegida se guarda con su nombre.
- Pestañas: Buscar · Guardados · Ajustes. Los filtros quedan sin categorías.
- Avisos honestos: "Envío por confirmar", "N productos no se despachan a {ciudad}", "consultado hace X min" y la URL del servidor en Ajustes.
- Mensajes de error claros si el backend no responde, con botón para reintentar.
- Estado persistido con clave nueva (`mangofilter-v2`) para descartar los datos de demostración de la v0.1.
- Pruebas (7) actualizadas al contrato nuevo.

**Verificación**
- Backend: 19 pruebas, typecheck y build (`tsc`) OK. Smoke en vivo: "licuadora oster" en Cali, 29 productos de 5/5 tiendas en ~1,9 s.
- Frontend: 7 pruebas, typecheck, lint, `expo-doctor` 20/20 y bundle Android OK.
- Recorrido completo en navegador (claro y oscuro) con **datos reales**: inicio → "freidora de aire" (43 productos, 5/5 tiendas) → comparación Ninja FN101GY Jumbo vs Carulla con envío real → guardar → filtro "Hasta 2 días" (17 de 43) → guardados → cambio a Leticia ("32 productos no se despachan a Leticia") → ajustes. **Sin errores de consola.**

**Correcciones encontradas con datos reales**
- Se agrupaban iPhone 17 con 17 Pro y AirPods Max con Pro → regla de palabras de variante.
- Se agrupaban audífonos de $159.900 y $501.288 → regla de relación de precio.
- Los accesorios ("soporte para TV") aparecían al buscar televisores → filtro de relevancia por términos.
- Los productos comparados quedaban al final → orden por relevancia con empujón a los multi‑tienda.

### v0.1.0 — 2026‑11‑11 · Base funcional (datos de demostración, reemplazada por v0.2)
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
1. Desplegar el backend (Render, Railway o Fly.io) y definir `EXPO_PUBLIC_API_URL`. Builds con EAS.
2. Probar Mercado Libre con credenciales reales y ajustar su adaptador si hace falta.
3. Agregar más tiendas VTEX que se verifiquen públicas (basta una línea en `backend/src/stores/registry.ts`).
4. Historial de precios (caché L2 en base de datos) con un gráfico en el detalle.
5. Filtros de color para daltonismo y opción de tipografía Atkinson Hyperlegible.
6. Pruebas de componentes con React Native Testing Library.
