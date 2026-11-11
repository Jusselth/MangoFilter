import { describe, expect, it } from 'vitest';

import { jaroWinkler } from '../src/domain/jaroWinkler.js';
import { fingerprintsConflict, findGroup, groupOffers, variantsConflict } from '../src/domain/matching.js';
import { cleanText, detectBrand, matchesQuery, modelFingerprint, normalizeBrand, normalizeTitle } from '../src/domain/normalize.js';
import type { Offer } from '../src/domain/types.js';

/** Construye una oferta mínima a partir de un título REAL publicado por una tienda. */
function offer(storeId: string, title: string, price: number, brand?: string): Offer {
  return {
    id: `${storeId}:${title.length}${price}`,
    store: { id: storeId, name: storeId, short: storeId.slice(0, 2).toUpperCase(), color: '#000', website: '' },
    title,
    normalizedTitle: normalizeTitle(title),
    brand: normalizeBrand(brand) ?? detectBrand(title),
    category: null,
    imageUrl: null,
    url: '',
    basePrice: price,
    listPrice: null,
    shippingCost: 0,
    deliveryDays: 2,
    shippingKnown: true,
    totalCost: price,
    position: 0,
    notes: [],
  };
}

const sameGroup = (groups: ReturnType<typeof groupOffers>, a: Offer, b: Offer) =>
  groups.some((g) => g.offers.includes(a) && g.offers.includes(b));

describe('jaroWinkler', () => {
  it('coincide con valores de referencia', () => {
    expect(jaroWinkler('martha', 'marhta')).toBeCloseTo(0.961, 3);
    expect(jaroWinkler('dixon', 'dicksonx')).toBeCloseTo(0.813, 3);
    expect(jaroWinkler('abc', 'abc')).toBe(1);
    expect(jaroWinkler('abc', '')).toBe(0);
  });
});

describe('normalización', () => {
  it('unifica códigos, capacidades, pulgadas y litros', () => {
    expect(cleanText('Sony WH-1000XM5')).toBe('sony wh1000xm5');
    expect(cleanText('Apple iPhone 15 (128 GB)')).toBe('apple iphone 15 128gb');
    expect(cleanText('TV 55" 4K')).toBe('tv 55in 4k');
    expect(cleanText('Freidora 3.8 Litros')).toBe('freidora 38l');
    expect(cleanText('PS5 Slim')).toBe('playstation 5 slim');
  });

  it('normaliza la marca informada por la tienda', () => {
    expect(normalizeBrand('SAMSUNG')).toBe('samsung');
    expect(normalizeBrand('LG Electronics')).toBe('lg');
    expect(normalizeBrand('Generico')).toBeNull();
    expect(detectBrand('Celular Galaxy A55')).toBe('samsung');
  });

  it('detecta variantes distintas por huella de modelo y por palabras de variante', () => {
    expect(fingerprintsConflict(modelFingerprint('iPhone 15 128GB'), modelFingerprint('iPhone 15 256GB'))).toBe(true);
    expect(fingerprintsConflict(modelFingerprint('Galaxy A55 5G 256GB'), modelFingerprint('Galaxy A55 256GB'))).toBe(false);
    expect(variantsConflict('Iphone 17 5G 256GB', 'Celular Iphone 17 Pro 5G 256GB')).toBe(true);
    expect(variantsConflict('AirPods Max 2', 'Airpods pro 2 generación')).toBe(true);
    expect(variantsConflict('iPhone 14 Pro Max Reacondicionado', 'iPhone 14 Pro Max')).toBe(true);
  });

  it('la búsqueda tolera tildes, errores de tipeo e inglés y descarta accesorios', () => {
    expect(matchesQuery('Audífonos Sony WH-CH520', 'audifonos sony')).toBe(true);
    expect(matchesQuery('Freidora de Aire Oster 4 Litros', 'freidra oster')).toBe(true);
    expect(matchesQuery('Soporte TV 32 a 55 Facil Instalacion', 'televisor samsung 55')).toBe(false);
  });
});

describe('entity resolution con títulos reales de tiendas colombianas', () => {
  // Títulos y precios tal como los publicaron las tiendas (noviembre 2026).
  const juNinja = offer('jumbo', 'Freidora de Aire Ninja Crispi 4 En 1 FN101GY LAA', 599900, 'NINJA');
  const caNinja = offer('carulla', 'Freidora De Aire NINJA 3.8 L Digital Gris FN101GY', 593900, 'NINJA');
  const caOster = offer('carulla', 'Freidora De Aire Oster 3.8 Litros Manual Negro', 199900, 'OSTER');
  const olOster = offer('olimpica', 'Freidora de Aire Manual Oster 3.8 Litros Negra con Controles de Tiempo', 168900, 'Oster');
  const paOster = offer('panamericana', 'Freidora de aire Oster 3.8 Litros', 235000, 'Oster');
  const juOster4 = offer('jumbo', 'Freidora de Aire 4L Digital Oster', 299900, 'OSTER');
  const caTv = offer('carulla', "Televisor Samsung 55'' Pulgadas Mini LED Smart TV UN55M75HAKXZL", 1999900, 'SAMSUNG');
  const juTv = offer('jumbo', "Televisor Samsung 55'' Pulgadas Mini LED Smart TV UN55M75HAKXZL", 1899900, 'SAMSUNG');
  const juTvOther = offer('jumbo', "Televisor Samsung 55'' Pulgadas LED UHD 4K Smart TV UN55U8000HKXZL", 1699900, 'SAMSUNG');
  const caIphone = offer('carulla', 'iPhone 17 5G 256GB 8GB RAM Blanco', 3349900, 'APPLE');
  const juIphonePro = offer('jumbo', 'Celular Iphone 17 Pro 5G 12GB Ram/256GB Plateado', 5199000, 'APPLE');
  const paSony = offer('panamericana', 'AudÍfonos tipo diadema Sony WH-CH520, rosados', 159900, 'Sony');
  const caSonyCaro = offer('carulla', 'Audifonos  Inalámbricos SONY Over Ear Bluetooth  Rosado', 501288, 'SONY');

  const all = [juNinja, caNinja, caOster, olOster, paOster, juOster4, caTv, juTv, juTvOther, caIphone, juIphonePro, paSony, caSonyCaro];
  const groups = groupOffers(all);

  it('agrupa el mismo producto aunque cada tienda lo titule distinto', () => {
    expect(sameGroup(groups, juNinja, caNinja)).toBe(true); // código FN101GY compartido
    expect(sameGroup(groups, caOster, olOster)).toBe(true);
    expect(sameGroup(groups, caOster, paOster)).toBe(true);
    expect(sameGroup(groups, caTv, juTv)).toBe(true);
  });

  it('no mezcla productos distintos', () => {
    expect(sameGroup(groups, caOster, juOster4)).toBe(false); // 3.8 L vs 4 L
    expect(sameGroup(groups, juTv, juTvOther)).toBe(false); // otro modelo (y misma tienda)
    expect(sameGroup(groups, caIphone, juIphonePro)).toBe(false); // 17 vs 17 Pro
    expect(sameGroup(groups, paSony, caSonyCaro)).toBe(false); // precio 3x: regla de cordura
  });

  it('el grupo usa imagen y un nombre legible', () => {
    const tv = groups.find((g) => g.offers.includes(caTv))!;
    expect(tv.name).toContain('UN55M75HAKXZL');
    expect(findGroup(groups, juTv.id)?.id).toBe(tv.id);
  });
});
