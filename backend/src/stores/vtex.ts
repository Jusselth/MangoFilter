/**
 * Adaptador genérico para tiendas sobre VTEX (Olímpica, Jumbo, Carulla,
 * Pepe Ganga, Panamericana...). Usa dos APIs PÚBLICAS de VTEX, las mismas que
 * usan las páginas web de cada tienda, sin autenticación:
 *
 *  1. Intelligent Search  GET  /api/io/_v/api/intelligent-search/product_search/
 *     → productos, precio publicado, imagen y enlace.
 *  2. Simulación de carrito POST /api/checkout/pub/orderForms/simulation
 *     → precio REAL para la ciudad + opciones de envío (costo y días hábiles).
 *     VTEX Colombia usa el código DANE del municipio como `postalCode`.
 *
 * Docs: https://developers.vtex.com/docs/api-reference/intelligent-search-api
 *       https://developers.vtex.com/docs/api-reference/checkout-api#post-/api/checkout/pub/orderForms/simulation
 */
import { TtlCache } from '../cache.js';
import { detectBrand, matchesQuery, normalizeBrand, normalizeTitle } from '../domain/normalize.js';
import type { City, Offer, StoreRef } from '../domain/types.js';
import { fetchJson } from '../http.js';
import type { StoreAdapter, StoreSearchResult } from './types.js';

/* ------------------------- Formas crudas de VTEX ------------------------- */

export interface VtexCommercialOffer {
  Price: number;
  ListPrice: number;
  AvailableQuantity: number;
}

export interface VtexSeller {
  sellerId: string;
  sellerName: string;
  sellerDefault: boolean;
  commertialOffer: VtexCommercialOffer;
}

export interface VtexItem {
  itemId: string;
  nameComplete?: string;
  images: { imageUrl: string }[];
  sellers: VtexSeller[];
}

export interface VtexProduct {
  productId: string;
  productName: string;
  brand: string;
  link: string;
  linkText: string;
  categories?: string[];
  items: VtexItem[];
}

export interface VtexSearchResponse {
  products: VtexProduct[];
  recordsFiltered?: number;
}

export interface VtexSla {
  id: string;
  name: string;
  deliveryChannel: 'delivery' | 'pickup-in-point' | string;
  price: number; // centavos
  shippingEstimate: string; // "3bd", "5d", "24h"
}

export interface VtexSimulationResponse {
  items?: { id: string; requestIndex: number; seller: string; sellingPrice: number; price: number; listPrice: number; availability?: string }[];
  logisticsInfo?: { itemIndex: number; slas: VtexSla[] }[];
  messages?: { code: string; text: string }[];
}

/* ------------------------------ Utilidades ------------------------------- */

/** "3bd" → 3 · "5d" → 5 · "24h" → 1. Devuelve null si no se puede interpretar. */
export function parseShippingEstimate(estimate: string | undefined): number | null {
  const m = /^(\d+)\s*(bd|d|h|m)$/.exec(estimate ?? '');
  if (!m) return null;
  const n = Number(m[1]);
  if (m[2] === 'h') return Math.max(1, Math.ceil(n / 24));
  if (m[2] === 'm') return 1;
  return Math.max(1, n);
}

/** Toma la categoría más general ("/Tecnología/Audio/" → "Tecnología"). */
function topCategory(categories: string[] | undefined): string | null {
  const last = categories?.[categories.length - 1];
  const name = last?.split('/').filter(Boolean)[0];
  return name ?? null;
}

interface Candidate {
  /** Posición del producto en la respuesta de la tienda (relevancia). */
  position: number;
  product: VtexProduct;
  item: VtexItem;
  seller: VtexSeller;
}

/** Elige el SKU y vendedor que realmente se pueden comprar (con stock y precio > 0). */
function pickCandidate(product: VtexProduct, position: number): Candidate | null {
  for (const item of product.items ?? []) {
    const sellers = [...(item.sellers ?? [])].sort((a, b) => Number(b.sellerDefault) - Number(a.sellerDefault));
    const seller = sellers.find((s) => s.commertialOffer?.AvailableQuantity > 0 && s.commertialOffer?.Price > 0);
    if (seller) return { position, product, item, seller };
  }
  return null;
}

/* ------------------------------- Adaptador ------------------------------- */

export interface VtexStoreConfig extends StoreRef {
  /** Canal de venta (sales channel). */
  salesChannel?: string;
  /** Máximo de productos a pedir por búsqueda. */
  maxResults?: number;
}

export interface VtexDeps {
  fetchJson?: typeof fetchJson;
  timeoutMs?: number;
  searchCache?: TtlCache<VtexSearchResponse>;
  simulationCache?: TtlCache<VtexSimulationResponse>;
}

const SEARCH_TTL = 10 * 60_000;
const SIMULATION_TTL = 15 * 60_000;

