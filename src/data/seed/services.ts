import type { Service, ServiceOffer } from '../../domain/types';

/**
 * Servicios y planes de DEMOSTRACIÓN (Perfil 2 de la propuesta: suscriptor de
 * servicios empaquetados). Los integradores son ficticios y los precios no
 * son reales; sirven para validar la comparación por costo neto.
 */
export const SERVICES: Service[] = [
  { id: 'netflix', name: 'Netflix Estándar', category: 'streaming', description: 'Series y películas en HD, 2 pantallas.', standalonePrice: 38_900 },
  { id: 'disney', name: 'Disney+ Estándar', category: 'streaming', description: 'Disney, Pixar, Marvel y Star Wars.', standalonePrice: 33_900 },
  { id: 'max', name: 'Max Básico', category: 'streaming', description: 'Series HBO y estrenos de Warner.', standalonePrice: 29_900 },
  { id: 'prime', name: 'Prime Video', category: 'streaming', description: 'Películas, series y deportes en vivo.', standalonePrice: 21_900 },
  { id: 'spotify', name: 'Spotify Premium', category: 'musica', description: 'Música sin anuncios y descargas.', standalonePrice: 19_900 },
  { id: 'youtube', name: 'YouTube Premium', category: 'musica', description: 'Videos sin anuncios y YouTube Music.', standalonePrice: 25_900 },
  { id: 'fibra300', name: 'Internet fibra 300 Mbps', category: 'conectividad', description: 'Internet hogar por fibra óptica.', standalonePrice: 89_900 },
  { id: 'movil20', name: 'Plan móvil 20 GB', category: 'conectividad', description: 'Datos, minutos ilimitados y redes sociales.', standalonePrice: 45_900 },
  { id: 'aseo', name: 'Aseo del hogar (4 h/semana)', category: 'hogar', description: 'Servicio de limpieza por horas.', standalonePrice: 320_000 },
];

