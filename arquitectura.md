# Arquitectura — MangoFilter

Este documento describe cómo está construido el sistema. Para el registro de cambios, cómo ejecutarlo y las decisiones tomadas, ver [documentacion.md](documentacion.md).

## 1. Vista general

MangoFilter es un **monorepo con dos proyectos**:

| Carpeta | Qué es | Tecnología |
|---|---|---|
| `backend/` | API Gateway: consulta las tiendas reales, normaliza, agrupa el mismo producto y cotiza el envío a la ciudad | Node.js 20+, TypeScript, Fastify 5, Vitest |
| `frontend/` | App móvil (y web) que consume la API | Expo SDK 58, React Native, Expo Router, Redux Toolkit + RTK Query, React Context |

**No hay datos simulados.** Cada búsqueda consulta en vivo las APIs públicas de las tiendas.

```
┌────────────────────────── frontend/ (Expo) ───────────────────────────┐
│  Pantallas (Expo Router) ─ componentes ─ tema (React Context)          │
│  Redux: preferences · filters · saved · history (redux-persist)        │
│  RTK Query ──── GET /api/search?q=&city= ─── /api/cities ─ /api/stores │
│  Ranking multicriterio en el cliente (reordena sin volver a consultar) │
└───────────────────────────────┬────────────────────────────────────────┘
                                │ HTTP/JSON (red local o servidor)
┌───────────────────────────────▼──────── backend/ (Fastify) ───────────┐
│  app.ts         rutas + validación (JSON Schema) + CORS                │
│  aggregator.ts  consulta federada en paralelo, timeout por tienda,     │
│                 tolerancia a fallos, caché de respuesta (5 min)        │
│  domain/        normalize · jaroWinkler · matching (Entity Resolution) │
│  stores/        adaptadores: vtex.ts (5 tiendas) · mercadolibre.ts     │
│  cache.ts       caché L1 TTL + LRU (búsquedas 10 min, envíos 15 min)   │
└───────┬──────────────┬──────────────┬──────────────┬──────────────┬───┘
        ▼              ▼              ▼              ▼              ▼
   Olímpica         Jumbo         Carulla       Pepe Ganga    Panamericana   (+ Mercado Libre opcional)
   ── APIs públicas VTEX: Intelligent Search + Simulación de carrito ──
```

## 2. Fuentes de datos (todas reales y gratuitas)

Se verificó en vivo (noviembre 2026) qué tiendas colombianas exponen datos de forma gratuita:

| Tienda | Fuente | Estado |
|---|---|---|
| Olímpica, Jumbo, Carulla, Pepe Ganga, Panamericana | APIs públicas de la plataforma **VTEX** (las mismas que usa la web de cada tienda) | ✅ Activas, sin clave |
| Mercado Libre | API oficial con OAuth (`client_credentials`) | ⚙️ Opcional: requiere registrar una app gratuita. **No verificado** sin credenciales |
| Éxito | VTEX, pero bloqueado por Cloudflare | ❌ |
| Alkosto, Ktronix, Homecenter, Falabella | Sin API pública (solo endpoints internos no documentados) | ❌ No se usan |

### APIs VTEX utilizadas
1. **Intelligent Search:** `GET {tienda}/api/io/_v/api/intelligent-search/product_search/?query=…&count=12&locale=es-CO&hideUnavailableItems=true`. Devuelve productos, marca, categorías, imágenes, enlace y precio publicado por vendedor.
2. **Simulación de carrito:** `POST {tienda}/api/checkout/pub/orderForms/simulation?sc=1` con `{ items, country: "COL", postalCode: <código DANE> }`. Devuelve el **precio real para esa ciudad** (algunas tiendas tienen precios regionales) y las **opciones de envío** con costo y tiempo (`"3bd"` = 3 días hábiles). Una sola llamada cotiza todos los productos de la tienda.

> **Hallazgo:** VTEX Colombia no usa el código postal de 6 dígitos sino el **código DANE del municipio** (Bogotá `11001`, Medellín `05001`…). Con el código postal normal la simulación responde "no se puede enviar". Las ciudades están en `backend/src/cities.ts`.

## 3. Backend