export function createVtexAdapter(config: VtexStoreConfig, deps: VtexDeps = {}): StoreAdapter {
  const http = deps.fetchJson ?? fetchJson;
  const timeoutMs = deps.timeoutMs ?? 6_000;
  const searchCache = deps.searchCache ?? new TtlCache<VtexSearchResponse>(200);
  const simulationCache = deps.simulationCache ?? new TtlCache<VtexSimulationResponse>(500);
  const sc = config.salesChannel ?? '1';
  const count = config.maxResults ?? 12;
  const store: StoreRef = { id: config.id, name: config.name, short: config.short, color: config.color, website: config.website };

  async function searchRaw(query: string, signal: AbortSignal): Promise<{ data: VtexSearchResponse; cached: boolean }> {
    const cached = searchCache.get(query);
    if (cached) return { data: cached, cached: true };
    const url =
      `${config.website}/api/io/_v/api/intelligent-search/product_search/` +
      `?query=${encodeURIComponent(query)}&count=${count}&page=1&locale=es-CO&hideUnavailableItems=true`;
    const data = await http<VtexSearchResponse>(url, { timeoutMs, signal });
    searchCache.set(query, data, SEARCH_TTL);
    return { data, cached: false };
  }

  async function simulate(candidates: Candidate[], city: City, signal: AbortSignal): Promise<VtexSimulationResponse> {
    const items = candidates.map((c) => ({ id: c.item.itemId, quantity: 1, seller: c.seller.sellerId }));
    const key = `${city.dane}|${items.map((i) => `${i.id}@${i.seller}`).join(',')}`;
    const cached = simulationCache.get(key);
    if (cached) return cached;
    const data = await http<VtexSimulationResponse>(`${config.website}/api/checkout/pub/orderForms/simulation?sc=${sc}`, {
      method: 'POST',
      body: { items, country: 'COL', postalCode: city.dane },
      timeoutMs,
      signal,
    });
    simulationCache.set(key, data, SIMULATION_TTL);
    return data;
  }

  return {
    store,
    async search(query, city, signal): Promise<StoreSearchResult> {
      const { data, cached } = await searchRaw(query, signal);

      // Intelligent Search devuelve también accesorios relacionados ("soporte para TV"):
      // se conservan solo los productos cuyo nombre contiene todos los términos.
      const candidates = (data.products ?? [])
        .map((p, position) => (matchesQuery(p.productName, query) ? pickCandidate(p, position) : null))
        .filter((c): c is Candidate => c !== null);

      if (candidates.length === 0) return { offers: [], notShippable: 0, fromCache: cached };

      let sim: VtexSimulationResponse | null = null;
      try {
        sim = await simulate(candidates, city, signal);
      } catch {
        sim = null; // Sin simulación se usa el precio publicado y el envío queda "por confirmar".
      }

      const offers: Offer[] = [];
      let notShippable = 0;

      candidates.forEach((c, index) => {
        const published = c.seller.commertialOffer;
        let basePrice = published.Price;
        let listPrice: number | null = published.ListPrice > published.Price ? published.ListPrice : null;
        let shippingCost: number | null = null;
        let deliveryDays: number | null = null;
        let shippingKnown = false;
        const notes: string[] = [];

        if (sim) {
          const simItem = sim.items?.find((i) => i.requestIndex === index);
          const slas = (sim.logisticsInfo?.find((l) => l.itemIndex === index)?.slas ?? []).filter(
            (s) => s.deliveryChannel === 'delivery',
          );
          if (!simItem || simItem.sellingPrice <= 0 || slas.length === 0) {
            notShippable++;
            return; // La tienda no despacha este producto a la ciudad.
          }
          // Precio regional real (algunas tiendas cambian el precio según la ciudad).
          basePrice = simItem.sellingPrice / 100;
          listPrice = simItem.listPrice > simItem.sellingPrice ? simItem.listPrice / 100 : null;
          const cheapest = [...slas].sort(
            (a, b) =>
              a.price - b.price ||
              (parseShippingEstimate(a.shippingEstimate) ?? 99) - (parseShippingEstimate(b.shippingEstimate) ?? 99),
          )[0];
          shippingCost = Math.round(cheapest.price / 100);
          deliveryDays = parseShippingEstimate(cheapest.shippingEstimate);
          shippingKnown = true;
        } else {
          notes.push('No pudimos cotizar el envío: se calcula en la tienda.');
        }

        if (c.seller.sellerId !== '1' && c.seller.sellerName) notes.push(`Vendido por ${c.seller.sellerName}.`);

        const brand = normalizeBrand(c.product.brand) ?? detectBrand(c.product.productName);
        offers.push({
          id: `${config.id}:${c.item.itemId}`,
          store,
          title: c.product.productName.trim(),
          normalizedTitle: normalizeTitle(c.product.productName),
          brand,
          category: topCategory(c.product.categories),
          imageUrl: c.item.images?.[0]?.imageUrl ?? null,
          url: `${config.website}${c.product.link ?? `/${c.product.linkText}/p`}`,
          basePrice: Math.round(basePrice),
          listPrice: listPrice ? Math.round(listPrice) : null,
          shippingCost,
          deliveryDays,
          shippingKnown,
          totalCost: Math.round(basePrice) + (shippingCost ?? 0),
          position: c.position,
          notes,
        });
      });

      return { offers, notShippable, fromCache: cached };
    },
  };
}
