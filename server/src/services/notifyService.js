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

/** Bir göreve yeni başvuru geldiğinde görev sahibine bildirim (isim/adres gizli, Görev Takibi'nden görülür). */
async function notifyNewApplication(task, applicant) {
  const owner = await userModel.findById(task.owner_id);
  if (!owner) return;
  const title = 'Yeni başvuru: ' + task.title;
  const body = 'Görevinize yeni bir başvuru geldi. Görev Takibi\'nden inceleyip onaylayabilirsiniz.';

  await notificationModel.create({ userId: owner.id, type: 'task_application', title, body, taskId: task.id });
  await mailer.sendMail({
    to: owner.email,
    subject: '[Nöbetçi] ' + title,
    text:
      'Merhaba ' + owner.full_name + ',\n\n' +
      '"' + task.title + '" görevinize yeni bir başvuru geldi.\n' +
      'Başvuranı incelemek ve onaylamak için panelinizdeki "Görev Takibi" sekmesine girin.\n',
  });
}

/**
 * Görev sahibi bir başvuruyu onayladığında: kendisine üstlenen kişinin TAM bilgileri
 * (telefon, iletişim adresi, tevkil bilgileri) mail olarak gider; onaylanan başvurana da
 * görev sahibinin en kısa zamanda kendisini arayacağı bilgisi in-app + mail olarak iletilir.
 */
async function notifyApplicationApproved(task) {
  const [owner, assignee] = await Promise.all([
    userModel.findById(task.owner_id),
    userModel.findById(task.assignee_id),
  ]);

  if (owner) {
    const title = 'Göreviniz üstlenildi: ' + task.title;
    await notificationModel.create({ userId: owner.id, type: 'task_accepted', title, taskId: task.id });
    await mailer.sendMail({
      to: owner.email,
      subject: '[Nöbetçi] ' + title,
      text:
        'Merhaba ' + owner.full_name + ',\n\n' +
        '"' + task.title + '" görevini ' + task.assignee_name + ' üstlendi.\n\n' +
        'Üstlenen meslektaşınızın ilettiği bilgiler:\n' +
        'Ad Soyad: ' + task.assignee_name + '\n' +
        'Telefon: ' + (task.acceptance_phone || '—') + '\n' +
        'İletişim Adresi: ' + (task.acceptance_contact || '—') + '\n' +
        'Tevkil ile İlgili Bilgiler: ' + (task.acceptance_note || '—') + '\n',
    });
  }

  if (assignee) {
    const title = 'Başvurunuz onaylandı: ' + task.title;
    const body = 'Görevi veren avukat en kısa zamanda sizi arayacaktır.';
    await notificationModel.create({ userId: assignee.id, type: 'application_approved', title, body, taskId: task.id });
    await mailer.sendMail({
      to: assignee.email,
      subject: '[Nöbetçi] ' + title,
      text:
        'Merhaba ' + assignee.full_name + ',\n\n' +
        '"' + task.title + '" görevi için başvurunuz onaylandı.\n' +
        'Görevi veren avukat (' + task.owner_name + '), paylaştığınız iletişim bilgileriyle en kısa zamanda sizi arayacaktır.\n',
    });
  }
}

/** Görev sahibi başvuruyu görev hâlâ açıkken elle reddettiğinde. */
async function notifyApplicationRejected(applicant, task) {
  const title = 'Başvurunuz uygun görülmedi: ' + task.title;
  const body = 'Görev sahibi başvurunuzu bu görev için uygun görmedi.';
  await notificationModel.create({ userId: applicant.id, type: 'application_rejected', title, body, taskId: task.id });
}

/** Görev başka bir başvurana verildiği için otomatik elenen diğer başvuru sahiplerine. */
async function notifyApplicationAutoRejected(applicant, task) {
  const title = 'Başvurunuz değerlendirilmedi: ' + task.title;
  const body = 'Bu görev başka bir meslektaşınıza verildi.';
  await notificationModel.create({ userId: applicant.id, type: 'application_rejected', title, body, taskId: task.id });
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
  notifyNewApplication,
  notifyApplicationApproved,
  notifyApplicationRejected,
  notifyApplicationAutoRejected,
  notifyAccountApproved,
  notifyAccountRejected,
  notifyAvatarApproved,
  notifyAvatarRejected,
};
