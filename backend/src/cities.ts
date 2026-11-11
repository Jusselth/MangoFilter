import type { City } from './domain/types.js';

/**
 * Ciudades soportadas. Esto es configuración de referencia, no datos de
 * productos: el código DANE es el que esperan las tiendas VTEX de Colombia
 * en el campo `postalCode` del simulador de envío (verificado en vivo).
 */
export const CITIES: City[] = [
  { id: 'bogota', name: 'Bogotá', department: 'Bogotá D.C.', dane: '11001', postal: '110111' },
  { id: 'medellin', name: 'Medellín', department: 'Antioquia', dane: '05001', postal: '050001' },
  { id: 'cali', name: 'Cali', department: 'Valle del Cauca', dane: '76001', postal: '760001' },
  { id: 'barranquilla', name: 'Barranquilla', department: 'Atlántico', dane: '08001', postal: '080001' },
  { id: 'cartagena', name: 'Cartagena', department: 'Bolívar', dane: '13001', postal: '130001' },
  { id: 'bucaramanga', name: 'Bucaramanga', department: 'Santander', dane: '68001', postal: '680001' },
  { id: 'cucuta', name: 'Cúcuta', department: 'Norte de Santander', dane: '54001', postal: '540001' },
  { id: 'pereira', name: 'Pereira', department: 'Risaralda', dane: '66001', postal: '660001' },
  { id: 'manizales', name: 'Manizales', department: 'Caldas', dane: '17001', postal: '170001' },
  { id: 'armenia', name: 'Armenia', department: 'Quindío', dane: '63001', postal: '630001' },
  { id: 'ibague', name: 'Ibagué', department: 'Tolima', dane: '73001', postal: '730001' },
  { id: 'villavicencio', name: 'Villavicencio', department: 'Meta', dane: '50001', postal: '500001' },
  { id: 'santa-marta', name: 'Santa Marta', department: 'Magdalena', dane: '47001', postal: '470001' },
  { id: 'valledupar', name: 'Valledupar', department: 'Cesar', dane: '20001', postal: '200001' },
  { id: 'monteria', name: 'Montería', department: 'Córdoba', dane: '23001', postal: '230001' },
  { id: 'neiva', name: 'Neiva', department: 'Huila', dane: '41001', postal: '410001' },
  { id: 'pasto', name: 'Pasto', department: 'Nariño', dane: '52001', postal: '520001' },
  { id: 'popayan', name: 'Popayán', department: 'Cauca', dane: '19001', postal: '190001' },
  { id: 'tunja', name: 'Tunja', department: 'Boyacá', dane: '15001', postal: '150001' },
  { id: 'chia', name: 'Chía', department: 'Cundinamarca', dane: '25175', postal: '250001' },
  { id: 'soacha', name: 'Soacha', department: 'Cundinamarca', dane: '25754', postal: '250051' },
  { id: 'leticia', name: 'Leticia', department: 'Amazonas', dane: '91001', postal: '910001' },
];

export function findCity(id: string): City | undefined {
  return CITIES.find((c) => c.id === id);
}