export const SERVICE_OFFERS: ServiceOffer[] = [
  // Netflix
  { id: 'netflix-directo', serviceId: 'netflix', provider: 'Directo con el proveedor', planName: 'Estándar', monthlyPrice: 38_900, includes: [], benefits: ['Cancela cuando quieras'], commitmentMonths: 0, url: 'https://www.netflix.com/co/' },
  { id: 'netflix-fibranet', serviceId: 'netflix', provider: 'FibraNet Hogar', planName: 'Fibra 300 + Netflix', monthlyPrice: 109_900, includes: ['fibra300'], benefits: ['Instalación gratis', 'Router WiFi 6'], commitmentMonths: 12, url: 'https://example.com/fibranet' },
  { id: 'netflix-movilplus', serviceId: 'netflix', provider: 'MóvilPlus', planName: 'Plan 20 GB + Netflix', monthlyPrice: 69_900, includes: ['movil20'], benefits: ['Redes sociales ilimitadas'], commitmentMonths: 0, url: 'https://example.com/movilplus' },
  { id: 'netflix-pagoya', serviceId: 'netflix', provider: 'PagoYa Prime', planName: 'Membresía PagoYa + Netflix', monthlyPrice: 44_900, includes: ['spotify'], benefits: ['Envíos gratis en PagoYa', '5% cashback'], commitmentMonths: 0, url: 'https://example.com/pagoya' },
  // Disney+
  { id: 'disney-directo', serviceId: 'disney', provider: 'Directo con el proveedor', planName: 'Estándar', monthlyPrice: 33_900, includes: [], benefits: ['Cancela cuando quieras'], commitmentMonths: 0, url: 'https://www.disneyplus.com/es-co' },
  { id: 'disney-fibranet', serviceId: 'disney', provider: 'FibraNet Hogar', planName: 'Fibra 300 + Disney+', monthlyPrice: 104_900, includes: ['fibra300'], benefits: ['Instalación gratis'], commitmentMonths: 12, url: 'https://example.com/fibranet' },
  { id: 'disney-combo', serviceId: 'disney', provider: 'MóvilPlus', planName: 'Combo Disney+ y Max', monthlyPrice: 49_900, includes: ['max'], benefits: ['Un solo cobro mensual'], commitmentMonths: 6, url: 'https://example.com/movilplus' },
  // Max
  { id: 'max-directo', serviceId: 'max', provider: 'Directo con el proveedor', planName: 'Básico con anuncios', monthlyPrice: 29_900, includes: [], benefits: [], commitmentMonths: 0, url: 'https://www.max.com/co/es' },
  { id: 'max-combo', serviceId: 'max', provider: 'MóvilPlus', planName: 'Combo Disney+ y Max', monthlyPrice: 49_900, includes: ['disney'], benefits: ['Un solo cobro mensual'], commitmentMonths: 6, url: 'https://example.com/movilplus' },
  // Prime Video
  { id: 'prime-directo', serviceId: 'prime', provider: 'Directo con el proveedor', planName: 'Prime Video', monthlyPrice: 21_900, includes: [], benefits: [], commitmentMonths: 0, url: 'https://www.primevideo.com' },
  { id: 'prime-movilplus', serviceId: 'prime', provider: 'MóvilPlus', planName: 'Plan 20 GB + Prime Video', monthlyPrice: 59_900, includes: ['movil20'], benefits: ['Roaming en Sudamérica'], commitmentMonths: 0, url: 'https://example.com/movilplus' },
  // Spotify
  { id: 'spotify-directo', serviceId: 'spotify', provider: 'Directo con el proveedor', planName: 'Individual', monthlyPrice: 19_900, includes: [], benefits: ['1 mes de prueba'], commitmentMonths: 0, url: 'https://www.spotify.com/co/premium/' },
  { id: 'spotify-pagoya', serviceId: 'spotify', provider: 'PagoYa Prime', planName: 'Membresía PagoYa + Netflix', monthlyPrice: 44_900, includes: ['netflix'], benefits: ['Envíos gratis en PagoYa', '5% cashback'], commitmentMonths: 0, url: 'https://example.com/pagoya' },
  { id: 'spotify-movilplus', serviceId: 'spotify', provider: 'MóvilPlus', planName: 'Plan 20 GB + Spotify', monthlyPrice: 54_900, includes: ['movil20'], benefits: ['Spotify sin consumir datos'], commitmentMonths: 0, url: 'https://example.com/movilplus' },
  // YouTube
  { id: 'youtube-directo', serviceId: 'youtube', provider: 'Directo con el proveedor', planName: 'Individual', monthlyPrice: 25_900, includes: [], benefits: [], commitmentMonths: 0, url: 'https://www.youtube.com/premium' },
  { id: 'youtube-fibranet', serviceId: 'youtube', provider: 'FibraNet Hogar', planName: 'Fibra 300 + YouTube Premium', monthlyPrice: 99_900, includes: ['fibra300'], benefits: ['Instalación gratis'], commitmentMonths: 12, url: 'https://example.com/fibranet' },
  // Internet
  { id: 'fibra-fibranet', serviceId: 'fibra300', provider: 'FibraNet Hogar', planName: 'Solo internet 300 Mbps', monthlyPrice: 89_900, includes: [], benefits: ['Instalación gratis'], commitmentMonths: 12, url: 'https://example.com/fibranet' },
  { id: 'fibra-netflix', serviceId: 'fibra300', provider: 'FibraNet Hogar', planName: 'Fibra 300 + Netflix', monthlyPrice: 109_900, includes: ['netflix'], benefits: ['Instalación gratis', 'Router WiFi 6'], commitmentMonths: 12, url: 'https://example.com/fibranet' },
  { id: 'fibra-conectacasa', serviceId: 'fibra300', provider: 'ConectaCasa', planName: 'Hogar 300 Mbps', monthlyPrice: 84_900, includes: [], benefits: ['Sin permanencia'], commitmentMonths: 0, url: 'https://example.com/conectacasa' },
  // Móvil
  { id: 'movil-movilplus', serviceId: 'movil20', provider: 'MóvilPlus', planName: 'Plan 20 GB', monthlyPrice: 45_900, includes: [], benefits: ['Redes sociales ilimitadas'], commitmentMonths: 0, url: 'https://example.com/movilplus' },
  { id: 'movil-netflix', serviceId: 'movil20', provider: 'MóvilPlus', planName: 'Plan 20 GB + Netflix', monthlyPrice: 69_900, includes: ['netflix'], benefits: ['Redes sociales ilimitadas'], commitmentMonths: 0, url: 'https://example.com/movilplus' },
  { id: 'movil-conecta', serviceId: 'movil20', provider: 'ConectaCasa', planName: 'Móvil 25 GB', monthlyPrice: 42_900, includes: [], benefits: ['5 GB extra'], commitmentMonths: 3, url: 'https://example.com/conectacasa' },
  // Aseo
  { id: 'aseo-casalimpia', serviceId: 'aseo', provider: 'HogarYa', planName: '4 h semanales', monthlyPrice: 320_000, includes: [], benefits: ['Personal verificado'], commitmentMonths: 0, url: 'https://example.com/hogarya' },
  { id: 'aseo-pagoya', serviceId: 'aseo', provider: 'PagoYa Prime', planName: 'Aseo + membresía PagoYa', monthlyPrice: 309_000, includes: [], benefits: ['Envíos gratis en PagoYa', 'Reprogramación sin costo'], commitmentMonths: 0, url: 'https://example.com/pagoya' },
];
