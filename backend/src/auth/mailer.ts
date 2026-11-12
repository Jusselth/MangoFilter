import nodemailer from 'nodemailer';

export interface Mailer {
  sendLoginCode(email: string, code: string): Promise<void>;
}

const MINUTES = 10;

function text(code: string) {
  return [
    `Tu código para entrar a MangoFilter es: ${code}`,
    '',
    `Vence en ${MINUTES} minutos y solo se puede usar una vez.`,
    'Si no lo pediste, ignora este correo: nadie puede entrar a tu cuenta sin este código.',
  ].join('\n');
}

function html(code: string) {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#FFF8EE;font-family:Arial,Helvetica,sans-serif;color:#2B2016">
<div style="max-width:440px;margin:0 auto;padding:32px 24px">
  <p style="font-size:18px;font-weight:bold;margin:0 0 16px">MangoFilter</p>
  <p style="margin:0 0 12px">Tu código para entrar es:</p>
  <p style="font-size:34px;letter-spacing:8px;font-weight:bold;margin:0 0 16px;color:#B35C00">${code}</p>
  <p style="margin:0 0 8px">Vence en ${MINUTES} minutos y solo se puede usar una vez.</p>
  <p style="margin:0;color:#6B5B4B;font-size:13px">Si no lo pediste, ignora este correo: nadie puede entrar a tu cuenta sin este código.</p>
</div></body></html>`;
}

/**
 * Envío por SMTP de Gmail con una "contraseña de aplicación" (gratis, hasta
 * ~500 correos al día). Para producción con más volumen basta con cambiar
 * este archivo por otro proveedor (Resend, Brevo, SES) con dominio propio.
 */
export function createGmailMailer(user: string, appPassword: string): Mailer {
  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass: appPassword },
  });
  return {
    async sendLoginCode(email, code) {
      await transport.sendMail({
        from: { name: 'MangoFilter', address: user },
        to: email,
        subject: `${code} es tu código de MangoFilter`,
        text: text(code),
        html: html(code),
      });
    },
  };
}

/** SOLO desarrollo (MAIL_DEV_LOG=true): muestra el código en la consola del backend. */
export function createConsoleMailer(): Mailer {
  return {
    async sendLoginCode(email, code) {
      console.log(`\n[MAIL_DEV_LOG] Código para ${email}: ${code}\n`);
    },
  };
}
