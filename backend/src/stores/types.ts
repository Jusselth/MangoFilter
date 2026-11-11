import type { City, Offer, StoreRef } from '../domain/types.js';

/** Resultado de consultar UNA tienda para una búsqueda y ciudad. */
export interface StoreSearchResult {
  offers: Offer[];
  /** Productos que respondían a la búsqueda pero la tienda no despacha a la ciudad. */
  notShippable: number;
  fromCache: boolean;
}

/**
 * Contrato de un adaptador de tienda (capa "Adaptadores REST" de la propuesta).
 * Cada adaptador sabe consultar su tienda y traducir la respuesta cruda al
 * esquema canónico `Offer`, incluyendo el envío real a la ciudad.
 */
export interface StoreAdapter {
  store: StoreRef;
  search(query: string, city: City, signal: AbortSignal): Promise<StoreSearchResult>;
}
