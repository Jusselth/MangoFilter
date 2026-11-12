import type { Db } from './db/index.js';

/** Copia de `PreferencesState` del frontend (sin datos del dispositivo). */
export interface Preferences {
  city: string;
  cityName: string;
  criterion: 'precio' | 'equilibrado' | 'rapidez';
  themeMode: 'system' | 'light' | 'dark';
  haptics: boolean;
}

/** Copia de `SavedProduct` del frontend. */
export interface SavedProduct {
  id: string;
  name: string;
  imageUrl: string | null;
  query: string;
  bestTotalAtSave: number;
  /** Epoch en milisegundos. */
  savedAt: number;
}

export const MAX_SAVED = 200;

interface PrefRow {
  city: string;
  city_name: string;
  criterion: Preferences['criterion'];
  theme_mode: Preferences['themeMode'];
  haptics: boolean;
}

interface SavedRow {
  product_id: string;
  name: string;
  image_url: string | null;
  query: string;
  best_total_at_save: string | number;
  saved_at_ms: number;
}

const toSaved = (r: SavedRow): SavedProduct => ({
  id: r.product_id,
  name: r.name,
  imageUrl: r.image_url,
  query: r.query,
  bestTotalAtSave: Number(r.best_total_at_save),
  savedAt: Number(r.saved_at_ms),
});

/** Preferencias y guardados de cada cuenta. */
export function createUserData(db: Db) {
  async function getPreferences(userId: string): Promise<Preferences | null> {
    const [r] = await db.query<PrefRow>(
      `select city, city_name, criterion, theme_mode, haptics from mangofilter.preferences where user_id = $1`,
      [userId],
    );
    return r ? { city: r.city, cityName: r.city_name, criterion: r.criterion, themeMode: r.theme_mode, haptics: r.haptics } : null;
  }

  /** `onlyIfMissing`: al sincronizar tras el login, las preferencias ya guardadas en la cuenta ganan. */
  async function putPreferences(userId: string, p: Preferences, onlyIfMissing = false): Promise<void> {
    await db.query(
      `insert into mangofilter.preferences (user_id, city, city_name, criterion, theme_mode, haptics, updated_at)
       values ($1, $2, $3, $4, $5, $6, now())
       on conflict (user_id) do ${
         onlyIfMissing
           ? 'nothing'
           : `update set city = excluded.city, city_name = excluded.city_name, criterion = excluded.criterion,
                         theme_mode = excluded.theme_mode, haptics = excluded.haptics, updated_at = now()`
       }`,
      [userId, p.city, p.cityName, p.criterion, p.themeMode, p.haptics],
    );
  }

  async function listSaved(userId: string): Promise<SavedProduct[]> {
    const rows = await db.query<SavedRow>(
      `select product_id, name, image_url, query, best_total_at_save,
              (extract(epoch from saved_at) * 1000)::float8 as saved_at_ms
         from mangofilter.saved_products where user_id = $1 order by saved_at desc`,
      [userId],
    );
    return rows.map(toSaved);
  }

  /** Guarda (o deja como estaba si ya existía). Respeta el máximo por cuenta. */
  async function addSaved(userId: string, items: SavedProduct[]): Promise<void> {
    if (items.length === 0) return;
    const [{ n }] = await db.query<{ n: number }>(`select count(*)::int as n from mangofilter.saved_products where user_id = $1`, [userId]);
    const room = Math.max(0, MAX_SAVED - n);
    for (const item of items.slice(0, room)) {
      await db.query(
        `insert into mangofilter.saved_products (user_id, product_id, name, image_url, query, best_total_at_save, saved_at)
         values ($1, $2, $3, $4, $5, $6, to_timestamp($7 / 1000.0))
         on conflict (user_id, product_id) do nothing`,
        [userId, item.id, item.name, item.imageUrl, item.query, Math.round(item.bestTotalAtSave), Math.min(item.savedAt, Date.now())],
      );
    }
    if (items.length > room) throw new SavedLimitError();
  }

  async function removeSaved(userId: string, productId: string): Promise<void> {
    await db.query(`delete from mangofilter.saved_products where user_id = $1 and product_id = $2`, [userId, productId]);
  }

  /** Borra la cuenta: preferencias, guardados y sesiones se van en cascada. */
  async function deleteUser(userId: string): Promise<void> {
    await db.query(`delete from mangofilter.users where id = $1`, [userId]);
  }

  return { getPreferences, putPreferences, listSaved, addSaved, removeSaved, deleteUser };
}

export class SavedLimitError extends Error {
  constructor() {
    super(`Puedes guardar hasta ${MAX_SAVED} productos.`);
  }
}

export type UserData = ReturnType<typeof createUserData>;
