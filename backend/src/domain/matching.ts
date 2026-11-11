import { jaroWinkler } from './jaroWinkler.js';
import { modelFingerprint, significantTokens, tokenize } from './normalize.js';
import type { Offer, ProductGroup } from './types.js';

/** Umbral mínimo de similitud para considerar dos ofertas el mismo producto. */
export const MATCH_THRESHOLD = 0.8;

/**
 * Dos huellas de modelo son incompatibles cuando cada una tiene un código
 * que la otra no tiene (ej. ["128gb","15"] vs ["15","256gb"]).
 * Si una es subconjunto de la otra (una tienda omitió "5g"), se consideran compatibles.
 */
export function fingerprintsConflict(a: string[], b: string[]): boolean {
  const onlyA = a.some((t) => !b.includes(t));
  const onlyB = b.some((t) => !a.includes(t));
  return onlyA && onlyB;
}

/**
 * Similitud difusa entre conjuntos de tokens: para cada token del conjunto
 * más pequeño se toma su mejor Jaro-Winkler contra el otro conjunto.
 */
function fuzzyTokenOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const [small, large] = a.length <= b.length ? [a, b] : [b, a];
  const total = small.reduce((acc, token) => {
    let best = 0;
    for (const other of large) {
      const s = token === other ? 1 : jaroWinkler(token, other);
      if (s > best) best = s;
      if (best === 1) break;
    }
    return acc + (best >= 0.85 ? best : 0);
  }, 0);
  // Penaliza levemente la diferencia de longitud (títulos con mucha info extra).
  const coverage = small.length / large.length;
  return (total / small.length) * (0.85 + 0.15 * coverage);
}

const UNIT_TOKEN = /^\d+(gb|tb|in|l|w|mah|mm|v|g|k)$/;

/**
 * Código de fabricante (equivalente a un MPN): mezcla letras y dígitos, tiene
 * al menos 5 caracteres y no es una simple medida ("du7000", "wh1000xm5",
 * "dcd7781d2", "50ur8750"). Si dos títulos comparten uno, es casi seguro que
 * hablan del mismo producto.
 */
export function isManufacturerCode(token: string): boolean {
  return token.length >= 5 && /[a-z]/.test(token) && /\d/.test(token) && !UNIT_TOKEN.test(token);
}

/** Similitud mínima cuando dos ofertas comparten código de fabricante. */
const SHARED_CODE_FLOOR = 0.92;

/**
 * Palabras que distinguen VARIANTES de un mismo modelo (iPhone 17 vs 17 Pro,
 * AirPods Pro vs AirPods Max) o su condición (nuevo vs reacondicionado). Si
 * una oferta tiene una de estas palabras y la otra no, son productos distintos.
 */
const VARIANT_WORDS = new Set(['pro', 'max', 'plus', 'mini', 'ultra', 'lite', 'fe', 'reacondicionado', 'reacondicionada', 'refurbished', 'usado', 'usada', 'exhibicion']);

export function variantsConflict(a: string, b: string): boolean {
  const va = tokenize(a).filter((t) => VARIANT_WORDS.has(t));
  const vb = tokenize(b).filter((t) => VARIANT_WORDS.has(t));
  return va.some((t) => !vb.includes(t)) || vb.some((t) => !va.includes(t));
}

/**
 * Regla de cordura: el mismo producto nuevo rara vez cuesta más del doble en
 * otra tienda. Una diferencia mayor suele indicar productos distintos.
 */
export const MAX_PRICE_RATIO = 1.9;

