import { jaroWinkler } from './jaroWinkler';

/**
 * Palabras que aportan ruido comercial o descriptivo y no ayudan a
 * identificar el producto ("envío gratis", "original", "inalámbricos"...).
 * Se eliminan antes de comparar títulos entre tiendas.
 */
const NOISE = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'con', 'para', 'por', 'y', 'en', 'un', 'una', 'x',
  'the', 'with', 'and', 'for', 'new', 'original', 'nuevo', 'nueva', 'oferta', 'envio', 'gratis',
  'garantia', 'oficial', 'version', 'global', 'edition', 'edicion', 'color', 'unidad', 'und',
  'inalambrico', 'inalambricos', 'inalambrica', 'wireless', 'bluetooth', 'noise', 'cancelling',
  'cancelacion', 'ruido', 'activa', 'smartphone', 'celular', 'telefono', 'phone', 'headphones',
  'audifonos', 'diadema', 'over', 'ear', 'portatil', 'laptop', 'notebook', 'tenis', 'zapatillas',
  'running', 'shoes', 'hombre', 'mujer', 'unisex', 'negro', 'negra', 'black', 'blanco', 'blanca',
  'white', 'gris', 'gray', 'grey', 'azul', 'blue', 'plata', 'silver', 'grafito', 'medianoche',
  'tv', 'televisor', 'smart', 'pulgadas', 'pulg', 'inch', 'in', 'led', 'cafetera', 'coffee',
  'maker', 'freidora', 'aire', 'air', 'fryer', 'aspiradora', 'robot', 'vacuum', 'cleaner',
  'reloj', 'smartwatch', 'watch', 'consola', 'console', 'parlante', 'speaker', 'altavoz',
  'taladro', 'percutor', 'drill', 'impact', 'kit', 'set', 'pack', 'combo', 'licuadora',
  'blender', 'colchon', 'mattress', 'bicicleta', 'bike', 'mtb', 'rin', 'ram', 'ssd', 'memoria',
  'almacenamiento', 'storage', 'pantalla', 'screen', 'camara', 'camera', 'gb', 'tb',
  'portable', 'waterproof', 'generacion', 'generation', 'gen', 'estuche', 'case', 'aspirador',
  'mi', 'digital', 'mouse', 'raton', 'gps', 'disco', 'oscuro', 'claro', 'mate', 'cm', 'max',
  'intel', 'core', 'amd', 'uhd', 'velocidades', 'vel', 'hammer', 'brushless', 'baterias',
]);

/**
 * Sinónimos de marca / escritura que distintas tiendas publican diferente.
 * Se aplican después de quitar tildes y pasar a minúsculas.
 */
const ALIASES: Record<string, string> = {
  'play station': 'playstation',
  'ps5': 'playstation 5',
  'mac book': 'macbook',
  'i phone': 'iphone',
  'airfryer': 'air fryer',
  'jbl': 'jbl',
};

export const KNOWN_BRANDS = [
  'apple', 'samsung', 'xiaomi', 'motorola', 'sony', 'jbl', 'lenovo', 'asus', 'hp', 'lg',
  'oster', 'imusa', 'nike', 'adidas', 'dewalt', 'black+decker', 'nintendo',
  'huawei', 'philips', 'kalley', 'logitech', 'garmin', 'roborock', 'nespresso', 'gw',
] as const;

