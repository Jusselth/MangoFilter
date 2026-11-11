/**
 * Contrato de la API de MangoFilter (esquema canónico, sección 3.2.2 de la
 * propuesta). Toda respuesta de una tienda se traduce a `Offer` antes de
 * entrar al motor de coincidencia. El frontend tiene una copia de estos tipos
 * en `frontend/src/api/types.ts`: si cambias uno, cambia el otro.
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
  /** Ofertas útiles devueltas (con despacho a la ciudad). */
  count: number;
  /** Productos encontrados que la tienda no despacha a la ciudad. */
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
