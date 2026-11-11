/**
 * Adaptadores de DEMOSTRACIÓN para cada tienda. Cada uno expone la respuesta
 * en un formato distinto, como pasaría con las APIs reales, y la traduce al
 * esquema canónico `Offer`.
 */
import { quoteShipping, USD_TO_COP } from '../../domain/logistics';
import { detectBrand, matchesQuery, normalizeTitle } from '../../domain/normalize';
import { totalCost } from '../../domain/ranking';
import type { Category, CityId, Offer, StoreId } from '../../domain/types';
import { SEED_CATALOG } from '../seed/catalog';
import { simulateNetwork, storeSearchUrl, type StoreAdapter } from './types';

/** Recorre el catálogo semilla y devuelve las publicaciones de una tienda que responden a la búsqueda. */
function seedListings(storeId: StoreId, query: string) {
  return SEED_CATALOG.flatMap((product, index) => {
    const listing = product.listings[storeId];
    if (!listing || !matchesQuery(listing[0], query)) return [];
    const [title, price, listPrice] = listing;
    return [{ index, title, price, listPrice: listPrice ?? null, category: product.category, bulky: !!product.bulky }];
  });
}

function buildOffer(params: {
  storeId: StoreId;
  sku: string;
  title: string;
  basePrice: number;
  listPrice: number | null;
  category: Category;
  bulky: boolean;
  city: CityId;
  url: string;
  notes?: string[];
}): Offer {
  const basePrice = Math.round(params.basePrice);
  const shipping = quoteShipping(params.storeId, basePrice, params.city, params.bulky);
  return {
    id: `${params.storeId}:${params.sku}`,
    storeId: params.storeId,
    title: params.title.trim(),
    normalizedTitle: normalizeTitle(params.title),
    brand: detectBrand(params.title),
    category: params.category,
    basePrice,
    listPrice: params.listPrice !== null && params.listPrice > basePrice ? Math.round(params.listPrice) : null,
    shippingCost: shipping.cost,
    deliveryDays: shipping.days,
    totalCost: totalCost(basePrice, shipping.cost),
    url: params.url,
    bulky: params.bulky,
    notes: params.notes ?? [],
  };
}

/* ----------------------------- Mercado Libre ----------------------------- */
// Forma inspirada en /sites/MCO/search: { id, title, price, original_price, currency_id, ... }
interface MeliItem {
  id: string;
  title: string;
  price: number;
  original_price: number | null;
  currency_id: 'COP';
  permalink: string;
  category_id: string;
  attributes: { id: string; value_name: string }[];
}

const MELI_CATEGORY: Record<string, Category> = {
  MCO1648: 'tecnologia',
  MCO1574: 'hogar',
  MCO1276: 'deporte',
  MCO1430: 'vestuario',
};
const CATEGORY_TO_MELI = Object.fromEntries(Object.entries(MELI_CATEGORY).map(([k, v]) => [v, k])) as Record<Category, string>;

export const mercadoLibreAdapter: StoreAdapter<MeliItem> = {
  storeId: 'mercadolibre',
  cacheTtlMs: 2 * 60_000, // marketplace: precios muy volátiles
  fetchRaw(query, signal) {
    const items: MeliItem[] = seedListings('mercadolibre', query).map((l) => ({
      id: `MCO${1_000_000 + l.index * 37}`,
      title: l.title,
      price: l.price,
      original_price: l.listPrice,
      currency_id: 'COP',
      permalink: storeSearchUrl('mercadolibre', l.title),
      category_id: CATEGORY_TO_MELI[l.category],
      attributes: [{ id: 'SHIPPING_SIZE', value_name: l.bulky ? 'BULKY' : 'STANDARD' }],
    }));
    return simulateNetwork(items, 420, signal);
  },
  normalize(raw, city) {
    return buildOffer({
      storeId: 'mercadolibre',
      sku: raw.id,
      title: raw.title,
      basePrice: raw.price,
      listPrice: raw.original_price,
      category: MELI_CATEGORY[raw.category_id] ?? 'tecnologia',
      bulky: raw.attributes.some((a) => a.id === 'SHIPPING_SIZE' && a.value_name === 'BULKY'),
      city,
      url: raw.permalink,
    });
  },
};

