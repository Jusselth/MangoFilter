import { quoteShipping } from '../logistics';
import { DEFAULT_FILTERS, rankOffers, rankResults, rankServiceOffers, totalCost } from '../ranking';
import type { Offer, ProductGroup, Service, ServiceOffer } from '../types';

const offer = (id: string, total: number, days: number, extra: Partial<Offer> = {}): Offer => ({
  id,
  storeId: 'mercadolibre',
  title: id,
  normalizedTitle: id,
  brand: null,
  category: 'tecnologia',
  basePrice: total,
  listPrice: null,
  shippingCost: 0,
  deliveryDays: days,
  totalCost: total,
  url: '',
  bulky: false,
  notes: [],
  ...extra,
});

describe('costo total y envío', () => {
  it('Costo Total = Precio Base + Costo Envío', () => {
    expect(totalCost(100_000, 9_900)).toBe(109_900);
  });

  it('aplica envío gratis desde el umbral de la tienda', () => {
    expect(quoteShipping('mercadolibre', 59_000, 'bogota', false).cost).toBeGreaterThan(0);
    expect(quoteShipping('mercadolibre', 60_000, 'bogota', false).cost).toBe(0);
  });

  it('las zonas remotas cuestan más y tardan más', () => {
    const near = quoteShipping('falabella', 50_000, 'bogota', false);
    const far = quoteShipping('falabella', 50_000, 'leticia', false);
    expect(far.cost).toBeGreaterThan(near.cost);
    expect(far.days).toBeGreaterThan(near.days);
  });

  it('los voluminosos pierden el envío gratis en tiendas que así lo definen', () => {
    expect(quoteShipping('alkosto', 2_000_000, 'bogota', true).cost).toBeGreaterThan(0);
  });
});

describe('ordenamiento multicriterio', () => {
  const cheapSlow = offer('barato-lento', 1_000_000, 14);
  const pricyFast = offer('caro-rapido', 1_100_000, 1);
  const middle = offer('medio', 1_050_000, 3);

  it('"precio" prioriza el menor costo total', () => {
    expect(rankOffers([pricyFast, middle, cheapSlow], 'precio')[0].id).toBe('barato-lento');
  });

  it('"rapidez" prioriza la entrega más pronta', () => {
    expect(rankOffers([cheapSlow, middle, pricyFast], 'rapidez')[0].id).toBe('caro-rapido');
  });

  it('"equilibrado" evita los extremos', () => {
    expect(rankOffers([cheapSlow, pricyFast, middle], 'equilibrado')[0].id).toBe('medio');
  });

  it('los filtros descartan ofertas y grupos vacíos', () => {
    const groups: ProductGroup[] = [
      { id: 'a', name: 'A', brand: null, category: 'tecnologia', offers: [cheapSlow, pricyFast] },
      { id: 'b', name: 'B', brand: null, category: 'hogar', offers: [offer('b1', 5_000_000, 2, { category: 'hogar' })] },
    ];
    const result = rankResults(groups, 'precio', { ...DEFAULT_FILTERS, maxDeliveryDays: 3, maxBudget: 2_000_000 });
    expect(result).toHaveLength(1);
    expect(result[0].offers.map((o) => o.id)).toEqual(['caro-rapido']);
    expect(result[0].savings).toBe(0);
  });
});

describe('servicios', () => {
  const catalog: Service[] = [
    { id: 'netflix', name: 'N', category: 'streaming', description: '', standalonePrice: 38_900 },
    { id: 'fibra', name: 'F', category: 'conectividad', description: '', standalonePrice: 89_900 },
  ];
  const offers: ServiceOffer[] = [
    { id: 'directo', serviceId: 'netflix', provider: 'D', planName: '', monthlyPrice: 38_900, includes: [], benefits: [], commitmentMonths: 0, url: '' },
    { id: 'combo', serviceId: 'netflix', provider: 'C', planName: '', monthlyPrice: 109_900, includes: ['fibra'], benefits: [], commitmentMonths: 12, url: '' },
  ];

  it('calcula el costo neto restando el valor de lo incluido', () => {
    const ranked = rankServiceOffers(offers, catalog, 'neto');
    expect(ranked[0].id).toBe('combo');
    expect(ranked[0].netCost).toBe(20_000);
    expect(rankServiceOffers(offers, catalog, 'precio')[0].id).toBe('directo');
  });
});