export function stripAccents(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Minúsculas, sin tildes, sin signos; une códigos como "WH-1000XM5" → "wh1000xm5". */
export function cleanText(text: string): string {
  let t = stripAccents(text.toLowerCase());
  t = t.replace(/(\d+)[.,](\d+)/g, '$1$2'); // 15.6 → 156
  t = t.replace(/(\d+)\s*\/\s*(\d+)/g, '$1x$2'); // 1/2" → 1x2in
  t = t.replace(/(\d+)\s?(?:"|”|''|pulgadas|pulg|inch(?:es)?)/g, '$1in ');
  t = t.replace(/(\d+)\s?(?:litros|litro|lts|lt|l)\b/g, '$1l');
  t = t.replace(/(\d+)\s?(gb|tb|w|mah|mm)\b/g, '$1$2');
  t = t.replace(/\b(\d+)(?:da|do|nd|rd|th|st|ra|ro|a|o)\b/g, '$1'); // 2da generación → 2
  // Une códigos de modelo con guion (prefijo corto + dígitos): wh-1000xm5 → wh1000xm5
  t = t.replace(/\b([a-z]{1,3})-(\d+[a-z0-9]*)\b/g, '$1$2');
  t = t.replace(/[^a-z0-9+\s]/g, ' ');
  for (const [from, to] of Object.entries(ALIASES)) {
    t = t.replace(new RegExp(`\\b${from}\\b`, 'g'), to);
  }
  return t.replace(/\s+/g, ' ').trim();
}

export function tokenize(text: string): string[] {
  return cleanText(text).split(' ').filter(Boolean);
}

/** Tokens significativos para el emparejamiento (sin ruido). */
export function significantTokens(text: string): string[] {
  return tokenize(text).filter((t) => !NOISE.has(t));
}

/** Nombre Normalizado: tokens significativos ordenados alfabéticamente. */
export function normalizeTitle(text: string): string {
  return [...new Set(significantTokens(text))].sort().join(' ');
}

export function detectBrand(text: string): string | null {
  const tokens = tokenize(text);
  for (const brand of KNOWN_BRANDS) {
    if (tokens.includes(brand)) return brand;
  }
  // Inferencia por línea de producto
  if (tokens.some((t) => t === 'iphone' || t === 'macbook' || t === 'airpods' || t === 'ipad')) return 'apple';
  if (tokens.includes('galaxy')) return 'samsung';
  if (tokens.includes('playstation')) return 'sony';
  if (tokens.includes('redmi')) return 'xiaomi';
  if (tokens.includes('switch')) return 'nintendo';
  return null;
}

/**
 * "Huella" del modelo: tokens que contienen dígitos (códigos de modelo,
 * capacidades, tamaños). Si dos títulos tienen huellas distintas,
 * casi con seguridad son productos distintos (XM4 vs XM5, 128gb vs 256gb).
 */
export function modelFingerprint(text: string): string[] {
  return [...new Set(tokenize(text).filter((t) => /\d/.test(t)))].sort();
}

/**
 * ¿El título responde a la búsqueda? Cada término debe aparecer como
 * prefijo de algún token o parecerse mucho (tolerancia a errores de tipeo).
 */
const QUERY_SYNONYMS: Record<string, string[]> = {
  audifonos: ['headphones', 'earbuds', 'airpods', 'auriculares'],
  parlante: ['speaker', 'altavoz', 'bafle'],
  portatil: ['laptop', 'notebook'],
  computador: ['portatil', 'laptop'],
  freidora: ['fryer'],
  reloj: ['watch', 'smartwatch'],
  taladro: ['drill'],
  aspiradora: ['vacuum', 'aspirador'],
  televisor: ['tv'],
  tv: ['televisor'],
  celular: ['phone', 'smartphone', 'iphone', 'galaxy', 'redmi'],
  tenis: ['zapatillas', 'shoes'],
  cafetera: ['coffee'],
  consola: ['console', 'playstation', 'switch'],
  bicicleta: ['bike'],
};

function tokenMatches(queryToken: string, titleTokens: string[]): boolean {
  return titleTokens.some(
    (t) =>
      t.startsWith(queryToken) ||
      (queryToken.length >= 4 && !/\d/.test(queryToken) && jaroWinkler(queryToken, t) >= 0.9),
  );
}

/**
 * ¿El título responde a la búsqueda? Cada término debe aparecer como prefijo
 * de algún token, parecerse mucho (tolerancia a errores de tipeo) o tener un
 * sinónimo presente (las tiendas internacionales publican en inglés).
 */
export function matchesQuery(title: string, query: string): boolean {
  const queryTokens = tokenize(query).filter((t) => (t.length > 1 || /\d/.test(t)) && !STOP_QUERY.has(t));
  if (queryTokens.length === 0) return false;
  const titleTokens = tokenize(title);
  return queryTokens.every((q) => {
    if (tokenMatches(q, titleTokens)) return true;
    const synonyms = Object.entries(QUERY_SYNONYMS).find(([key]) => key === q || (q.length >= 4 && key.startsWith(q)));
    return synonyms ? synonyms[1].some((s) => tokenMatches(s, titleTokens)) : false;
  });
}

const STOP_QUERY = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'para', 'y', 'en', 'un', 'una']);
