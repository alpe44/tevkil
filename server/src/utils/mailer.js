const nodemailer = require('nodemailer');

let transporter = null;
let smtpConfigured = false;

function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST) {
    smtpConfigured = false;
    return null;
  }

  smtpConfigured = true;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
  return transporter;
}

/**
 * E-posta gönderir. SMTP_HOST tanımlı değilse (dev ortamı) gerçekten göndermek yerine
 * içeriği konsola yazar — böylece SMTP olmadan da tüm bildirim akışı geliştirilip
 * test edilebilir, production'da sadece .env'e SMTP bilgileri eklemek yeterli olur.
 */
async function sendMail({ to, subject, text, html }) {
  const t = getTransporter();
  const from = process.env.SMTP_FROM || 'Nöbetçi <bildirim@tevkil-agi.local>';

  if (!t) {
    console.log('\n[mailer] SMTP yapılandırılmadı — e-posta konsola yazdırılıyor:');
    console.log(`  Kime: ${to}`);
    console.log(`  Konu: ${subject}`);
    console.log(`  İçerik: ${text}\n`);
    return { simulated: true };
  }

  try {
    const info = await t.sendMail({ from, to, subject, text, html });
    return { simulated: false, messageId: info.messageId };
  } catch (err) {
    // E-posta gönderimi başarısız olsa bile ana işlemi (görev oluşturma, onay vb.)
    // çökertmemeli — sadece logluyoruz.
    console.error('[mailer] Gönderim hatası:', err.message);
    return { simulated: false, error: err.message };
  }
}

module.exports = { sendMail, isConfigured: () => smtpConfigured };