### Estructura
```
backend/
├─ src/
│  ├─ server.ts           arranque (lee .env, escucha en 0.0.0.0:3000)
│  ├─ app.ts              rutas Fastify
│  ├─ aggregator.ts       consulta federada + orden por relevancia
│  ├─ cities.ts           22 ciudades con código DANE y postal
│  ├─ cache.ts            TtlCache (TTL + LRU)
│  ├─ http.ts             fetch con timeout/cancelación y errores tipados
│  ├─ domain/
│  │  ├─ types.ts         CONTRATO de la API (copiado en frontend/src/api/types.ts)
│  │  ├─ normalize.ts     limpieza de texto, marca, huella de modelo, búsqueda
│  │  ├─ jaroWinkler.ts   similitud de cadenas
│  │  └─ matching.ts      Entity Resolution
│  └─ stores/
│     ├─ types.ts         contrato StoreAdapter
│     ├─ vtex.ts          adaptador genérico VTEX (búsqueda + simulación)
│     ├─ mercadolibre.ts  adaptador opcional (OAuth)
│     └─ registry.ts      lista de tiendas activas
├─ test/                  Vitest + fixtures con respuestas REALES de Jumbo/Carulla
└─ scripts/
   ├─ smoke.ts            prueba en vivo contra las tiendas (npm run smoke)
   └─ capture-fixtures.mjs  vuelve a capturar fixtures reales
```

### API REST
| Método y ruta | Respuesta |
|---|---|
| `GET /api/health` | `{ ok, stores[], time }` |
| `GET /api/stores` | `StoreRef[]`: id, nombre, iniciales, color, sitio web |
| `GET /api/cities` | `City[]`: id, nombre, departamento, DANE, postal |
| `GET /api/search?q=<2..80>&city=<id>` | `SearchResponse`: grupos de ofertas, estado por tienda, ciudad, `fetchedAt` |

Los parámetros se validan con JSON Schema: una búsqueda de menos de 2 caracteres o una ciudad desconocida devuelve 400.

### Flujo de una búsqueda
```
GET /api/search?q=freidora de aire&city=bogota
 → aggregator: ¿respuesta en caché (ciudad|consulta)? → devolverla
 → Promise.all(adaptadores) — cada uno con timeout de 9 s y AbortController:
     vtex.search(q, city)
       1. Intelligent Search (caché 10 min por consulta)
       2. Filtra por relevancia: todos los términos deben aparecer en el nombre
          (descarta "soporte para TV" al buscar "televisor samsung")
       3. Elige SKU + vendedor con stock y precio > 0
       4. Simulación con el DANE de la ciudad (caché 15 min)
          · sin opción de envío "delivery" → cuenta como "no despacha"
          · si la simulación falla → precio publicado y envío "por confirmar"
       5. → Offer (precio regional, envío más barato, días hábiles, imagen, URL)
 → groupOffers()  — Entity Resolution entre tiendas
 → sortByRelevance()  — posición en la tienda, con un empujón a los productos
                        comparados en varias tiendas
 → { groups, stores: [ok/timeout/error, count, notShippable, latencia], fetchedAt }
```

### Entity Resolution (`domain/matching.ts`)
Lo ajustaron casos reales observados en las tiendas:

1. **Limpieza:** minúsculas, sin tildes, unión de códigos (`WH-1000XM5 → wh1000xm5`), unidades (`3.8 Litros → 38l`, `55" → 55in`), ordinales y alias.
2. **Reglas duras** (similitud = 0):
   - marcas distintas (se usa el campo `brand` de la tienda, normalizado: "LG Electronics" → `lg`);
   - **palabras de variante** distintas: *pro, max, plus, mini, ultra, lite, fe, reacondicionado…* (iPhone 17 ≠ iPhone 17 Pro; AirPods Pro ≠ AirPods Max);
   - **huellas de modelo en conflicto**: tokens con dígitos (`128gb` vs `256gb`, `3.8 L` vs `4 L`);
   - **precio más de 1.9 veces mayor** que el de la otra oferta (regla de cordura: el mismo producto nuevo rara vez cuesta el doble en otra tienda).
3. **Código de fabricante compartido** (`FN101GY`, `UN55M75HAKXZL`): similitud mínima de 0.92.
4. **Similitud** = 0.65 × solapamiento difuso de tokens (Jaro‑Winkler) + 0.35 × Jaro‑Winkler del nombre normalizado. El umbral es 0.80.
5. **Clustering** voraz por enlace promedio, como máximo una oferta por tienda en cada grupo.
6. **La categoría no se compara:** cada tienda usa su propia taxonomía.

Los colores se tratan como ruido: el mismo modelo en otro color se considera el mismo producto.

### Caché y cortesía con las tiendas
- Respuesta completa por (ciudad, consulta): 5 min.
- Búsqueda por tienda: 10 min. Simulación por (tienda, ciudad, SKUs): 15 min.
- Una búsqueda hace, como máximo, 2 peticiones por tienda.
- `Cache-Control: max-age=120` en `/api/search`.

## 4. Frontend