/* ------------------------------- Falabella ------------------------------- */
// Precios como texto con separador de miles y lista de tipos de precio.
interface FalabellaProduct {
  skuId: string;
  displayName: string;
  prices: { type: 'internetPrice' | 'normalPrice'; price: string[] }[];
  url: string;
  topCategory: 'Tecnología' | 'Hogar' | 'Deportes' | 'Moda';
  isBigTicket: boolean;
}

const FALABELLA_CATEGORY: Record<FalabellaProduct['topCategory'], Category> = {
  Tecnología: 'tecnologia',
  Hogar: 'hogar',
  Deportes: 'deporte',
  Moda: 'vestuario',
};
const CATEGORY_TO_FALABELLA = Object.fromEntries(
  Object.entries(FALABELLA_CATEGORY).map(([k, v]) => [v, k]),
) as Record<Category, FalabellaProduct['topCategory']>;

const formatThousands = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const parseThousands = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'));

export const falabellaAdapter: StoreAdapter<FalabellaProduct> = {
  storeId: 'falabella',
  cacheTtlMs: 10 * 60_000,
  fetchRaw(query, signal) {
    const items = seedListings('falabella', query).map((l) => ({
      skuId: `${88_000_000 + l.index * 113}`,
      displayName: l.title,
      prices: [
        { type: 'internetPrice' as const, price: [formatThousands(l.price)] },
        ...(l.listPrice ? [{ type: 'normalPrice' as const, price: [formatThousands(l.listPrice)] }] : []),
      ],
      url: storeSearchUrl('falabella', l.title),
      topCategory: CATEGORY_TO_FALABELLA[l.category],
      isBigTicket: l.bulky,
    }));
    return simulateNetwork(items, 650, signal);
  },
  normalize(raw, city) {
    const internet = raw.prices.find((p) => p.type === 'internetPrice');
    const normal = raw.prices.find((p) => p.type === 'normalPrice');
    return buildOffer({
      storeId: 'falabella',
      sku: raw.skuId,
      title: raw.displayName,
      basePrice: parseThousands((internet ?? normal ?? { price: ['0'] }).price[0]),
      listPrice: normal ? parseThousands(normal.price[0]) : null,
      category: FALABELLA_CATEGORY[raw.topCategory],
      bulky: raw.isBigTicket,
      city,
      url: raw.url,
    });
  },
};

/* ------------------------------- AliExpress ------------------------------ */
// Precio en USD como objeto { amount, currency }; títulos en inglés.
interface AliProduct {
  productId: number;
  subject: string;
  salePrice: { amount: number; currency: 'USD' };
  originalPrice: { amount: number; currency: 'USD' } | null;
  detailUrl: string;
  categoryPath: string;
  oversize: 0 | 1;
}

const ALI_CATEGORY: Record<string, Category> = {
  'Consumer Electronics': 'tecnologia',
  'Home & Garden': 'hogar',
  'Sports & Entertainment': 'deporte',
  Apparel: 'vestuario',
};
const CATEGORY_TO_ALI = Object.fromEntries(Object.entries(ALI_CATEGORY).map(([k, v]) => [v, k])) as Record<Category, string>;

export const aliExpressAdapter: StoreAdapter<AliProduct> = {
  storeId: 'aliexpress',
  cacheTtlMs: 30 * 60_000,
  fetchRaw(query, signal) {
    const items: AliProduct[] = seedListings('aliexpress', query).map((l) => ({
      productId: 1_005_006_000_000 + l.index * 7919,
      subject: l.title,
      salePrice: { amount: l.price, currency: 'USD' },
      originalPrice: l.listPrice ? { amount: l.listPrice, currency: 'USD' } : null,
      detailUrl: storeSearchUrl('aliexpress', l.title),
      categoryPath: CATEGORY_TO_ALI[l.category],
      oversize: l.bulky ? 1 : 0,
    }));
    return simulateNetwork(items, 1_100, signal);
  },
  normalize(raw, city) {
    return buildOffer({
      storeId: 'aliexpress',
      sku: String(raw.productId),
      title: raw.subject,
      basePrice: raw.salePrice.amount * USD_TO_COP,
      listPrice: raw.originalPrice ? raw.originalPrice.amount * USD_TO_COP : null,
      category: ALI_CATEGORY[raw.categoryPath] ?? 'tecnologia',
      bulky: raw.oversize === 1,
      city,
      url: raw.detailUrl,
      notes: ['Envío internacional: puede generar impuestos de importación.', 'Precio convertido desde USD.'],
    });
  },
};

