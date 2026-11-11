import type { CityId, StoreId, Zone } from './types';

export interface City {
  id: CityId;
  name: string;
  zone: Zone;
}

export const CITIES: City[] = [
  { id: 'bogota', name: 'Bogotá', zone: 'principal' },
  { id: 'medellin', name: 'Medellín', zone: 'principal' },
  { id: 'cali', name: 'Cali', zone: 'principal' },
  { id: 'barranquilla', name: 'Barranquilla', zone: 'principal' },
  { id: 'bucaramanga', name: 'Bucaramanga', zone: 'intermedia' },
  { id: 'pereira', name: 'Pereira', zone: 'intermedia' },
  { id: 'pasto', name: 'Pasto', zone: 'remota' },
  { id: 'leticia', name: 'Leticia', zone: 'remota' },
];

export function getCity(id: CityId): City {
  return CITIES.find((c) => c.id === id) ?? CITIES[0];
}

export interface StoreInfo {
  id: StoreId;
  name: string;
  /** Inicial usada como "logo" textual (no se depende solo del color). */
  short: string;
  /** Color identificador de la tienda (decorativo). */
  color: string;
  international: boolean;
}

export const STORES: Record<StoreId, StoreInfo> = {
  mercadolibre: { id: 'mercadolibre', name: 'Mercado Libre', short: 'ML', color: '#FFE600', international: false },
  falabella: { id: 'falabella', name: 'Falabella', short: 'FA', color: '#AAD500', international: false },
  aliexpress: { id: 'aliexpress', name: 'AliExpress', short: 'AE', color: '#FF4747', international: true },
  homecenter: { id: 'homecenter', name: 'Homecenter', short: 'HC', color: '#2F6FED', international: false },
  alkosto: { id: 'alkosto', name: 'Alkosto', short: 'AK', color: '#F5A100', international: false },
};

export const STORE_IDS = Object.keys(STORES) as StoreId[];

/**
 * Política logística por tienda (datos de demostración).
 * - base: tarifa por zona de destino.
 * - freeFrom: compra mínima para envío gratis (null = nunca gratis).
 * - days: tiempo de entrega en días hábiles por zona.
 */
interface ShippingPolicy {
  base: Record<Zone, number>;
  freeFrom: number | null;
  days: Record<Zone, number>;
  /** Los voluminosos multiplican la tarifa y pierden el envío gratis si aplica. */
  bulkyMultiplier: number;
  bulkyLosesFree: boolean;
  bulkyExtraDays: number;
}

const POLICIES: Record<StoreId, ShippingPolicy> = {
  mercadolibre: {
    base: { principal: 9_900, intermedia: 12_900, remota: 21_900 },
    freeFrom: 60_000,
    days: { principal: 1, intermedia: 2, remota: 5 },
    bulkyMultiplier: 2,
    bulkyLosesFree: false,
    bulkyExtraDays: 1,
  },
  falabella: {
    base: { principal: 11_900, intermedia: 14_900, remota: 26_900 },
    freeFrom: 149_900,
    days: { principal: 2, intermedia: 3, remota: 6 },
    bulkyMultiplier: 2.2,
    bulkyLosesFree: true,
    bulkyExtraDays: 2,
  },
  aliexpress: {
    base: { principal: 0, intermedia: 0, remota: 8_900 },
    freeFrom: null,
    days: { principal: 12, intermedia: 14, remota: 20 },
    bulkyMultiplier: 1,
    bulkyLosesFree: false,
    bulkyExtraDays: 5,
  },
  homecenter: {
    base: { principal: 14_900, intermedia: 19_900, remota: 34_900 },
    freeFrom: 199_000,
    days: { principal: 2, intermedia: 4, remota: 7 },
    bulkyMultiplier: 1.5,
    bulkyLosesFree: false,
    bulkyExtraDays: 1,
  },
  alkosto: {
    base: { principal: 9_900, intermedia: 13_900, remota: 22_900 },
    freeFrom: 99_000,
    days: { principal: 2, intermedia: 3, remota: 5 },
    bulkyMultiplier: 2.5,
    bulkyLosesFree: true,
    bulkyExtraDays: 2,
  },
};

/** Recargo de AliExpress para artículos voluminosos (flete internacional). */
const INTERNATIONAL_BULKY_FEE = 45_000;

export interface ShippingQuote {
  cost: number;
  days: number;
}

/** Calcula la tarifa logística específica según la ubicación del usuario. */
export function quoteShipping(storeId: StoreId, price: number, cityId: CityId, bulky: boolean): ShippingQuote {
  const policy = POLICIES[storeId];
  const zone = getCity(cityId).zone;
  let days = policy.days[zone] + (bulky ? policy.bulkyExtraDays : 0);

  const qualifiesFree = policy.freeFrom !== null && price >= policy.freeFrom && !(bulky && policy.bulkyLosesFree);
  if (qualifiesFree) return { cost: 0, days };

  let cost = policy.base[zone] * (bulky ? policy.bulkyMultiplier : 1);
  if (storeId === 'aliexpress' && bulky) cost += INTERNATIONAL_BULKY_FEE;
  // Redondeo a centenas como hacen las tiendas.
  cost = Math.round(cost / 100) * 100;
  days = Math.max(1, days);
  return { cost, days };
}

/** Tasa de demostración para convertir publicaciones en USD. */
export const USD_TO_COP = 4_050;
