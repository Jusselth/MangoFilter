/**
 * Esquema canónico de MangoFilter (sección 3.2.2 de la propuesta).
 * Toda respuesta de una tienda, sin importar su forma original, se transforma
 * a `Offer` antes de entrar al motor de coincidencia y de filtrado.
 */

export type StoreId = 'mercadolibre' | 'falabella' | 'aliexpress' | 'homecenter' | 'alkosto';

export type Category = 'tecnologia' | 'hogar' | 'vestuario' | 'deporte';

export type CityId =
  | 'bogota'
  | 'medellin'
  | 'cali'
  | 'barranquilla'
  | 'bucaramanga'
  | 'pereira'
  | 'pasto'
  | 'leticia';

export type Zone = 'principal' | 'intermedia' | 'remota';

/** Oferta normalizada: una publicación de un producto en una tienda. */
export interface Offer {
  /** ID_Interno: `${storeId}:${skuOriginal}` */
  id: string;
  storeId: StoreId;
  /** Título tal como lo publica la tienda (para mostrar). */
  title: string;
  /** Nombre Normalizado: minúsculas, sin tildes, sin ruido comercial. */
  normalizedTitle: string;
  brand: string | null;
  category: Category;
  /** Precio Base en COP (ya convertido si la tienda publica en otra moneda). */
  basePrice: number;
  /** Precio antes de descuento, si la tienda lo informa. */
  listPrice: number | null;
  /** Costo Envio en COP calculado para la ciudad del usuario. */
  shippingCost: number;
  /** Tiempo Entrega estimado en días hábiles. */
  deliveryDays: number;
  /** Costo Total = Precio Base + Costo Envío (ecuación 1). */
  totalCost: number;
  url: string;
  /** Artículo voluminoso: afecta la tarifa logística. */
  bulky: boolean;
  /** Notas adicionales (ej. "Importado: puede generar impuestos"). */
  notes: string[];
}

/** Resultado del Entity Resolution: el mismo producto en varias tiendas. */
export interface ProductGroup {
  id: string;
  name: string;
  brand: string | null;
  category: Category;
  offers: Offer[];
}

/** Grupo ya evaluado con el criterio del usuario. */
export interface RankedGroup extends ProductGroup {
  /** Ofertas ordenadas de mejor a peor según el criterio. */
  offers: Offer[];
  best: Offer;
  minTotal: number;
  maxTotal: number;
  /** Diferencia entre la oferta más cara y la mejor (lo que ahorras). */
  savings: number;
}

/** Peso del precio frente al tiempo de entrega (0 = solo rapidez, 1 = solo precio). */
export type Criterion = 'precio' | 'equilibrado' | 'rapidez';

export interface StoreStatus {
  storeId: StoreId;
  status: 'ok' | 'timeout' | 'error';
  count: number;
  latencyMs: number;
  fromCache: boolean;
}

export interface SearchResult {
  query: string;
  city: CityId;
  groups: ProductGroup[];
  stores: StoreStatus[];
  tookMs: number;
}

/* ---------------------------- Servicios ---------------------------- */

export type ServiceCategory = 'streaming' | 'musica' | 'hogar' | 'conectividad';

export interface Service {
  id: string;
  name: string;
  category: ServiceCategory;
  description: string;
  /** Precio mensual contratando directamente con el proveedor. */
  standalonePrice: number;
}

export interface ServiceOffer {
  id: string;
  serviceId: string;
  provider: string;
  planName: string;
  monthlyPrice: number;
  /** Otros servicios incluidos en el mismo paquete (ids de `Service`). */
  includes: string[];
  benefits: string[];
  /** Meses de permanencia mínima (0 = sin permanencia). */
  commitmentMonths: number;
  url: string;
}

export interface RankedServiceOffer extends ServiceOffer {
  /** Valor de los servicios adicionales si se pagaran por separado. */
  includedValue: number;
  /** Costo neto = precio mensual - valor incluido (mínimo 0). */
  netCost: number;
}
