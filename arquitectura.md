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
│         session (token en expo-secure-store) · accountSync (listener)  │
│  RTK Query ──── /api/search · /cities · /stores · /auth · /me · /stats │
│  Ranking multicriterio en el cliente (reordena sin volver a consultar) │
└───────────────────────────────┬────────────────────────────────────────┘
                                │ HTTP/JSON (Authorization + X-Device-Id)
┌───────────────────────────────▼──────── backend/ (Fastify) ───────────┐
│  app.ts         rutas + validación (JSON Schema) + CORS + rate limit   │
│  routes/        account.ts (cuentas) · activity.ts (eventos/stats)     │
│  auth/ analytics.ts userData.ts recommendations.ts ──► PostgreSQL ──┐  │
│  aggregator.ts  consulta federada en paralelo, timeout por tienda,     │
│                 tolerancia a fallos, caché de respuesta (5 min)        │
│  domain/        normalize · jaroWinkler · matching (Entity Resolution) │
│  stores/        adaptadores: vtex.ts (5 tiendas) · mercadolibre.ts     │
│  cache.ts       caché L1 TTL + LRU (búsquedas 10 min, envíos 15 min)   │
└───────┬──────────────┬──────────────┬──────────────┬──────────────┬───┘
        ▼              ▼              ▼              ▼              ▼
   Olímpica         Jumbo         Carulla       Pepe Ganga    Panamericana   (+ Mercado Libre opcional)
   ── APIs públicas VTEX: Intelligent Search + Simulación de carrito ──

   Supabase (PostgreSQL, esquema privado `mangofilter`) ◄── solo el backend, por el Session pooler (TLS)
   Gmail SMTP (contraseña de aplicación) ◄── envío de los códigos de verificación
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
│  ├─ app.ts              rutas Fastify, CORS, límite de peticiones y errores
│  ├─ config.ts           variables de entorno (base de datos, correo, secreto)
│  ├─ services.ts         arma auth + analytics + userData sobre la base de datos
│  ├─ db/index.ts         conexión a PostgreSQL (pg, TLS)
│  ├─ auth/               service.ts (códigos y sesiones) · mailer.ts (Gmail)
│  ├─ routes/             account.ts (cuentas) · activity.ts (vistas, estadísticas, recomendaciones)
│  ├─ analytics.ts        eventos, lo más buscado, top de tiendas, intereses
│  ├─ userData.ts         preferencias y guardados por cuenta
│  ├─ recommendations.ts  recomendaciones según la actividad real
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
├─ db/schema.sql          esquema de la base de datos (se pega en el SQL Editor de Supabase)
├─ test/                  Vitest + fixtures con respuestas REALES de Jumbo/Carulla + PGlite
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
| `GET /api/search?q=<2..80>&city=<id>` | `SearchResponse`: grupos de ofertas, estado por tienda, ciudad, `fetchedAt`. Registra la búsqueda (anónima) |
| `POST /api/auth/code` · `POST /api/auth/verify` · `POST /api/auth/logout` | Envía el código · lo verifica y devuelve `{ token, user, isNew }` · cierra la sesión |
| `GET /api/me` · `POST /api/me/sync` | Datos de la cuenta `{ user, preferences, saved, history }` · une los datos del invitado |
| `PUT /api/me/preferences` · `PUT /api/me/saved` · `DELETE /api/me/saved/:id` · `DELETE /api/me` | Cambios de la cuenta y eliminación de la cuenta |
| `POST /api/events/click` · `DELETE /api/history` | Registra una vista · borra el historial (de la cuenta o del dispositivo) |
| `GET /api/stats/top-stores` · `GET /api/stats/trending?city=` | Tiendas más visitadas · lo más buscado en la ciudad (30 días) |
| `GET /api/recommendations?city=` | Recomendaciones según la actividad real del usuario |

Los parámetros y cuerpos se validan con JSON Schema: una búsqueda de menos de 2 caracteres o una ciudad desconocida devuelve 400. Sin base de datos configurada, las rutas de cuentas y estadísticas responden 503 y `/api/health` informa `features.accounts: false`.

Límites por IP: códigos 10 cada 15 min, verificación 20 cada 15 min, búsqueda 60/min, vistas 120/min y recomendaciones 30/min.

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
       4. Simulación con el DANE de la ciudad (caché 15 min) → availability:
          · con opción "delivery"                  → delivery (envío y días reales)
          · solo "pickup-in-point"                 → pickup (se conserva, marcada)
          · sin opciones                           → no_delivery (se conserva, marcada)
          · "withoutStock" en la ciudad            → se descarta
          · si la simulación falla                 → unknown, envío "por confirmar"
       5. → Offer (precio regional, envío más barato, días hábiles, disponibilidad, imagen, URL)
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

