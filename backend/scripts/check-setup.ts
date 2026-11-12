/**
 * Verifica la configuración de backend/.env sin enviar correos:
 *   npm run check
 * - Conexión a la base de datos (con TLS y certificado, si está configurado).
 * - Que existan las 7 tablas de db/schema.sql.
 * - Que Gmail acepte el usuario y la contraseña de aplicación.
 */
import { existsSync } from 'node:fs';

import nodemailer from 'nodemailer';

import { readConfig } from '../src/config.js';
import { createPgDb } from '../src/db/index.js';

if (existsSync('.env')) process.loadEnvFile('.env');
else console.log('✗ No existe backend/.env (copia .env.example como .env).');

const config = readConfig();
let ok = true;
const fail = (msg: string) => {
  ok = false;
  console.log(`✗ ${msg}`);
};

console.log(config.authSecret ? '✓ AUTH_SECRET definido' : '✗ Falta AUTH_SECRET');
if (!config.authSecret) ok = false;

if (!config.databaseUrl) fail('Falta DATABASE_URL');
else {
  const db = createPgDb(config.databaseUrl, config.databaseSslCaPath);
  try {
    const [v] = await db.query<{ version: string }>('select version()');
    console.log(`✓ Conectado a la base de datos${config.databaseSslCaPath ? ' (certificado verificado)' : ' (TLS sin verificar certificado)'}: ${v.version.split(',')[0]}`);
    const tables = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'mangofilter' order by table_name`,
    );
    const expected = ['click_events', 'login_codes', 'preferences', 'saved_products', 'search_events', 'sessions', 'users'];
    const missing = expected.filter((t) => !tables.some((r) => r.table_name === t));
    if (missing.length) fail(`Faltan tablas en el esquema mangofilter: ${missing.join(', ')}. Ejecuta db/schema.sql en el SQL Editor.`);
    else console.log('✓ Las 7 tablas del esquema mangofilter existen');
  } catch (e) {
    fail(`Base de datos: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    await db.close();
  }
}

if (config.gmailUser && config.gmailAppPassword) {
  const transport = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: config.gmailUser, pass: config.gmailAppPassword } });
  try {
    await transport.verify();
    console.log(`✓ Gmail acepta las credenciales de ${config.gmailUser}`);
  } catch (e) {
    fail(`Gmail: ${e instanceof Error ? e.message : String(e)}`);
  }
} else if (config.mailDevLog) console.log('• Sin Gmail: MAIL_DEV_LOG=true (los códigos salen en la consola)');
else fail('Faltan GMAIL_USER y GMAIL_APP_PASSWORD');

console.log(ok ? '\nTodo listo: reinicia el backend y debe decir "Cuentas: activas".' : '\nHay problemas: revisa los puntos marcados con ✗.');
process.exit(ok ? 0 : 1);
