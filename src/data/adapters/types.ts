import type { CityId, Offer, StoreId } from '../../domain/types';

/**
 * Contrato de un adaptador de tienda (capa "Adaptadores REST/gRPC" de la
 * propuesta). Cada tienda responde con su propio formato (`Raw`); el
 * adaptador sabe consultarla y traducir su respuesta al esquema canónico.
 *
 * Para conectar una API real basta con implementar `fetchRaw` con `fetch`
 * hacia el endpoint de la tienda (o del API Gateway) sin tocar el resto.
 */
export interface StoreAdapter<Raw = unknown> {
  storeId: StoreId;
  /** TTL de la caché L1 para esta tienda (según qué tan seguido cambia sus precios). */
  cacheTtlMs: number;
  fetchRaw(query: string, signal: AbortSignal): Promise<Raw[]>;
  normalize(raw: Raw, city: CityId): Offer;
}

/** Simula la latencia de red de una API remota respetando la cancelación. */
export function simulateNetwork<T>(value: T, latencyMs: number, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('aborted'));
      return;
    }
    const timer = setTimeout(() => resolve(value), latencyMs);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new Error('aborted'));
    });
  });
}

/** URL de búsqueda en la tienda (no tenemos permalinks reales en modo demo). */
export function storeSearchUrl(storeId: StoreId, title: string): string {
  const q = encodeURIComponent(title);
  switch (storeId) {
    case 'mercadolibre':
      return `https://listado.mercadolibre.com.co/${q}`;
    case 'falabella':
      return `https://www.falabella.com.co/falabella-co/search?Ntt=${q}`;
    case 'aliexpress':
      return `https://www.aliexpress.com/wholesale?SearchText=${q}`;
    case 'homecenter':
      return `https://www.homecenter.com.co/homecenter-co/search?Ntt=${q}`;
    case 'alkosto':
      return `https://www.alkosto.com/search?text=${q}`;
  }
}
