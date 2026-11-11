import { ADAPTERS } from '../../data/adapters/stores';
import { SEED_CATALOG } from '../../data/seed/catalog';
import { jaroWinkler } from '../jaroWinkler';
import { findGroup, fingerprintsConflict, groupOffers } from '../matching';
import { cleanText, detectBrand, matchesQuery, modelFingerprint } from '../normalize';
import type { Offer } from '../types';

/** Normaliza TODO el catálogo semilla pasando por los adaptadores reales. */
async function allOffers(): Promise<Offer[]> {
  const signal = new AbortController().signal;
  // Cada título se usa como su propia búsqueda; todas las consultas van en paralelo.
  const pending = ADAPTERS.flatMap((adapter) =>
    SEED_CATALOG.flatMap((product) => {
      const listing = product.listings[adapter.storeId];
      if (!listing) return [];
      return [adapter.fetchRaw(listing[0], signal).then((raw) => raw.map((r) => adapter.normalize(r, 'bogota')))];
    }),
  );
  const result = (await Promise.all(pending)).flat();
  // Una misma publicación puede aparecer en varias búsquedas: deduplicar por id.
  return [...new Map(result.map((o) => [o.id, o])).values()];
}

describe('jaroWinkler', () => {
  it('coincide con valores de referencia', () => {
    expect(jaroWinkler('martha', 'marhta')).toBeCloseTo(0.961, 3);
    expect(jaroWinkler('dixon', 'dicksonx')).toBeCloseTo(0.813, 3);
    expect(jaroWinkler('abc', 'abc')).toBe(1);
    expect(jaroWinkler('abc', '')).toBe(0);
  });
});

describe('normalización', () => {
  it('unifica códigos de modelo, capacidades y pulgadas', () => {
    expect(cleanText('Sony WH-1000XM5')).toBe('sony wh1000xm5');
    expect(cleanText('Apple iPhone 15 (128 GB)')).toBe('apple iphone 15 128gb');
    expect(cleanText('TV 55" 4K')).toBe('tv 55in 4k');
    expect(cleanText('Freidora 4 Litros')).toBe('freidora 4l');
    expect(cleanText('Portátil 15.6 Pulgadas')).toBe('portatil 156in');
    expect(cleanText('PS5 Slim')).toBe('playstation 5 slim');
  });

  it('detecta marca por nombre o por línea de producto', () => {
    expect(detectBrand('Celular Galaxy A55')).toBe('samsung');
    expect(detectBrand('PS5 Slim Digital')).toBe('sony');
    expect(detectBrand('iPhone 15 128GB')).toBe('apple');
  });

  it('las huellas de modelo detectan variantes distintas', () => {
    expect(fingerprintsConflict(modelFingerprint('iPhone 15 128GB'), modelFingerprint('iPhone 15 256GB'))).toBe(true);
    expect(fingerprintsConflict(modelFingerprint('Galaxy A55 5G 256GB'), modelFingerprint('Galaxy A55 256GB'))).toBe(false);
  });

  it('la búsqueda tolera tildes, errores de tipeo e inglés', () => {
    expect(matchesQuery('Audífonos Sony WH-1000XM5', 'audifonos sony')).toBe(true);
    expect(matchesQuery('Sony WH-1000XM5 Wireless Headphones', 'audífonos sony')).toBe(true);
    expect(matchesQuery('Freidora De Aire Oster', 'freidra oster')).toBe(true);
    expect(matchesQuery('Parlante JBL Flip 6', 'iphone')).toBe(false);
  });
});

describe('entity resolution sobre el catálogo completo', () => {
  it('reconstruye exactamente los productos del catálogo', async () => {
    const offers = await allOffers();
    const groups = groupOffers(offers);

    expect(groups).toHaveLength(SEED_CATALOG.length);
    for (const product of SEED_CATALOG) {
      const titles = Object.values(product.listings).map((l) => l![0]);
      const group = groups.find((g) => g.offers.some((o) => o.title === titles[0]));
      expect(group).toBeDefined();
      expect(group!.offers.map((o) => o.title).sort()).toEqual([...titles].sort());
    }
  });

  it('findGroup encuentra el grupo aunque cambie su id', async () => {
    const groups = groupOffers(await allOffers());
    const group = groups[0];
    const otherOffer = group.offers[group.offers.length - 1];
    expect(findGroup(groups, otherOffer.id)?.id).toBe(group.id);
  });
});
