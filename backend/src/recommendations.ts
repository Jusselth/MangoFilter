import type { Aggregator } from './aggregator.js';
import type { Actor, Analytics, SearchSignal } from './analytics.js';
import type { City, ProductGroup } from './domain/types.js';

export interface Recommendation {
  /** Búsqueda de la que sale la recomendación (para abrir la comparación). */
  query: string;
  /** Explicación honesta de por qué se recomienda. */
  reason: string;
  group: ProductGroup;
}

export const MAX_RECOMMENDATIONS = 3;

export function reasonFor(s: SearchSignal): string {
  if (s.saved > 0) return `Porque guardaste productos de «${s.query}»`;
  if (s.clicks > 0) return `Porque viste ofertas de «${s.query}»`;
  if (s.searches > 1) return `Porque buscaste «${s.query}» ${s.searches} veces`;
  return `Porque buscaste «${s.query}»`;
}

/**
 * Recomendación personalizada basada en contenido: toma los intereses reales
 * del usuario (búsquedas, vistas y guardados, con más peso a lo reciente) y
 * consulta EN VIVO las tiendas para mostrar la mejor opción actual de cada
 * interés en su ciudad. No hay catálogo propio ni datos inventados: si el
 * usuario no tiene actividad, no hay recomendaciones.
 */
export async function buildRecommendations(params: {
  analytics: Analytics;
  aggregator: Aggregator;
  actor: Actor;
  city: City;
  /** IDs de productos ya guardados (no se recomiendan de nuevo). */
  excludeIds: Set<string>;
}): Promise<Recommendation[]> {
  const { analytics, aggregator, actor, city, excludeIds } = params;
  const signals = (await analytics.interestSignals(actor, 6)).slice(0, MAX_RECOMMENDATIONS);
  const results = await Promise.all(signals.map((s) => aggregator.search(s.query, city).catch(() => null)));

  const used = new Set<string>();
  const out: Recommendation[] = [];
  signals.forEach((signal, i) => {
    const group = results[i]?.groups.find(
      (g) =>
        !used.has(g.id) &&
        !excludeIds.has(g.id) &&
        !g.offers.some((o) => excludeIds.has(o.id)) &&
        // Solo productos que de verdad pueden llegar a la ciudad.
        g.offers.some((o) => o.availability === 'delivery' || o.availability === 'unknown'),
    );
    if (!group) return;
    used.add(group.id);
    out.push({ query: signal.query, reason: reasonFor(signal), group });
  });
  return out;
}