/* ------------------------------- Homecenter ------------------------------ */
interface HomecenterItem {
  codigo: string;
  nombre: string;
  precioNormal: number;
  precioOferta: number | null;
  link: string;
  seccion: 'Electro' | 'Hogar' | 'Herramientas' | 'Deportes';
  despachoEspecial: boolean;
}

const HC_CATEGORY: Record<HomecenterItem['seccion'], Category> = {
  Electro: 'tecnologia',
  Hogar: 'hogar',
  Herramientas: 'hogar',
  Deportes: 'deporte',
};

export const homecenterAdapter: StoreAdapter<HomecenterItem> = {
  storeId: 'homecenter',
  cacheTtlMs: 15 * 60_000,
  fetchRaw(query, signal) {
    const items: HomecenterItem[] = seedListings('homecenter', query).map((l) => ({
      codigo: `${300_000 + l.index * 211}`,
      nombre: l.title,
      precioNormal: l.listPrice ?? l.price,
      precioOferta: l.listPrice ? l.price : null,
      link: storeSearchUrl('homecenter', l.title),
      seccion: l.category === 'tecnologia' ? 'Electro' : l.category === 'deporte' ? 'Deportes' : 'Hogar',
      despachoEspecial: l.bulky,
    }));
    return simulateNetwork(items, 780, signal);
  },
  normalize(raw, city) {
    return buildOffer({
      storeId: 'homecenter',
      sku: raw.codigo,
      title: raw.nombre,
      basePrice: raw.precioOferta ?? raw.precioNormal,
      listPrice: raw.precioOferta ? raw.precioNormal : null,
      category: HC_CATEGORY[raw.seccion],
      bulky: raw.despachoEspecial,
      city,
      url: raw.link,
    });
  },
};

/* -------------------------------- Alkosto -------------------------------- */
// Precio con decimales como string "1234900.00" y descuento en porcentaje.
interface AlkostoProduct {
  code: string;
  name: string;
  price: { value: string; discountPercent: number };
  url: string;
  department: string;
  heavy: 'Y' | 'N';
}

export const alkostoAdapter: StoreAdapter<AlkostoProduct> = {
  storeId: 'alkosto',
  cacheTtlMs: 10 * 60_000,
  fetchRaw(query, signal) {
    const items: AlkostoProduct[] = seedListings('alkosto', query).map((l) => ({
      code: `AK${70_000 + l.index * 59}`,
      name: l.title,
      price: {
        value: l.price.toFixed(2),
        discountPercent: l.listPrice ? Math.round((1 - l.price / l.listPrice) * 100) : 0,
      },
      url: storeSearchUrl('alkosto', l.title),
      department: l.category,
      heavy: l.bulky ? 'Y' : 'N',
    }));
    return simulateNetwork(items, 540, signal);
  },
  normalize(raw, city) {
    const price = Number(raw.price.value);
    const discount = raw.price.discountPercent;
    return buildOffer({
      storeId: 'alkosto',
      sku: raw.code,
      title: raw.name,
      basePrice: price,
      // Se reconstruye el precio anterior a partir del % de descuento (redondeado a centenas).
      listPrice: discount > 0 ? Math.round(price / (1 - discount / 100) / 100) * 100 : null,
      category: (['tecnologia', 'hogar', 'vestuario', 'deporte'] as Category[]).includes(raw.department as Category)
        ? (raw.department as Category)
        : 'tecnologia',
      bulky: raw.heavy === 'Y',
      city,
      url: raw.url,
    });
  },
};

export const ADAPTERS: StoreAdapter<any>[] = [
  mercadoLibreAdapter,
  falabellaAdapter,
  aliExpressAdapter,
  homecenterAdapter,
  alkostoAdapter,
];
