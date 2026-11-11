import type {
  Category,
  Criterion,
  Offer,
  ProductGroup,
  RankedGroup,
  RankedServiceOffer,
  Service,
  ServiceOffer,
  StoreId,
} from './types';

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

/** Costo Total = Precio Base + Costo Envío (ecuación 1 de la propuesta). */
export function totalCost(basePrice: number, shippingCost: number): number {
  return basePrice + shippingCost;
}

function minMax(values: number[]): [number, number] {
  return [Math.min(...values), Math.max(...values)];
}

function normalizeValue(value: number, [min, max]: [number, number]): number {
  return max === min ? 0 : (value - min) / (max - min);
}

/**
 * Puntaje multicriterio (menor = mejor). Normaliza costo y días al rango
 * [0,1] dentro del conjunto comparado y los pondera con el peso `w`.
 * Sobre la escala de días se aplica raíz cuadrada: pasar de 1 a 3 días
 * importa más que pasar de 15 a 17.
 */
export function scoreOffers(offers: Offer[], weight: number): Map<string, number> {
  const costRange = minMax(offers.map((o) => o.totalCost));
  const dayRange = minMax(offers.map((o) => Math.sqrt(o.deliveryDays)));
  const scores = new Map<string, number>();
  for (const o of offers) {
    const c = normalizeValue(o.totalCost, costRange);
    const d = normalizeValue(Math.sqrt(o.deliveryDays), dayRange);
    scores.set(o.id, weight * c + (1 - weight) * d);
  }
  return scores;
}

export function rankOffers(offers: Offer[], criterion: Criterion): Offer[] {
  const scores = scoreOffers(offers, CRITERION_WEIGHT[criterion]);
  return [...offers].sort(
    (a, b) =>
      scores.get(a.id)! - scores.get(b.id)! ||
      a.totalCost - b.totalCost ||
      a.deliveryDays - b.deliveryDays,
  );
}

export interface OfferFilters {
  maxBudget: number | null;
  stores: StoreId[];
  freeShippingOnly: boolean;
  maxDeliveryDays: number | null;
  categories: Category[];
}

export const DEFAULT_FILTERS: OfferFilters = {
  maxBudget: null,
  stores: [],
  freeShippingOnly: false,
  maxDeliveryDays: null,
  categories: [],
};

export function offerPassesFilters(offer: Offer, f: OfferFilters): boolean {
  if (f.stores.length > 0 && !f.stores.includes(offer.storeId)) return false;
  if (f.maxBudget !== null && offer.totalCost > f.maxBudget) return false;
  if (f.freeShippingOnly && offer.shippingCost > 0) return false;
  if (f.maxDeliveryDays !== null && offer.deliveryDays > f.maxDeliveryDays) return false;
  return true;
}

export function countActiveFilters(f: OfferFilters): number {
  return (
    (f.maxBudget !== null ? 1 : 0) +
    (f.stores.length > 0 ? 1 : 0) +
    (f.freeShippingOnly ? 1 : 0) +
    (f.maxDeliveryDays !== null ? 1 : 0) +
    (f.categories.length > 0 ? 1 : 0)
  );
}

export function rankGroup(group: ProductGroup, criterion: Criterion): RankedGroup {
  const offers = rankOffers(group.offers, criterion);
  const totals = offers.map((o) => o.totalCost);
  const [minTotal, maxTotal] = minMax(totals);
  return { ...group, offers, best: offers[0], minTotal, maxTotal, savings: maxTotal - offers[0].totalCost };
}

/**
 * Motor de filtrado multicriterio:
 * 1. Descarta ofertas que no cumplen los filtros del usuario.
 * 2. Ordena las ofertas de cada grupo según el criterio.
 * 3. Ordena los grupos comparando sus mejores ofertas con el mismo criterio
 *    (grupos con más tiendas desempatan, porque la comparación es más confiable).
 */
export function rankResults(groups: ProductGroup[], criterion: Criterion, filters: OfferFilters): RankedGroup[] {
  const ranked = groups
    .filter((g) => filters.categories.length === 0 || filters.categories.includes(g.category))
    .map((g) => ({ ...g, offers: g.offers.filter((o) => offerPassesFilters(o, filters)) }))
    .filter((g) => g.offers.length > 0)
    .map((g) => rankGroup(g, criterion));

  if (ranked.length === 0) return ranked;
  const bestScores = scoreOffers(
    ranked.map((g) => g.best),
    CRITERION_WEIGHT[criterion],
  );
  return ranked.sort(
    (a, b) =>
      bestScores.get(a.best.id)! - bestScores.get(b.best.id)! ||
      b.offers.length - a.offers.length ||
      a.name.localeCompare(b.name),
  );
}

/* ------------------------------ Servicios ------------------------------ */

export type ServiceSort = 'precio' | 'neto';

export function rankServiceOffers(
  offers: ServiceOffer[],
  services: Service[],
  sort: ServiceSort,
): RankedServiceOffer[] {
  const priceOf = (id: string) => services.find((s) => s.id === id)?.standalonePrice ?? 0;
  return offers
    .map((o) => {
      const includedValue = o.includes.reduce((acc, id) => acc + priceOf(id), 0);
      return { ...o, includedValue, netCost: Math.max(0, o.monthlyPrice - includedValue) };
    })
    .sort((a, b) =>
      sort === 'precio'
        ? a.monthlyPrice - b.monthlyPrice || a.netCost - b.netCost
        : a.netCost - b.netCost || a.monthlyPrice - b.monthlyPrice,
    );
}
