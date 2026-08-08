# Nöbetçi — Avukatlar Arası Tevkil Ağı

Statik tasarım prototipinden gerçek, çalışan bir web uygulamasına dönüştürme çalışması.

## Durum: Tam özellikli MVP ✅

Prototipteki tüm ana akışlar + üretime yaklaştıran ek katmanlar artık Node.js/Express + PostgreSQL üzerinde gerçek olarak çalışıyor:

- **Üyelik & giriş**: baro/sicil bilgileriyle kayıt, `bcrypt` şifre hash'leme, JWT (httpOnly cookie) oturum. Yeni hesap `pending` durumunda oluşur; admin onaylamadan giriş yapılamaz.
- **Admin paneli**: onay bekleyen/onaylı/reddedilen üyeleri listeleme, onaylama/reddetme.
- **Görev akışı**: görev oluşturma, açık görevleri listeleme, görev kabul etme (atomik/yarış durumuna karşı korumalı), tamamlama + puanlama. Profil sayaçları `tasks` tablosundan canlı hesaplanır.
- **Bildirimler (uygulama içi + e-posta)**: yeni görev açıldığında adliyesi eşleşen onaylı avukatlara, görev kabul edildiğinde görev sahibine, üyelik onaylandığında/reddedildiğinde ilgili avukata bildirim gider. Header'daki 🔔 ikonu okunmamış sayacı gösterir, 30 saniyede bir güncellenir.
- **Adil sıra sistemi**: bir adliyedeki onaylı avukatlar, en az görev üstlenmiş/en uzun süredir görev almamış öncelikli olacak şekilde sıralanır; bu sıra hem bildirim gönderim önceliğini belirler hem de görev oluşturma formunda "adliyedeki sıra" olarak önizlenir. Görevi fiilen kabul etmek yine herkese açıktır (bkz. Bilinen sınırlamalar).
- **Şifre sıfırlama**: "Şifremi unuttum" → e-postayla tek kullanımlık, 1 saat geçerli bağlantı → yeni şifre belirleme. Token asla düz metin saklanmaz (SHA-256 hash'i tutulur).
- **Rate limiting**: login/kayıt/şifre sıfırlama uçlarında IP başına brute-force koruması + tüm `/api` için genel bir taban limit.

Tasarım, orijinal `tevkil-agi.html` prototipiyle birebir aynı — sadece veri katmanı gerçek bir backend'e taşındı.

## Klasör yapısı

```
Tevkil/
├─ server/                 # Express API
│  ├─ src/
│  │  ├─ app.js / server.js
│  │  ├─ config/db.js      # PostgreSQL bağlantı havuzu
│  │  ├─ db/migrations/    # 001 users, 002 tasks, 003 notifications, 004 password reset
│  │  ├─ db/migrate.js     # Migration runner (npm run migrate)
│  │  ├─ middleware/       # auth.js, rateLimit.js, errorHandler.js
│  │  ├─ controllers/      # auth, admin, task, notification, public
│  │  ├─ routes/           # auth, admin, task, notification, public
│  │  ├─ models/           # userModel, taskModel, notificationModel (düz SQL sorguları)
│  │  ├─ services/         # notifyService.js (bildirim + e-posta tetikleyicileri)
│  │  └─ utils/            # jwt.js, mailer.js, asyncHandler.js
│  ├─ package.json
│  └─ .env.example
├─ public/                 # Statik frontend (prototipten uyarlandı, tasarım korunuyor)
│  ├─ index.html
│  ├─ css/style.css
│  └─ js/ (api.js, auth.js, main.js, admin.js, notifications.js)
├─ docker-compose.yml       # Yerel PostgreSQL için (opsiyonel)
└─ .claude/launch.json      # `/run` ile önizleme için
```

## Kurulum

### 1) PostgreSQL

```bash
docker compose up -d
```

Docker yoksa yerel bir PostgreSQL kurup `tevkil_agi` adında bir veritabanı oluşturun.

### 2) Backend bağımlılıkları ve ortam değişkenleri

```bash
cd server
npm install
cp .env.example .env
```

`.env`'de en azından `DATABASE_URL` ve `JWT_SECRET`'i düzenleyin. `SMTP_*` boş bırakılabilir —
boşsa e-postalar gerçekten gönderilmez, sunucu konsoluna yazdırılır (geliştirme için yeterlidir).
Gerçek e-posta göndermek isterseniz `SMTP_HOST/PORT/USER/PASS/FROM` ve `APP_BASE_URL`'i doldurun.

### 3) Migration'ları çalıştırın

```bash
npm run migrate
```

`users`, `tasks`, `notifications` tablolarını ve şifre sıfırlama kolonlarını oluşturur.

### 4) Sunucuyu başlatın

```bash
npm run dev
```

`http://localhost:4000` adresinde hem API (`/api/...`) hem de frontend (`public/`) servis edilir.

## İlk admin hesabını oluşturma

1. `Kayıt Ol` formundan kendi hesabınızı oluşturun (`pending` durumunda kalır).
2. Veritabanında:

```sql
UPDATE users
   SET role = 'admin', status = 'approved', approved_at = now()
 WHERE email = 'ozhanalp44@gmail.com';
```

3. Bu hesapla giriş yapıp header'daki **Admin** sekmesinden diğer üyeleri onaylayabilirsiniz.

## API uç noktaları

| Method | Yol | Açıklama |
|---|---|---|
| POST | `/api/auth/register` | Yeni avukat kaydı (status=pending) |
| POST | `/api/auth/login` | Giriş (yalnızca status=approved) — rate limited |
| POST | `/api/auth/logout` | Oturumu kapatır |
| GET | `/api/auth/me` | Giriş yapmış kullanıcı + canlı profil sayaçları |
| POST | `/api/auth/forgot-password` | Şifre sıfırlama e-postası gönderir — rate limited |
| POST | `/api/auth/reset-password` | Token ile yeni şifre belirler — rate limited |
| GET | `/api/public/stats` | Herkese açık: avukat/görev/tamamlanan sayısı |
| GET/POST | `/api/admin/users...` | (admin) Üye listeleme/onay/red |
| GET | `/api/tasks/open` | Herkese açık: açık görevler |
| GET | `/api/tasks/queue?courthouse=` | (onaylı üye) Adliyedeki adil sıra önizlemesi |
| GET/POST | `/api/tasks/...` | (onaylı üye) mine/taken/create/accept/complete |
| GET | `/api/notifications` | (giriş) Bildirim listesi + okunmamış sayısı |
| POST | `/api/notifications/:id/read` | (giriş) Bildirimi okundu işaretler |
| POST | `/api/notifications/read-all` | (giriş) Tümünü okundu işaretler |

## Bilinen sınırlamalar

- "Adil sıra" bildirim gönderim önceliğini belirler ama görev kabulü hâlâ ilk tıklayan kazanır
  (gerçek zamanlı, tek kişiye özel sıralı teklif sistemi değil — bilinçli bir basitleştirme).
- Gerçek push bildirimi (tarayıcı Web Push / VAPID) yok; bildirimler in-app (30 sn polling) + e-posta ile gidiyor.
- SMTP yapılandırılmadan e-postalar gerçekten gönderilmez, sadece sunucu konsoluna yazdırılır.
- `express-rate-limit` varsayılan olarak `req.ip` kullanır; reverse proxy arkasında çalıştırırken
  `.env`'e `TRUST_PROXY=1` eklemeyi unutmayın.