### Estructura
```
frontend/src/
├─ app/                      Expo Router (React Navigation por archivos)
│  ├─ _layout.tsx            Redux + PersistGate + ThemeProvider + Stack
│  ├─ (tabs)/                Buscar · Guardados · Ajustes
│  ├─ search.tsx             resultados (?q=)
│  ├─ product/[id].tsx       comparación entre tiendas (?q=)
│  ├─ filters.tsx            modal
│  └─ city.tsx               modal
├─ api/types.ts              copia del contrato del backend
├─ config.ts                 URL del backend (auto-detecta la IP de Expo)
├─ store/                    Redux Toolkit + RTK Query (api.ts) + slices
├─ domain/ranking.ts         motor multicriterio en el cliente
├─ hooks/                    useRankedSearch, useHaptics
├─ components/               ui.tsx, ProductCard, OfferCard, ProductImage, …
├─ theme/                    paleta mango + ThemeContext
└─ utils/format.ts           COP, días, contraste del logo de tienda
```

### Estado
| Tipo | Dónde | Persistencia |
|---|---|---|
| Servidor | RTK Query (`fetchBaseQuery` → backend) | Caché en memoria; ciudades 24 h, tiendas 1 h, búsquedas 5 min |
| Cliente global | Slices `preferences` (ciudad, criterio, tema, hápticos), `filters`, `saved`, `history` | redux-persist + AsyncStorage (los filtros duran solo la sesión) |
| Tema | React Context `ThemeProvider` / `useTheme` | Deriva de `preferences.themeMode` + sistema |

### Conexión con el backend (`config.ts`)
1. Si está definido `EXPO_PUBLIC_API_URL` en `frontend/.env`, se usa esa URL.
2. Si no, en el celular con Expo Go se usa **la misma IP desde la que Expo sirve la app**, con el puerto 3000. Así funciona en la red local sin configurar nada.
3. En web se usa `http://<host>:3000`.

### Motor multicriterio (en el cliente)
- **Costo total** = precio regional + envío cotizado.
- **Puntaje** = `w · costoNorm + (1 − w) · √díasNorm`, con `w` = 1 (Menor precio), 0.5 (Equilibrado) o 0.15 (Llega antes).
- Una oferta con **envío desconocido nunca es la "mejor"** si hay otra con envío confirmado.
- **Orden de la lista:** el del backend (relevancia). El criterio decide la mejor oferta *dentro* de cada producto. Ordenar toda la lista por precio pondría primero los accesorios baratos.
- **Filtros:** presupuesto (sobre el total), días máximos, solo envío gratis y tiendas.

## 5. Diseño y accesibilidad
- Paleta mango clara y oscura (`theme/palette.ts`), degradados solo en el encabezado, el botón principal y la mejor opción, sombras cálidas y tipografía Inter.
- **Fotos reales** de producto (`expo-image`, caché en disco) sobre fondo blanco, para que se vean bien también en modo oscuro.
- Logo textual de tienda con color de texto calculado por contraste WCAG (`readableOn`).
- Lectores de pantalla: etiquetas habladas ("606.219 pesos"), región viva para el conteo de resultados y encabezados semánticos.
- Texto ampliable hasta 200 %, objetivos táctiles de 44 pt, nada que dependa solo del color, sin sliders de arrastre y sin patrones oscuros.

## 6. Pruebas
| Proyecto | Comando | Qué cubre |
|---|---|---|
| backend | `npm test` (19) | Jaro‑Winkler, normalización, matching con títulos reales (agrupa Ninja FN101GY y Oster 3.8 L; separa iPhone 17/17 Pro, 3.8 L/4 L y precios 3x), adaptador VTEX con fixtures reales (DANE, "no despacha", simulación caída, caché), agregador (tienda caída, timeout, caché por ciudad), orden por relevancia y API HTTP |
| backend | `npm run smoke -- "<consulta>" <ciudad>` | Consulta **en vivo** las tiendas reales |
| frontend | `npm test` (7) | Criterios, envío desconocido, filtros y contraste del logo |
| ambos | `npm run typecheck`, `npx expo lint`, `npx expo-doctor` | Tipos, lint y configuración de Expo |

## 7. Limitaciones conocidas y siguientes pasos
- Las APIs de VTEX son **públicas pero no son un acuerdo comercial**: pueden cambiar o limitar el tráfico. La caché reduce la carga, y el adaptador está aislado para cambiarlo fácilmente.
- Mercado Libre requiere credenciales y no se pudo probar en vivo.
- Despliegue: el backend puede ir a cualquier servicio de Node (Render, Railway, Fly.io). Luego se define `EXPO_PUBLIC_API_URL` y se compila la app con EAS.
- Caché L2 (historial de precios) y Redis compartido cuando haya más de una instancia.
- El módulo de Servicios (streaming, internet) se retiró: no existe una API gratuita con precios reales en Colombia.
