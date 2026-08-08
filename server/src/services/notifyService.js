const notificationModel = require('../models/notificationModel');
const userModel = require('../models/userModel');
const mailer = require('../utils/mailer');

/**
 * Yeni bir görev açıldığında: aynı adliyede kayıtlı, onaylı avukatlara
 * (görevi açan hariç) adil sıra önceliğine göre in-app + e-posta bildirimi gönderir.
 * Sıra bilgisi (queuePosition) sadece bildirimin ne sırayla gittiğini belirler —
 * görevi kabul etmek hâlâ herkese açıktır (bkz. README "Bilinen sınırlamalar").
 */
async function notifyTaskOpenMatch(task) {
  const candidates = await userModel.listApprovedByCourthouseInQueueOrder(task.city, {
    excludeUserId: task.owner_id,
  });
  if (candidates.length === 0) return;

  const userIds = candidates.map((c) => c.id);
  const title = 'Yeni görev: ' + task.title;
  const body = task.city + ' — ' + task.owner_name + ' tarafından açıldı.';

  await notificationModel.createMany(userIds, { type: 'task_open_match', title, body, taskId: task.id });

  // E-postaları sıra önceliğine göre (queuePosition bilgisiyle) tek tek gönderiyoruz.
  await Promise.all(
    candidates.map((c, idx) =>
      mailer.sendMail({
        to: c.email,
        subject: '[Nöbetçi] ' + title,
        text:
          'Merhaba ' + c.full_name + ',\n\n' +
          task.city + ' için yeni bir görev açıldı:\n' +
          '"' + task.title + '" — ' + task.owner_name + '\n\n' +
          'Sıra önceliğiniz: ' + (idx + 1) + '. sıra.\n' +
          'Görevi görmek ve üstlenmek için panele giriş yapın.\n',
      })
    )
  );
}

/** Görev üstlenildiğinde görev sahibine bildirim. */
async function notifyTaskAccepted(task) {
  const owner = await userModel.findById(task.owner_id);
  if (!owner) return;
  const title = 'Göreviniz üstlenildi: ' + task.title;
  const body = task.assignee_name + ' bu görevi üstlendi.';

  await notificationModel.create({ userId: owner.id, type: 'task_accepted', title, body, taskId: task.id });
  await mailer.sendMail({
    to: owner.email,
    subject: '[Nöbetçi] ' + title,
    text:
      'Merhaba ' + owner.full_name + ',\n\n' +
      '"' + task.title + '" görevinizi ' + task.assignee_name + ' üstlendi.\n\n' +
      'Üstlenen meslektaşınızın ilettiği bilgiler:\n' +
      'Telefon: ' + (task.acceptance_phone || '—') + '\n' +
      'İletişim Adresi: ' + (task.acceptance_contact || '—') + '\n' +
      'Tevkil ile İlgili Bilgiler: ' + (task.acceptance_note || '—') + '\n',
  });
}

async function notifyAccountApproved(user) {
  const title = 'Üyeliğiniz onaylandı';
  const body = 'Artık Nöbetçi\'ye giriş yapıp görev alıp verebilirsiniz.';
  await notificationModel.create({ userId: user.id, type: 'account_approved', title, body });
  await mailer.sendMail({
    to: user.email,
    subject: '[Nöbetçi] ' + title,
    text: 'Merhaba ' + user.full_name + ',\n\nÜyelik başvurunuz onaylandı. Artık giriş yapabilirsiniz.\n',
  });
}

async function notifyAccountRejected(user, reason) {
  const title = 'Üyelik başvurunuz onaylanmadı';
  const body = reason || undefined;
  await notificationModel.create({ userId: user.id, type: 'account_rejected', title, body });
  await mailer.sendMail({
    to: user.email,
    subject: '[Nöbetçi] ' + title,
    text: 'Merhaba ' + user.full_name + ',\n\nÜyelik başvurunuz onaylanmadı.' + (reason ? ' Sebep: ' + reason : '') + '\n',
  });
}

async function notifyAvatarApproved(user) {
  const title = 'Profil fotoğrafınız onaylandı';
  const body = 'Fotoğrafınız artık profilinizde herkese görünür.';
  await notificationModel.create({ userId: user.id, type: 'avatar_approved', title, body });
  await mailer.sendMail({
    to: user.email,
    subject: '[Nöbetçi] ' + title,
    text: 'Merhaba ' + user.full_name + ',\n\nYüklediğiniz profil fotoğrafı onaylandı.\n',
  });
}

async function notifyAvatarRejected(user, reason) {
  const title = 'Profil fotoğrafınız onaylanmadı';
  const body = reason || undefined;
  await notificationModel.create({ userId: user.id, type: 'avatar_rejected', title, body });
  await mailer.sendMail({
    to: user.email,
    subject: '[Nöbetçi] ' + title,
    text: 'Merhaba ' + user.full_name + ',\n\nYüklediğiniz profil fotoğrafı onaylanmadı.' + (reason ? ' Sebep: ' + reason : '') + ' Profilinizden yeni bir fotoğraf yükleyebilirsiniz.\n',
  });
}

module.exports = {
  notifyTaskOpenMatch,
  notifyTaskAccepted,
  notifyAccountApproved,
  notifyAccountRejected,
  notifyAvatarApproved,
  notifyAvatarRejected,
};
