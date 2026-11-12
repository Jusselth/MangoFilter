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
- **Cuentas, estadísticas y recomendaciones:** requieren Supabase y Gmail. Sigue la guía [Configurar Supabase y Gmail](#configurar-supabase-y-gmail-cuentas-estadísticas-y-recomendaciones). Sin esa configuración la app funciona igual, pero sin cuentas.
- **Mercado Libre (opcional):** copia `backend/.env.example` como `backend/.env` y pon `ML_CLIENT_ID` y `ML_CLIENT_SECRET` de una app gratuita creada en https://developers.mercadolibre.com.co/devcenter.

Otros comandos:

```bash
npm test                                                    # pruebas de backend (38) y frontend (9)
npm run typecheck                                           # TypeScript en ambos proyectos
npm --prefix backend run smoke -- "licuadora oster" cali    # consulta EN VIVO las tiendas
npm --prefix frontend run web                               # app en el navegador
```

> **OneDrive:** el proyecto está en una carpeta sincronizada y Metro **no detecta los cambios de archivos** ahí. Si editas código y no ves el cambio, reinicia con `npx expo start --clear`. Lo ideal es mover el repo fuera de OneDrive.

---

## Configurar Supabase y Gmail (cuentas, estadísticas y recomendaciones)

Se hace **una sola vez**. Todo es gratis. Al final, el backend mostrará `Cuentas: activas` al arrancar.

### 1. Crear el proyecto en Supabase
1. Entra a https://supabase.com, crea una cuenta y luego **New project**.
2. Nombre: `mangofilter`. **Database Password:** usa una contraseña larga con **solo letras y números** (los símbolos como `@ # / ? %` complican la cadena de conexión). **Guárdala:** la necesitas en el paso 3.
3. Región: la más cercana (**South America – São Paulo**). Plan: **Free**.
4. Espera 1–2 minutos a que el proyecto quede listo.

### 2. Crear las tablas (consultas SQL)
1. En el menú izquierdo abre **SQL Editor** → **New query**.
2. Abre el archivo [`backend/db/schema.sql`](backend/db/schema.sql), copia **todo** su contenido, pégalo y pulsa **Run**. Debe responder *"Success. No rows returned"*.
3. Para comprobarlo, ve a **Table Editor**, cambia el esquema de `public` a `mangofilter` y verifica que aparecen 7 tablas: `users`, `login_codes`, `sessions`, `preferences`, `saved_products`, `search_events` y `click_events`.

> El script se puede volver a ejecutar sin borrar datos. Las tablas viven en el esquema privado `mangofilter`, que la API pública de Supabase **no expone**: solo el backend accede, con la contraseña de la base de datos.

### 3. Copiar la cadena de conexión
1. Pulsa el botón **Connect** (arriba, en el panel del proyecto).
2. Elige **Session pooler** (no "Direct connection": en el plan gratis solo funciona por IPv6).
3. Copia la URI. Tiene esta forma:
   `postgresql://postgres.abcdefghijkl:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`
4. Reemplaza `[YOUR-PASSWORD]` (con los corchetes) por la contraseña del paso 1.

**Opcional, recomendado:** en **Project Settings → Database → SSL Configuration** pulsa **Download certificate** y guarda el archivo como `backend/supabase-ca.crt`. Con él, el backend verifica que se conecta al servidor real de Supabase. Sin él, la conexión va cifrada igual, pero sin esa verificación.

### 4. Crear la "contraseña de aplicación" de Gmail
Es una contraseña especial de 16 letras que Google genera para que un programa (nuestro backend) pueda **enviar correos desde tu cuenta** sin conocer tu contraseña real. Se puede revocar cuando quieras y es gratis (hasta unos 500 correos al día).

1. Usa una cuenta de Gmail **del proyecto**, no la personal (por ejemplo, crea `mangofilter.app@gmail.com`). Los códigos llegarán "desde" esa dirección.
2. En https://myaccount.google.com/security activa la **Verificación en dos pasos** (Google lo exige para las contraseñas de aplicación).
3. Abre https://myaccount.google.com/apppasswords, escribe el nombre `MangoFilter` y pulsa **Crear**.
4. Copia las 16 letras que aparecen. Google las muestra **una sola vez**.

### 5. Llenar `backend/.env`
Crea el archivo `backend/.env` (copia `backend/.env.example` y cámbiale el nombre) y complétalo. **Los valores reales van solo en `.env`; nunca en `.env.example`, que sí se sube a git.**

```bash
DATABASE_URL=postgresql://postgres.abcdefghijkl:TuContrasena123@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
DATABASE_SSL_CA=./supabase-ca.crt        # solo si descargaste el certificado
AUTH_SECRET=<64 caracteres aleatorios>   # genéralo con el comando de abajo
GMAIL_USER=mangofilter.app@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop      # las 16 letras; los espacios no importan
```

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # genera AUTH_SECRET
```

- **`AUTH_SECRET` no se cambia después:** si cambia, todas las sesiones y códigos pendientes dejan de valer.
- `backend/.env` está en `.gitignore`, así que **nunca se sube a git**. No compartas su contenido.

### 6. Probar
1. Desde `backend/` ejecuta `npm run check`. Verifica la conexión a Supabase (y el certificado), que existan las 7 tablas y que Gmail acepte la contraseña de aplicación, **sin enviar correos**.
2. Reinicia el backend (`npm run backend`). Debe mostrar `Cuentas: activas (base de datos + correo …)`. Si muestra un error de base de datos, revisa la contraseña en `DATABASE_URL` y que hayas ejecutado el SQL.
3. En la app: **Ajustes → Entrar o crear cuenta**, escribe un correo, acepta el aviso de privacidad y escribe el código que llega. Si no lo ves, revisa la carpeta de spam.
4. En Supabase (**Table Editor → mangofilter → users**) aparecerá el usuario.

> **Sin Gmail, solo para desarrollo:** con `MAIL_DEV_LOG=true` el código se imprime en la consola del backend en lugar de enviarse por correo.
>
> **Plan gratis de Supabase:** si el proyecto pasa una semana sin uso, Supabase lo **pausa**. Se reactiva desde el panel con **Restore project**.

---

## Funcionalidades (v0.3)

- **Búsqueda en vivo** en 5 tiendas reales a la vez: Olímpica, Jumbo, Carulla, Pepe Ganga y Panamericana. Mercado Libre se suma si hay credenciales.
- **Precio real para tu ciudad** (algunas tiendas tienen precios regionales) y **envío cotizado por la propia tienda**: costo y días hábiles, en 22 ciudades. Si una tienda no despacha a tu ciudad, se avisa ("32 productos no se despachan a Leticia").
- **Agrupa el mismo producto entre tiendas** con Entity Resolution (Jaro‑Winkler, códigos de fabricante y reglas de variante y precio), para compararlo lado a lado.
- **Tres criterios** para elegir la mejor oferta: Menor precio, Equilibrado y Llega antes.
- **Filtros instantáneos:** presupuesto máximo, días de entrega, solo envío gratis y tiendas.
- **Comparación detallada:** foto real, precio, precio anterior tachado, envío, días hábiles, vendedor (si es un tercero) y botón **"Ver en {tienda}"** con el enlace exacto.
- **Guardados** con seguimiento del precio ("Bajó $X" / "Subió $X"), **historial** de búsquedas, **ciudad** de entrega y **tema** claro/oscuro.
- **Cuentas con correo y código de verificación** (sin contraseña). Guardados, preferencias e historial se guardan en la cuenta y se recargan al iniciar sesión en cualquier dispositivo. El modo invitado sigue disponible y, al entrar, sus datos se unen a la cuenta.
- **Recomendado para ti:** la mejor opción actual de lo que el usuario ha buscado, visto y guardado de verdad.
- **Lo más buscado en tu ciudad:** búsquedas reales de al menos 3 personas distintas en los últimos 30 días.
- **Tiendas más visitadas:** clics hacia cada tienda desde MangoFilter en los últimos 30 días.
- **Aviso de "no se despacha":** las ofertas que no llegan a la ciudad (o que solo se pueden recoger en tienda) se muestran marcadas, nunca son la "mejor opción" y se pueden ocultar con un filtro.
- **Privacidad:** aviso de privacidad (Ley 1581), borrar historial y eliminar cuenta desde Ajustes.
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
| Persistencia | `redux-persist` + AsyncStorage | Preferencias, guardados e historial en el dispositivo |
| Base de datos | **PostgreSQL en Supabase** (plan gratis) con `pg` | Cuentas, guardados, preferencias y eventos. SQL estándar: se puede mover a cualquier PostgreSQL |
| Correo | `nodemailer` + Gmail SMTP (contraseña de aplicación) | Gratis y sin dominio propio. Se cambia por Resend/Brevo/SES tocando un solo archivo |
| Sesión en el celular | `expo-secure-store` (Keychain/Keystore) | El token nunca queda en texto plano |
| Límite de peticiones | `@fastify/rate-limit` | Protege el envío de códigos y la búsqueda |
| Pruebas con base de datos | **PGlite** (PostgreSQL real en memoria) | Las pruebas ejecutan el mismo `schema.sql` de Supabase, sin red |
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
11. **Inicio de sesión solo con código por correo**, sin contraseñas que guardar ni recuperar. El código se guarda cifrado (HMAC), vence en 10 min, sirve una vez, admite 5 intentos y se limita a 1 por minuto y 5 por hora por correo.
12. **El backend se conecta directo a PostgreSQL**, no con la API pública de Supabase. Las tablas están en un esquema privado con RLS activado sin políticas. Así no hay una segunda puerta de entrada a los datos y el proyecto no queda atado a Supabase.
13. **Estadísticas anónimas.** Cada evento lleva un seudónimo (HMAC) de la cuenta o de un identificador aleatorio del dispositivo. "Lo más buscado" exige un mínimo de personas distintas para no publicar búsquedas individuales. "Borrar historial" desvincula los eventos de la persona sin alterar los conteos.
14. **Una "vista"** es abrir el enlace de una oferta hacia la tienda. Se cuenta una por oferta y persona cada 30 min. No mide compras.
15. **Recomendaciones basadas en contenido**, con la actividad real del usuario y consultando las tiendas en vivo. El filtrado colaborativo ("quienes buscaron X también buscaron Y") queda para cuando haya volumen de usuarios: antes daría resultados sin sentido.
16. **Las ofertas que no llegan a la ciudad ya no se descartan.** Se muestran marcadas, porque el usuario quiere saber que existen.

---

## Registro de cambios

### v0.3.0 — 2026‑11‑11 · Cuentas, estadísticas, recomendaciones y aviso de despacho
**Backend**
- **Base de datos** PostgreSQL (Supabase): `db/schema.sql` idempotente, con 7 tablas en el esquema privado `mangofilter`, índices, RLS y revocación de permisos a los roles públicos. Conexión con `pg` por el Session pooler, con TLS y verificación opcional con el certificado de Supabase.
- **Cuentas sin contraseña** (`auth/service.ts`): `POST /api/auth/code`, `POST /api/auth/verify` y `POST /api/auth/logout`. El código se guarda como HMAC, la sesión es un token aleatorio de 256 bits (en la base solo queda su SHA‑256) y dura 60 días deslizantes. Se exige aceptar el aviso de privacidad al crear la cuenta.
- **Datos del usuario** (`userData.ts`): `GET /api/me`, `POST /api/me/sync` (une los datos del invitado sin pisar los de la cuenta), `PUT /api/me/preferences`, `PUT /api/me/saved`, `DELETE /api/me/saved/:id` y `DELETE /api/me` (elimina la cuenta).
- **Eventos y estadísticas** (`analytics.ts`): cada búsqueda se registra sin retrasar la respuesta (sin repetir la misma en 10 min). Nuevas rutas: `POST /api/events/click` (vista, sin repetir en 30 min), `DELETE /api/history`, `GET /api/stats/top-stores`, `GET /api/stats/trending?city=` y `GET /api/recommendations?city=`.
- **Recomendaciones** (`recommendations.ts`): puntaje por búsquedas (×1), vistas (×3) y guardados (×4), con decaimiento de 14 días. Las 3 principales se consultan en vivo en las tiendas.
- **Correo** con Gmail SMTP (`auth/mailer.ts`) y modo de desarrollo `MAIL_DEV_LOG`.
- **Límites por IP** con `@fastify/rate-limit` y errores en español (429 con `retry-after`). CORS ampliado a POST/PUT/DELETE con `Authorization` y `X-Device-Id`.
- Sin base de datos configurada, la búsqueda sigue igual y las rutas nuevas responden 503. `/api/health` informa `features.accounts`.
- Limpieza cada hora: códigos de más de 1 día, sesiones vencidas y eventos de más de 12 meses.
- **Disponibilidad por oferta** (`Offer.availability`: `delivery`, `pickup`, `no_delivery` o `unknown`). VTEX ya no descarta lo que no despacha: lo marca y explica. Los productos que la simulación reporta `withoutStock` sí se descartan.
- `cache-control` de `/api/search` cambia a `private` (la respuesta puede ir con sesión).

**Frontend**
- **Sesión:** slice `session`, token en `expo-secure-store` (localStorage en web) e identificador anónimo del dispositivo (`expo-crypto`).
- **Sincronización** con Redux listener middleware (`store/accountSync.ts`): sube los datos del invitado al entrar, recarga desde el servidor al abrir la app, envía cada cambio de guardados y preferencias (agrupando 800 ms) y borra los datos de la cuenta del dispositivo al salir. Un 401 cierra la sesión.
- **Pantallas nuevas:** `login` (correo → código de 6 dígitos con autocompletado, reenvío con cuenta regresiva y aceptación del aviso) y `privacy` (aviso de privacidad).
- **Ajustes → Cuenta:** entrar, cerrar sesión y eliminar la cuenta con confirmación. "Borrar historial" también borra en el servidor.
- **Buscar:** secciones "Recomendado para ti", "Lo más buscado en {ciudad}" (si aún no hay datos, se muestran las ideas de búsqueda) y "Tiendas más visitadas" (con barra proporcional y explicación de qué es una visita).
- **Aviso de despacho:** etiquetas "No se despacha a {ciudad}" y "Solo recogida en tienda" en la oferta, "N tiendas no lo despachan" en el producto y en el resumen, y filtro "Ocultar lo que no llega a mi ciudad". El ranking ordena por disponibilidad y calcula el puntaje y el ahorro solo entre lo que llega.
- Abrir "Ver en {tienda}" registra la vista sin retrasar la apertura.

**Verificación**
- Backend: 38 pruebas. Las 17 nuevas de integración corren sobre **PostgreSQL real (PGlite)** con el mismo `schema.sql`: código incorrecto, vencido, reutilizado o con demasiados intentos, límite de reenvío, privacidad, sesión y cierre, sincronización, eventos sin duplicar, mínimo de personas, vistas, recomendaciones, borrar historial (sin alterar los conteos), eliminar cuenta y modo sin base de datos. Typecheck OK.
- Frontend: 9 pruebas (incluye que lo que no llega nunca es la mejor opción y el filtro nuevo), typecheck y lint OK.
- Recorrido completo con el **servidor real** (driver `pg` contra PostgreSQL por TCP) y la app web en Chrome: búsqueda real → abrir oferta (vista registrada) → entrar con el código → recomendación "Porque viste ofertas de «freidora de aire»" → lo más buscado → top de tiendas → Leticia: "22 ofertas no llegan a domicilio a Leticia", con etiquetas y detalle "Ninguna tienda lo despacha" → recargar la página restaura la sesión.
- Configuración real verificada con `npm run check` (nuevo, `scripts/check-setup.ts`): conexión a Supabase con certificado verificado (PostgreSQL 17), 7 tablas presentes y credenciales de Gmail aceptadas.
- `.env.example` vuelve a ser solo una plantilla (sin valores reales) y advierte que los secretos van en `.env`.

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
1. Desplegar el backend (Render, Railway o Fly.io) con `TRUST_PROXY=true` y HTTPS, y definir `EXPO_PUBLIC_API_URL`. Builds con EAS. Con un dominio propio, pasar el correo a Resend/Brevo/SES.
2. Probar Mercado Libre con credenciales reales y ajustar su adaptador si hace falta.
3. Agregar más tiendas VTEX que se verifiquen públicas (basta una línea en `backend/src/stores/registry.ts`).
4. Historial de precios (caché L2, ya hay base de datos) con un gráfico en el detalle, y avisos cuando baja el precio de un guardado.
5. Filtros de color para daltonismo y opción de tipografía Atkinson Hyperlegible.
6. Pruebas de componentes con React Native Testing Library.
7. Recomendaciones colaborativas ("quienes buscaron X también buscaron Y") cuando haya suficientes usuarios.
8. Varias instancias del backend: mover el límite de peticiones y la caché a Redis.
