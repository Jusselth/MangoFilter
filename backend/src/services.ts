import { createAnalytics, type Analytics } from './analytics.js';
import { createConsoleMailer, createGmailMailer, type Mailer } from './auth/mailer.js';
import { createAuthService, type AuthService } from './auth/service.js';
import type { AppConfig } from './config.js';
import type { Db } from './db/index.js';
import { createUserData, type UserData } from './userData.js';

/** Servicios que dependen de la base de datos (cuentas, eventos y estadísticas). */
export interface Services {
  db: Db;
  auth: AuthService;
  analytics: Analytics;
  userData: UserData;
  trendingMinPeople: number;
}

export function createMailer(config: AppConfig): Mailer | null {
  if (config.gmailUser && config.gmailAppPassword) return createGmailMailer(config.gmailUser, config.gmailAppPassword);
  if (config.mailDevLog) return createConsoleMailer();
  return null;
}

export function createServices(db: Db, mailer: Mailer, config: Pick<AppConfig, 'authSecret' | 'trendingMinPeople'>): Services {
  if (!config.authSecret) throw new Error('Falta AUTH_SECRET.');
  return {
    db,
    auth: createAuthService({ db, mailer, secret: config.authSecret }),
    analytics: createAnalytics(db, config.authSecret),
    userData: createUserData(db),
    trendingMinPeople: config.trendingMinPeople,
  };
}
