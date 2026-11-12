import { readFileSync } from 'node:fs';

import pg from 'pg';

/**
 * Acceso mínimo a PostgreSQL. Las consultas usan parámetros ($1, $2…), nunca
 * concatenación de texto, así que no hay inyección SQL. La interfaz es tan
 * pequeña que las pruebas la implementan con PGlite (PostgreSQL real en memoria).
 */
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
}

/**
 * Conexión a Supabase con el "Session pooler" (IPv4, puerto 5432).
 * - TLS siempre activo. Si se indica el certificado raíz de Supabase
 *   (DATABASE_SSL_CA) se verifica la identidad del servidor; si no, el tráfico
 *   va cifrado pero sin verificar el certificado.
 * - Se quita `sslmode` de la URL: en `pg` sobrescribe la opción `ssl`.
 */
export function createPgDb(databaseUrl: string, sslCaPath: string | null): Db {
  const url = new URL(databaseUrl);
  url.searchParams.delete('sslmode');
  // Un PostgreSQL en el mismo computador (desarrollo) no usa TLS; cualquier otro host, siempre.
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const pool = new pg.Pool({
    connectionString: url.toString(),
    ssl: local ? false : sslCaPath ? { ca: readFileSync(sslCaPath, 'utf8'), rejectUnauthorized: true } : { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  // Un error en una conexión inactiva no debe tumbar el servidor.
  pool.on('error', (error) => console.error('[db] conexión inactiva con error:', error.message));
  return {
    async query<T>(text: string, params: unknown[] = []) {
      const result = await pool.query(text, params);
      return result.rows as T[];
    },
    close: () => pool.end(),
  };
}
