import type { Offer, ProductGroup } from '../../api/types';
import { readableOn } from '../../utils/format';
import { countActiveFilters, DEFAULT_FILTERS, rankOffers, rankResults } from '../ranking';

const offer = (id: string, total: number, days: number | null, extra: Partial<Offer> = {}): Offer => ({
  id,
  store: { id: id.split(':')[0], name: id, short: 'XX', color: '#000000', website: '' },
  title: id,
  normalizedTitle: id,
  brand: null,
  category: null,
  imageUrl: null,
  url: '',
  basePrice: total,
  listPrice: null,
  shippingCost: 0,
  deliveryDays: days,
  shippingKnown: true,
  totalCost: total,
  position: 0,
  notes: [],
  ...extra,
});

describe('ordenamiento multicriterio', () => {
  const cheapSlow = offer('a:barato-lento', 1_000_000, 14);
  const pricyFast = offer('b:caro-rapido', 1_100_000, 1);
  const middle = offer('c:medio', 1_050_000, 3);

  it('"precio" prioriza el menor costo total', () => {
    expect(rankOffers([pricyFast, middle, cheapSlow], 'precio')[0].id).toBe('a:barato-lento');
  });

  it('"rapidez" prioriza la entrega más pronta', () => {
    expect(rankOffers([cheapSlow, middle, pricyFast], 'rapidez')[0].id).toBe('b:caro-rapido');
  });

  it('"equilibrado" evita los extremos', () => {
    expect(rankOffers([cheapSlow, pricyFast, middle], 'equilibrado')[0].id).toBe('c:medio');
  });

  it('una oferta con envío desconocido nunca es la mejor si hay envíos confirmados', () => {
    const unknown = offer('d:sin-envio', 900_000, null, { shippingKnown: false, shippingCost: null });
    expect(rankOffers([unknown, pricyFast], 'precio')[0].id).toBe('b:caro-rapido');
  });
});

describe('filtros', () => {
  const groups: ProductGroup[] = [
    { id: 'g1', name: 'Uno', brand: null, imageUrl: null, offers: [offer('a:1', 1_000_000, 14), offer('b:1', 1_100_000, 1, { shippingCost: 9_900 })] },
    { id: 'g2', name: 'Dos', brand: null, imageUrl: null, offers: [offer('a:2', 5_000_000, 2)] },
  ];

  it('descarta ofertas y productos que no cumplen y conserva el orden del backend', () => {
    const r = rankResults(groups, 'precio', { ...DEFAULT_FILTERS, maxDeliveryDays: 3, maxBudget: 2_000_000 });
    expect(r.map((g) => g.id)).toEqual(['g1']);
    expect(r[0].offers.map((o) => o.id)).toEqual(['b:1']);
    expect(r[0].savings).toBe(0);
  });

  it('filtra por tienda y por envío gratis', () => {
    expect(rankResults(groups, 'precio', { ...DEFAULT_FILTERS, stores: ['b'] }).map((g) => g.id)).toEqual(['g1']);
    const free = rankResults(groups, 'precio', { ...DEFAULT_FILTERS, freeShippingOnly: true });
    expect(free[0].offers.map((o) => o.id)).toEqual(['a:1']);
    expect(countActiveFilters({ ...DEFAULT_FILTERS, freeShippingOnly: true, stores: ['a'] })).toBe(2);
  });
});

describe('contraste del logo de tienda', () => {
  it('elige texto oscuro sobre amarillo y blanco sobre verde oscuro', () => {
    expect(readableOn('#F7D117')).toBe('#1B1B1B');
    expect(readableOn('#00553A')).toBe('#FFFFFF');
  });
});
