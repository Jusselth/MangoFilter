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
  availability: 'delivery',
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
    const unknown = offer('d:sin-envio', 900_000, null, { shippingKnown: false, shippingCost: null, availability: 'unknown' });
    expect(rankOffers([unknown, pricyFast], 'precio')[0].id).toBe('b:caro-rapido');
  });
});

describe('ofertas que no llegan a la ciudad', () => {
  const noLlega = offer('e:no-llega', 500_000, null, { shippingKnown: false, shippingCost: null, availability: 'no_delivery' });
  const recoger = offer('f:recoger', 600_000, null, { shippingKnown: false, shippingCost: null, availability: 'pickup' });
  const llega = offer('g:llega', 1_200_000, 3);
  const group: ProductGroup = { id: 'g', name: 'G', brand: null, imageUrl: null, offers: [noLlega, recoger, llega] };

  it('nunca son la mejor opción aunque sean más baratas, y van al final', () => {
    expect(rankOffers([noLlega, recoger, llega], 'precio').map((o) => o.id)).toEqual(['g:llega', 'f:recoger', 'e:no-llega']);
    const [ranked] = rankResults([group], 'precio', DEFAULT_FILTERS);
    expect(ranked.best.id).toBe('g:llega');
    expect(ranked.undeliverable).toBe(2);
    expect(ranked.savings).toBe(0); // el ahorro solo compara lo que sí llega
  });

  it('el filtro "ocultar lo que no llega" las quita (y quita productos sin opciones)', () => {
    const [ranked] = rankResults([group], 'precio', { ...DEFAULT_FILTERS, hideUndeliverable: true });
    expect(ranked.offers.map((o) => o.id)).toEqual(['g:llega']);
    const soloNoLlega: ProductGroup = { ...group, id: 'x', offers: [noLlega] };
    expect(rankResults([soloNoLlega], 'precio', { ...DEFAULT_FILTERS, hideUndeliverable: true })).toEqual([]);
    expect(countActiveFilters({ ...DEFAULT_FILTERS, hideUndeliverable: true })).toBe(1);
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
