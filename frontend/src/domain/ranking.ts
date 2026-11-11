import type { Offer, ProductGroup } from '../api/types';

/**
 * Motor de filtrado multicriterio (sección 3.2.4 de la propuesta). Corre en el
 * cliente sobre los grupos que entrega el backend, así cambiar el criterio o
 * un filtro reordena al instante sin volver a consultar las tiendas.
 */
export type Criterion = 'precio' | 'equilibrado' | 'rapidez';

/** Peso del Costo Total frente al Tiempo Estimado de Entrega. */
export const CRITERION_WEIGHT: Record<Criterion, number> = {
  precio: 1,
  equilibrado: 0.5,
  rapidez: 0.15,
};

export const CRITERION_LABEL: Record<Criterion, string> = {
  precio: 'Menor precio',
  equilibrado: 'Equilibrado',
  rapidez: 'Llega antes',
};

export const CRITERIA = (Object.keys(CRITERION_LABEL) as Criterion[]).map((value) => ({ value, label: CRITERION_LABEL[value] }));

export interface RankedGroup extends ProductGroup {
  /** Ofertas ordenadas de mejor a peor según el criterio. */
  offers: Offer[];
  best: Offer;
  minTotal: number;
  maxTotal: number;
  /** Diferencia entre la oferta más cara y la mejor. */
  savings: number;
}

/** Días usados para puntuar cuando la tienda no informó el tiempo de entrega. */
const UNKNOWN_DAYS = 15;

function minMax(values: number[]): [number, number] {
  return [Math.min(...values), Math.max(...values)];
}

function normalizeValue(value: number, [min, max]: [number, number]): number {
  return max === min ? 0 : (value - min) / (max - min);
}

const daysOf = (o: Offer) => o.deliveryDays ?? UNKNOWN_DAYS;

/**
 * Puntaje (menor = mejor): w · costoNorm + (1 − w) · díasNorm, con min-max
 * dentro del conjunto comparado. Raíz cuadrada en los días: pasar de 1 a 3
 * días importa más que de 15 a 17.
 */
export function scoreOffers(offers: Offer[], weight: number): Map<string, number> {
  const costRange = minMax(offers.map((o) => o.totalCost));
  const dayRange = minMax(offers.map((o) => Math.sqrt(daysOf(o))));
  const scores = new Map<string, number>();
  for (const o of offers) {
    const c = normalizeValue(o.totalCost, costRange);
    const d = normalizeValue(Math.sqrt(daysOf(o)), dayRange);
    scores.set(o.id, weight * c + (1 - weight) * d);
  }
  return scores;
}

/**
 * Ordena ofertas. Las que tienen envío confirmado van primero: una oferta con
 * envío desconocido no puede ser "la mejor" porque su total podría subir.
 */
export function rankOffers(offers: Offer[], criterion: Criterion): Offer[] {
  const scores = scoreOffers(offers, CRITERION_WEIGHT[criterion]);
  return [...offers].sort(
    (a, b) =>
      Number(b.shippingKnown) - Number(a.shippingKnown) ||
      scores.get(a.id)! - scores.get(b.id)! ||
      a.totalCost - b.totalCost ||
      daysOf(a) - daysOf(b),
  );
}

export interface OfferFilters {
  maxBudget: number | null;
  /** IDs de tienda; vacío = todas. */
  stores: string[];
  freeShippingOnly: boolean;
  maxDeliveryDays: number | null;
}

export const DEFAULT_FILTERS: OfferFilters = {
  maxBudget: null,
  stores: [],
  freeShippingOnly: false,
  maxDeliveryDays: null,
};

export function offerPassesFilters(offer: Offer, f: OfferFilters): boolean {
  if (f.stores.length > 0 && !f.stores.includes(offer.store.id)) return false;
  if (f.maxBudget !== null && offer.totalCost > f.maxBudget) return false;
  if (f.freeShippingOnly && offer.shippingCost !== 0) return false;
  if (f.maxDeliveryDays !== null && (offer.deliveryDays === null || offer.deliveryDays > f.maxDeliveryDays)) return false;
  return true;
}

export function countActiveFilters(f: OfferFilters): number {
  return (f.maxBudget !== null ? 1 : 0) + (f.stores.length > 0 ? 1 : 0) + (f.freeShippingOnly ? 1 : 0) + (f.maxDeliveryDays !== null ? 1 : 0);
}

export function rankGroup(group: ProductGroup, criterion: Criterion): RankedGroup {
  const offers = rankOffers(group.offers, criterion);
  const [minTotal, maxTotal] = minMax(offers.map((o) => o.totalCost));
  return { ...group, offers, best: offers[0], minTotal, maxTotal, savings: maxTotal - offers[0].totalCost };
}

/**
 * 1. Descarta ofertas que no cumplen los filtros (y productos sin ofertas).
 * 2. Ordena las ofertas de cada producto según el criterio → "mejor opción".
 *
 * El ORDEN DE LA LISTA se conserva tal como lo entrega el backend (relevancia
 * según las tiendas). Ordenar todo por precio pondría primero accesorios
 * baratos ("cargador para iPhone" antes que el iPhone).
 */
export function rankResults(groups: ProductGroup[], criterion: Criterion, filters: OfferFilters): RankedGroup[] {
  return groups
    .map((g) => ({ ...g, offers: g.offers.filter((o) => offerPassesFilters(o, filters)) }))
    .filter((g) => g.offers.length > 0)
    .map((g) => rankGroup(g, criterion));
}
