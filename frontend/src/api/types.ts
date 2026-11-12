/**
 * Contrato de la API de MangoFilter. COPIA de `backend/src/domain/types.ts`:
 * si cambias uno, cambia el otro. El frontend NO tiene datos propios: todo
 * llega del backend, que consulta las tiendas reales.
 */

export interface StoreRef {
  id: string;
  name: string;
  /** Iniciales para el "logo" textual. */
  short: string;
  /** Color identificador (decorativo). */
  color: string;
  website: string;
}

export interface City {
  id: string;
  name: string;
  department: string;
  /** Código DANE del municipio: VTEX Colombia lo usa como código postal. */
  dane: string;
  /** Código postal de 6 dígitos (4-72), usado por Mercado Libre. */
  postal: string;
}

/**
 * Disponibilidad de la oferta para la ciudad consultada (según la simulación de la tienda):
 *  - delivery:    la tienda despacha a domicilio a la ciudad (envío cotizado).
 *  - pickup:      no despacha a domicilio; solo se puede recoger en una tienda física de la ciudad.
 *  - no_delivery: la tienda no despacha este producto a la ciudad.
 *  - unknown:     no se pudo cotizar (la simulación falló); se confirma en la tienda.
 */
export type Availability = 'delivery' | 'pickup' | 'no_delivery' | 'unknown';

/** Oferta normalizada: una publicación de un producto en una tienda. */
export interface Offer {
  /** ID_Interno: `${storeId}:${skuId}` */
  id: string;
  store: StoreRef;
  /** Título tal como lo publica la tienda. */
  title: string;
  /** Nombre Normalizado (tokens significativos ordenados). */
  normalizedTitle: string;
  brand: string | null;
  /** Categoría según la tienda (solo informativa: cada tienda usa su taxonomía). */
  category: string | null;
  imageUrl: string | null;
  /** Enlace directo a la publicación en la tienda. */
  url: string;
  /** Precio Base en COP para la ciudad consultada. */
  basePrice: number;
  /** Precio antes de descuento, si la tienda lo informa. */
  listPrice: number | null;
  /** Costo de envío en COP a la ciudad; null si la tienda no lo informó. */
  shippingCost: number | null;
  /** Días hábiles estimados; null si la tienda no lo informó. */
  deliveryDays: number | null;
  /** true si el envío viene de la tienda (cotización real para la ciudad). */
  shippingKnown: boolean;
  /** Si la oferta llega o no a la ciudad. Solo `delivery` (o `unknown`) puede ser la "mejor opción". */
  availability: Availability;
  /** Costo Total = Precio Base + Costo Envío (ecuación 1). Si el envío es desconocido, solo el precio. */
  totalCost: number;
  /** Posición en los resultados de la tienda (0 = más relevante). */
  position: number;
  notes: string[];
}

export interface ProductGroup {
  id: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  offers: Offer[];
}

export interface StoreStatus {
  store: StoreRef;
  status: 'ok' | 'timeout' | 'error';
  /** Ofertas devueltas (incluye las marcadas como `pickup` o `no_delivery`). */
  count: number;
  /** Cuántas de esas ofertas NO llegan a domicilio a la ciudad (`pickup` + `no_delivery`). */
  notShippable: number;
  latencyMs: number;
  fromCache: boolean;
  message?: string;
}

export interface SearchResponse {
  query: string;
  city: City;
  groups: ProductGroup[];
  stores: StoreStatus[];
  tookMs: number;
  /** ISO 8601: momento en que se consultaron las tiendas. */
  fetchedAt: string;
}

/* ------------------------------------------------------------------------- */
/* Cuentas, estadísticas y recomendaciones.                                   */
/* Copia de backend/src/auth/service.ts (User), backend/src/userData.ts,      */
/* backend/src/routes/activity.ts y backend/src/recommendations.ts.           */
/* ------------------------------------------------------------------------- */

export interface AccountUser {
  id: string;
  email: string;
  createdAt: string;
}

export interface AccountPreferences {
  city: string;
  cityName: string;
  criterion: 'precio' | 'equilibrado' | 'rapidez';
  themeMode: 'system' | 'light' | 'dark';
  haptics: boolean;
}

export interface AccountSavedProduct {
  id: string;
  name: string;
  imageUrl: string | null;
  query: string;
  bestTotalAtSave: number;
  /** Epoch en milisegundos. */
  savedAt: number;
}

/** GET /api/me y POST /api/me/sync */
export interface AccountData {
  user: AccountUser;
  preferences: AccountPreferences | null;
  saved: AccountSavedProduct[];
  /** Búsquedas recientes (más reciente primero). */
  history: string[];
}

export interface VerifyResponse {
  token: string;
  user: AccountUser;
  isNew: boolean;
}

export interface HealthResponse {
  ok: boolean;
  stores: string[];
  features: { accounts: boolean };
  time: string;
}

export interface TopStoresResponse {
  days: number;
  totalViews: number;
  stores: { store: StoreRef; views: number; people: number }[];
}

export interface TrendingResponse {
  city: City;
  days: number;
  minPeople: number;
  queries: { query: string; people: number; searches: number }[];
}

export interface Recommendation {
  query: string;
  reason: string;
  group: ProductGroup;
}

export interface RecommendationsResponse {
  city: City;
  items: Recommendation[];
}
