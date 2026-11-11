import type { Service, ServiceOffer } from '../domain/types';
import { SERVICE_OFFERS, SERVICES } from './seed/services';

/**
 * Repositorio del Módulo de Servicios (Adaptadores de Alianzas).
 * Hoy lee el catálogo de demostración con latencia simulada; mañana puede
 * apuntar al API Gateway sin cambiar la capa de estado.
 */
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface ServiceSummary extends Service {
  minPrice: number;
  offerCount: number;
}

export async function listServices(): Promise<ServiceSummary[]> {
  await delay(250);
  return SERVICES.map((s) => {
    const offers = SERVICE_OFFERS.filter((o) => o.serviceId === s.id);
    return {
      ...s,
      offerCount: offers.length,
      minPrice: offers.length ? Math.min(...offers.map((o) => o.monthlyPrice)) : s.standalonePrice,
    };
  });
}

export async function getServiceOffers(serviceId: string): Promise<{ service: Service; offers: ServiceOffer[]; catalog: Service[] }> {
  await delay(350);
  const service = SERVICES.find((s) => s.id === serviceId);
  if (!service) throw new Error(`Servicio no encontrado: ${serviceId}`);
  return { service, offers: SERVICE_OFFERS.filter((o) => o.serviceId === serviceId), catalog: SERVICES };
}
