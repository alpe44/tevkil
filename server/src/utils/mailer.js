const https = require('https');
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
 * Resend'in HTTP API'si üzerinden e-posta gönderir. Bazı barındırma sağlayıcıları
 * (ör. Railway) giden SMTP bağlantılarını çok yavaş/tıkanık yönlendirebiliyor
 * (dakikalarca gecikme); HTTPS/443 üzerinden çalışan bu API yolu çok daha hızlı
 * ve güvenilir. RESEND_API_KEY tanımlıysa SMTP yerine bu kullanılır.
 */
function sendViaResendApi({ from, to, subject, text, html }) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ from, to, subject, text, html });
    const req = https.request(
      {
        hostname: 'api.resend.com',
        path: '/emails',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(payload, 'utf8'),
        },
        timeout: 15000,
      },
      (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            let parsed = {};
            try {
              parsed = JSON.parse(body);
            } catch (e) {
              /* yanıt boş/parse edilemedi olabilir, önemli değil */
            }
            resolve(parsed);
          } else {
            reject(new Error(`Resend API ${res.statusCode}: ${body}`));
          }
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('Resend API isteği zaman aşımına uğradı.')));
    req.on('error', reject);
    req.write(payload, 'utf8');
    req.end();
  });
}

/**
 * E-posta gönderir. Öncelik sırası:
 *   1) RESEND_API_KEY tanımlıysa Resend HTTP API (hızlı, SMTP port kısıtlamalarından etkilenmez)
 *   2) SMTP_HOST tanımlıysa klasik SMTP (nodemailer)
 *   3) İkisi de yoksa (dev ortamı) içeriği konsola yazar — SMTP olmadan da tüm
 *      bildirim akışı geliştirilip test edilebilir, production'da sadece ortam
 *      değişkeni eklemek yeterli olur.
 */
async function sendMail({ to, subject, text, html }) {
  const from = process.env.SMTP_FROM || 'Nöbetçi <bildirim@tevkil-agi.local>';

  if (process.env.RESEND_API_KEY) {
    try {
      const info = await sendViaResendApi({ from, to, subject, text, html });
      return { simulated: false, messageId: info.id };
    } catch (err) {
      console.error('[mailer] Resend API gönderim hatası:', err.message);
      return { simulated: false, error: err.message };
    }
  }

  const t = getTransporter();
  if (!t) {
    console.log('\n[mailer] SMTP/Resend yapılandırılmadı — e-posta konsola yazdırılıyor:');
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

module.exports = { sendMail, isConfigured: () => smtpConfigured || Boolean(process.env.RESEND_API_KEY) };
