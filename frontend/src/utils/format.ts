import type { Offer } from '../api/types';

/** $1.234.900 (formato colombiano, sin decimales). Implementación propia para no depender de Intl en Hermes. */
export function formatCOP(value: number): string {
  const n = Math.round(value);
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/** Versión para lectores de pantalla: "1.234.900 pesos". */
export function spokenCOP(value: number): string {
  return `${formatCOP(value).replace('$', '')} pesos`;
}

export function formatDays(days: number | null, business = false): string {
  if (days === null) return 'Entrega por confirmar';
  if (days <= 1) return business ? 'Llega en 1 día hábil' : 'Llega mañana';
  return `Llega en ${days} días${business ? ' hábiles' : ''}`;
}

export function formatShipping(offer: Pick<Offer, 'shippingCost' | 'shippingKnown'>): string {
  if (!offer.shippingKnown || offer.shippingCost === null) return 'Por confirmar';
  return offer.shippingCost === 0 ? 'Gratis' : formatCOP(offer.shippingCost);
}

/** Texto corto del problema de disponibilidad, o null si la oferta llega a la ciudad. */
export function availabilityLabel(offer: Pick<Offer, 'availability'>, cityName: string): string | null {
  if (offer.availability === 'pickup') return `Solo recogida en tienda en ${cityName}`;
  if (offer.availability === 'no_delivery') return `No se despacha a ${cityName}`;
  return null;
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "hace 3 min" a partir de un ISO 8601. */
export function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `hace ${hours} h`;
}

/** Color de texto legible (oscuro o blanco) sobre un color de fondo dado. */
export function readableOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#1B1B1B';
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Se elige el que dé mayor contraste WCAG.
  return (1.05) / (luminance + 0.05) > (luminance + 0.05) / 0.05 ? '#FFFFFF' : '#1B1B1B';
}
