import type { Category, ServiceCategory } from '../domain/types';

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

export function formatDays(days: number, business = false): string {
  if (days <= 1) return 'Llega mañana';
  return `Llega en ${days} días${business ? ' hábiles' : ''}`;
}

export const CATEGORY_LABEL: Record<Category, string> = {
  tecnologia: 'Tecnología',
  hogar: 'Hogar',
  vestuario: 'Vestuario',
  deporte: 'Deporte',
};

export const CATEGORY_ICON: Record<Category, string> = {
  tecnologia: 'hardware-chip-outline',
  hogar: 'home-outline',
  vestuario: 'shirt-outline',
  deporte: 'bicycle-outline',
};

export const SERVICE_CATEGORY_LABEL: Record<ServiceCategory, string> = {
  streaming: 'Streaming',
  musica: 'Música',
  hogar: 'Hogar',
  conectividad: 'Conectividad',
};

export const SERVICE_CATEGORY_ICON: Record<ServiceCategory, string> = {
  streaming: 'tv-outline',
  musica: 'musical-notes-outline',
  hogar: 'sparkles-outline',
  conectividad: 'wifi-outline',
};

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