### Base de datos (`db/schema.sql`, PostgreSQL en Supabase)
| Tabla | Contenido |
|---|---|
| `users` | id (uuid), correo (único, en minúsculas), creación, último ingreso, aceptación del aviso |
| `login_codes` | HMAC del código, vencimiento (10 min), intentos, consumo, IP |
| `sessions` | SHA‑256 del token, usuario, vencimiento (60 días deslizantes) |
| `preferences` | ciudad, criterio, tema y vibración por usuario |
| `saved_products` | productos guardados por usuario (máx. 200) |
| `search_events` | actor (seudónimo), usuario (opcional), búsqueda, búsqueda normalizada, ciudad, nº de resultados |
| `click_events` | actor, usuario (opcional), tienda, oferta, producto, búsqueda, ciudad |

- Todo está en el esquema privado `mangofilter`, que Supabase no publica por PostgREST. Además tiene RLS activado sin políticas y permisos revocados a `anon` y `authenticated`. El backend entra como dueño de las tablas.
- Al eliminar un usuario se borran en cascada sus sesiones, preferencias y guardados. En los eventos, primero se reemplaza el seudónimo y luego `user_id` queda en `null`.
- Las pruebas ejecutan este mismo archivo en **PGlite** (PostgreSQL compilado a WebAssembly).

### Cuentas (`auth/service.ts`)
```
correo ──► POST /auth/code ──► código de 6 dígitos (crypto.randomInt) ──► Gmail
             · máx. 1 por minuto y 5 por hora por correo (+ límite por IP)
             · se guarda HMAC-SHA256(AUTH_SECRET, correo:código); pedir otro invalida el anterior
código ──► POST /auth/verify ──► compara en tiempo constante · máx. 5 intentos · vence en 10 min
             · cuenta nueva: exige aceptar el aviso de privacidad
             · consumo atómico (UPDATE … WHERE consumed_at IS NULL)
             · token aleatorio de 256 bits → al celular; SHA-256 → tabla sessions
```
Las respuestas no revelan si un correo ya tiene cuenta.

### Eventos, estadísticas y recomendaciones (`analytics.ts`, `recommendations.ts`)
- **Actor:** `HMAC(AUTH_SECRET, "u:"+userId)` con sesión, o `HMAC(AUTH_SECRET, "d:"+deviceId)` sin ella. `deviceId` es un UUID aleatorio que genera la app. Sin sesión ni dispositivo (por ejemplo, `curl`) no se registra nada.
- **Búsqueda:** se registra en `GET /api/search` sin retrasar la respuesta, sin repetir la misma (actor, búsqueda, ciudad) en 10 min.
- **Vista:** clic en "Ver en {tienda}", sin repetir la misma (actor, oferta) en 30 min. El ID de la oferta debe pertenecer a la tienda.
- **Lo más buscado:** por ciudad, últimos 30 días, solo búsquedas con resultados y hechas por al menos `TRENDING_MIN_PEOPLE` (3) actores distintos.
- **Tiendas más visitadas:** vistas de los últimos 30 días por tienda.
- **Recomendaciones:** `puntaje(búsqueda) = Σ peso · e^(−días/14)`, con peso 1 por búsqueda, 3 por vista y 4 por guardado (últimos 90 días). Las 3 búsquedas con más puntaje se consultan en vivo (con caché) y de cada una se toma el producto más relevante que llegue a la ciudad y no esté guardado.
- **Borrar historial / eliminar cuenta:** `actor ← sha256(actor ‖ sal aleatoria descartada)` y `user_id ← null`. Los conteos agregados no cambian, pero ya no se pueden asociar a la persona.
- **Retención:** eventos 12 meses, códigos 1 día, sesiones hasta que vencen.

### Caché y cortesía con las tiendas
- Respuesta completa por (ciudad, consulta): 5 min.
- Búsqueda por tienda: 10 min. Simulación por (tienda, ciudad, SKUs): 15 min.
- Una búsqueda hace, como máximo, 2 peticiones por tienda.
- `Cache-Control: private, max-age=120` en `/api/search` (la respuesta puede ir con sesión).

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
│  ├─ city.tsx               modal
│  ├─ login.tsx              modal: correo → código de 6 dígitos
│  └─ privacy.tsx            aviso de privacidad
├─ api/types.ts              copia del contrato del backend
├─ config.ts                 URL del backend (auto-detecta la IP de Expo)
├─ auth/storage.ts           sesión en almacenamiento seguro + ID anónimo del dispositivo
├─ store/                    Redux Toolkit + RTK Query (api.ts) + slices + accountSync.ts
├─ domain/ranking.ts         motor multicriterio en el cliente
├─ hooks/                    useRankedSearch, useHaptics
├─ components/               ui.tsx, ProductCard, OfferCard, HomeInsights, AccountSection, …
├─ theme/                    paleta mango + ThemeContext
└─ utils/format.ts           COP, días, contraste del logo de tienda
```

### Estado
| Tipo | Dónde | Persistencia |
|---|---|---|
| Servidor | RTK Query (`fetchBaseQuery` → backend) | Caché en memoria; ciudades 24 h, tiendas 1 h, búsquedas 5 min |
| Cliente global | Slices `preferences` (ciudad, criterio, tema, hápticos), `filters`, `saved`, `history` | redux-persist + AsyncStorage (los filtros duran solo la sesión). Con cuenta, también en el servidor |
| Sesión | Slice `session` (`loading` / `guest` / `authenticated`) | Token en `expo-secure-store` (localStorage en web), nunca en AsyncStorage |
| Sincronización | `store/accountSync.ts` (Redux listener middleware) | Al entrar: sube los datos del invitado y descarga la cuenta. Al abrir la app: recarga `GET /api/me`. Con sesión: envía cada cambio de guardados y preferencias. Al salir o con un 401: borra del dispositivo el token, guardados e historial |
| Tema | React Context `ThemeProvider` / `useTheme` | Deriva de `preferences.themeMode` + sistema |

### Conexión con el backend (`config.ts`)
1. Si está definido `EXPO_PUBLIC_API_URL` en `frontend/.env`, se usa esa URL.
2. Si no, en el celular con Expo Go se usa **la misma IP desde la que Expo sirve la app**, con el puerto 3000. Así funciona en la red local sin configurar nada.
3. En web se usa `http://<host>:3000`.