/** Similitud (0..1) entre dos ofertas. Combina reglas duras + Jaro-Winkler. */
export function offerSimilarity(a: Offer, b: Offer): number {
  // La categoría NO se compara: cada tienda usa su propia taxonomía.
  if (a.brand && b.brand && a.brand !== b.brand) return 0;
  if (variantsConflict(a.title, b.title)) return 0;
  const [lo, hi] = a.basePrice <= b.basePrice ? [a.basePrice, b.basePrice] : [b.basePrice, a.basePrice];
  if (lo > 0 && hi / lo > MAX_PRICE_RATIO) return 0;

  const fpA = modelFingerprint(a.title);
  const fpB = modelFingerprint(b.title);
  const sharesCode = fpA.some((t) => isManufacturerCode(t) && fpB.includes(t));

  if (sharesCode) {
    // Con código compartido se ignoran números sueltos ("139 cm", "2 baterías"),
    // pero siguen contando capacidades/medidas (128gb vs 256gb sí es otra variante).
    const strong = (fp: string[]) => fp.filter((t) => !/^\d+$/.test(t));
    if (fingerprintsConflict(strong(fpA), strong(fpB))) return 0;
  } else if (fingerprintsConflict(fpA, fpB)) {
    return 0;
  }

  const tokensA = significantTokens(a.title);
  const tokensB = significantTokens(b.title);
  const tokenScore = fuzzyTokenOverlap(tokensA, tokensB);
  const stringScore = jaroWinkler(a.normalizedTitle, b.normalizedTitle);
  const score = 0.65 * tokenScore + 0.35 * stringScore;
  return sharesCode ? Math.max(score, SHARED_CODE_FLOOR) : score;
}

function toTitleCase(text: string): string {
  return text
    .split(' ')
    .map((w) => (w.length <= 2 && !/\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/**
 * Elige el nombre del grupo: el título de la oferta más "central"
 * (mayor similitud promedio con las demás) y, a igualdad, el más corto.
 */
function pickGroupName(offers: Offer[]): string {
  if (offers.length === 1) return offers[0].title;
  let best = offers[0];
  let bestScore = -1;
  for (const candidate of offers) {
    const others = offers.filter((o) => o !== candidate);
    const avg = others.reduce((acc, o) => acc + offerSimilarity(candidate, o), 0) / others.length;
    // Se prefieren títulos en mayúsculas/minúsculas normales (conservan tildes y
    // la marca bien escrita) sobre los publicados TODO EN MAYÚSCULAS.
    const shouting = candidate.title === candidate.title.toUpperCase() ? 0.2 : 0;
    const score = avg - shouting - candidate.title.length / 1000;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  const title = best.title;
  // Si la tienda publica todo en mayúsculas, se suaviza para lectura.
  return title === title.toUpperCase() ? toTitleCase(title.toLowerCase()) : title;
}

/**
 * ID del grupo: el ID_Interno menor de sus ofertas. Así, aunque una tienda no
 * responda en una consulta posterior, el grupo se puede reencontrar buscando
 * la oferta con ese ID (ver `findGroup`).
 */
export function groupIdFor(offers: Offer[]): string {
  return offers.map((o) => o.id).sort()[0];
}

export function findGroup<T extends ProductGroup>(groups: T[], id: string): T | undefined {
  return groups.find((g) => g.id === id) ?? groups.find((g) => g.offers.some((o) => o.id === id));
}

/**
 * Entity Resolution: agrupa ofertas de distintas tiendas que corresponden al
 * mismo producto. Clustering voraz por enlace promedio:
 *  - una oferta se une al grupo con mayor similitud promedio ≥ umbral;
 *  - un grupo no puede tener dos ofertas de la misma tienda (evita fusionar variantes).
 */
export function groupOffers(offers: Offer[], threshold = MATCH_THRESHOLD): ProductGroup[] {
  const clusters: Offer[][] = [];
  // Procesar primero títulos más informativos estabiliza los grupos.
  const ordered = [...offers].sort(
    (a, b) => modelFingerprint(b.title).length - modelFingerprint(a.title).length || a.id.localeCompare(b.id),
  );

  for (const offer of ordered) {
    let bestIndex = -1;
    let bestScore = threshold;
    clusters.forEach((cluster, index) => {
      if (cluster.some((o) => o.store.id === offer.store.id)) return;
      const scores = cluster.map((o) => offerSimilarity(offer, o));
      if (scores.some((s) => s === 0)) return; // conflicto duro con algún miembro
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (avg >= bestScore) {
        bestScore = avg;
        bestIndex = index;
      }
    });
    if (bestIndex >= 0) clusters[bestIndex].push(offer);
    else clusters.push([offer]);
  }

  return clusters.map((cluster) => ({
    id: groupIdFor(cluster),
    name: pickGroupName(cluster),
    brand: cluster.find((o) => o.brand)?.brand ?? null,
    imageUrl: cluster.find((o) => o.imageUrl)?.imageUrl ?? null,
    offers: cluster,
  }));
}
