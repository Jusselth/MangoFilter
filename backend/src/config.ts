/**
 * Configuración leída de variables de entorno (backend/.env). Las cuentas,
 * estadísticas y recomendaciones solo se activan si están DATABASE_URL y
 * AUTH_SECRET; sin ellas la búsqueda sigue funcionando igual.
 */
export interface AppConfig {
  databaseUrl: string | null;
  /** Ruta al certificado raíz de Supabase para verificar el TLS de la base de datos. */
  databaseSslCaPath: string | null;
  /** Secreto para HMAC de códigos y seudónimos (mínimo 32 caracteres). */
  authSecret: string | null;
  gmailUser: string | null;
  gmailAppPassword: string | null;
  /** Solo desarrollo: imprime el código en la consola en lugar de enviarlo. */
  mailDevLog: boolean;
  /** Personas distintas que deben haber hecho una búsqueda para que aparezca en "más buscados". */
  trendingMinPeople: number;
  /** true si el backend está detrás de un proxy (Render, Railway…): usa X-Forwarded-For como IP. */
  trustProxy: boolean;
}

const str = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

export function readConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const authSecret = str(env.AUTH_SECRET);
  if (authSecret && authSecret.length < 32) {
    throw new Error('AUTH_SECRET debe tener al menos 32 caracteres (usa: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))").');
  }
  return {
    databaseUrl: str(env.DATABASE_URL),
    databaseSslCaPath: str(env.DATABASE_SSL_CA),
    authSecret,
    gmailUser: str(env.GMAIL_USER),
    // Google muestra la contraseña de aplicación en grupos de 4 con espacios: se quitan.
    gmailAppPassword: str(env.GMAIL_APP_PASSWORD)?.replace(/\s+/g, '') ?? null,
    mailDevLog: env.MAIL_DEV_LOG === 'true',
    trendingMinPeople: Math.max(1, Number(env.TRENDING_MIN_PEOPLE ?? 3) || 3),
    trustProxy: env.TRUST_PROXY === 'true',
  };
}