### Motor multicriterio (en el cliente)
- **Costo total** = precio regional + envío cotizado.
- **Puntaje** = `w · costoNorm + (1 − w) · √díasNorm`, con `w` = 1 (Menor precio), 0.5 (Equilibrado) o 0.15 (Llega antes).
- **Orden por disponibilidad:** primero envío confirmado, luego envío desconocido, luego "solo recogida" y al final "no despacha". El puntaje se calcula dentro de cada nivel, así que una oferta con **envío desconocido nunca es la "mejor"** si hay otra con envío confirmado, y lo que **no llega a la ciudad nunca es la "mejor"**. El ahorro solo compara lo que llega.
- **Orden de la lista:** el del backend (relevancia). El criterio decide la mejor oferta *dentro* de cada producto. Ordenar toda la lista por precio pondría primero los accesorios baratos.
- **Filtros:** presupuesto (sobre el total), días máximos, solo envío gratis, tiendas y "ocultar lo que no llega a mi ciudad".

## 5. Diseño y accesibilidad
- Paleta mango clara y oscura (`theme/palette.ts`), degradados solo en el encabezado, el botón principal y la mejor opción, sombras cálidas y tipografía Inter.
- **Fotos reales** de producto (`expo-image`, caché en disco) sobre fondo blanco, para que se vean bien también en modo oscuro.
- Logo textual de tienda con color de texto calculado por contraste WCAG (`readableOn`).
- Lectores de pantalla: etiquetas habladas ("606.219 pesos"), región viva para el conteo de resultados y encabezados semánticos.
- Texto ampliable hasta 200 %, objetivos táctiles de 44 pt, nada que dependa solo del color, sin sliders de arrastre y sin patrones oscuros.

## 6. Pruebas
| Proyecto | Comando | Qué cubre |
|---|---|---|
| backend | `npm test` (38) | Jaro‑Winkler, normalización, matching con títulos reales (agrupa Ninja FN101GY y Oster 3.8 L; separa iPhone 17/17 Pro, 3.8 L/4 L y precios 3x), adaptador VTEX con fixtures reales (DANE, "no despacha", "solo recogida", "sin stock", simulación caída, caché), agregador (tienda caída, timeout, caché por ciudad), orden por relevancia y API HTTP. **Integración sobre PostgreSQL real (PGlite):** códigos, sesiones, privacidad, sincronización, eventos, estadísticas, recomendaciones, borrar historial, eliminar cuenta y modo sin base de datos |
| backend | `npm run smoke -- "<consulta>" <ciudad>` | Consulta **en vivo** las tiendas reales |
| frontend | `npm test` (9) | Criterios, envío desconocido, ofertas que no llegan (nunca son la mejor), filtros y contraste del logo |
| ambos | `npm run typecheck`, `npx expo lint`, `npx expo-doctor` | Tipos, lint y configuración de Expo |

## 7. Limitaciones conocidas y siguientes pasos
- Las APIs de VTEX son **públicas pero no son un acuerdo comercial**: pueden cambiar o limitar el tráfico. La caché reduce la carga, y el adaptador está aislado para cambiarlo fácilmente.
- Mercado Libre requiere credenciales y no se pudo probar en vivo.
- Despliegue: el backend puede ir a cualquier servicio de Node (Render, Railway, Fly.io). Luego se define `EXPO_PUBLIC_API_URL` y se compila la app con EAS.
- Caché L2 (historial de precios) y Redis compartido (caché y límite de peticiones) cuando haya más de una instancia.
- Gmail admite unos 500 correos al día y puede caer en spam. Con un dominio propio conviene un proveedor transaccional (Resend, Brevo, SES), cambiando solo `auth/mailer.ts`.
- Las estadísticas empiezan vacías: se llenan con el uso real. "Lo más buscado" no aparece hasta que 3 personas distintas hagan la misma búsqueda en una ciudad.
- En web, la sesión se guarda en `localStorage` (el navegador no tiene un almacén seguro equivalente).
- El módulo de Servicios (streaming, internet) se retiró: no existe una API gratuita con precios reales en Colombia.
