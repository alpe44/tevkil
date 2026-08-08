/* ===================== BİLDİRİMLER ===================== */
let notifOpen = false;
let notifPollHandle = null;

async function refreshNotifications() {
  const area = document.getElementById('notifArea');
  if (!currentUser) {
    area.style.display = 'none';
    return;
  }
  area.style.display = '';
  try {
    const { notifications, unreadCount } = await api.listNotifications();
    const badge = document.getElementById('notifBadge');
    badge.textContent = unreadCount > 9 ? '9+' : String(unreadCount);
    badge.style.display = unreadCount > 0 ? 'inline-flex' : 'none';
    renderNotifList(notifications);
  } catch (e) {
    /* bildirim yüklenemezse arayüzü bozma, sessiz geç */
  }
}

function notifItemHTML(n) {
  return (
    '<div class="notif-item ' + (n.read_at ? '' : 'unread') + '" onclick="handleNotifClick(' + n.id + ')">' +
    '<div class="t">' + escapeHtml(n.title) + '</div>' +
    (n.body ? '<div class="b">' + escapeHtml(n.body) + '</div>' : '') +
    '<div class="time">' + timeAgo(n.created_at) + '</div>' +
    '</div>'
  );
}

function renderNotifList(notifications) {
  const el = document.getElementById('notifDropdownList');
  el.innerHTML = notifications.length
    ? notifications.map(notifItemHTML).join('')
    : '<div class="notif-empty">Henüz bildiriminiz yok.</div>';
}

async function handleNotifClick(id) {
  try {
    await api.markNotificationRead(id);
    refreshNotifications();
  } catch (e) {
    /* zaten okunmuş olabilir, sorun değil */
  }
}

async function handleMarkAllRead() {
  try {
    await api.markAllNotificationsRead();
    refreshNotifications();
  } catch (e) {
    showToast(e.message);
  }
}

function toggleNotifDropdown() {
  notifOpen = !notifOpen;
  document.getElementById('notifDropdown').classList.toggle('open', notifOpen);
  if (notifOpen) refreshNotifications();
}

document.addEventListener('click', (e) => {
  const wrap = document.getElementById('notifArea');
  if (notifOpen && wrap && !wrap.contains(e.target)) {
    notifOpen = false;
    document.getElementById('notifDropdown').classList.remove('open');
  }
});

function startNotifPolling() {
  if (notifPollHandle) clearInterval(notifPollHandle);
  notifPollHandle = setInterval(refreshNotifications, 30000);
}
