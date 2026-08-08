/* ===================== ADMIN PANELİ ===================== */
let adminActiveTab = 'pending';

document.querySelectorAll('.ptab[data-atab]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ptab[data-atab]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    adminActiveTab = btn.dataset.atab;
    renderAdmin();
  });
});

function adminUserCardHTML(u) {
  const created = new Date(u.created_at).toLocaleDateString('tr-TR');
  let actions = '';
  if (u.status === 'pending') {
    actions =
      '<button class="small-btn solid" onclick="handleApprove(' + u.id + ')">Onayla</button>' +
      '<button class="small-btn danger" onclick="handleReject(' + u.id + ')">Reddet</button>';
  } else if (u.status === 'rejected') {
    actions = '<button class="small-btn solid" onclick="handleApprove(' + u.id + ')">Yine de Onayla</button>';
  } else if (u.status === 'approved') {
    actions = '<button class="small-btn danger" onclick="handleReject(' + u.id + ')">Onayı Kaldır / Reddet</button>';
  }

  return (
    '<div class="pending-card">' +
    '<div>' +
    '<h4>' + escapeHtml(u.full_name) + '</h4>' +
    '<div class="meta">' +
    escapeHtml(u.email) + '<br>' +
    escapeHtml(u.bar_association) + ' · Sicil ' + escapeHtml(u.bar_registry_no) + '<br>' +
    escapeHtml(u.province) + ' · ' + escapeHtml(u.courthouse) + '<br>' +
    'Kayıt: ' + created +
    (u.rejection_reason ? '<br>Red sebebi: ' + escapeHtml(u.rejection_reason) : '') +
    '</div>' +
    '</div>' +
    '<div style="display:flex; flex-direction:column; align-items:flex-end; gap:10px;">' +
    '<span class="status-badge ' + (u.status === 'approved' ? 'status-assigned' : u.status === 'rejected' ? 'status-completed' : 'status-open') + '">' +
    (u.status === 'approved' ? 'Onaylı' : u.status === 'rejected' ? 'Reddedildi' : 'Bekliyor') +
    '</span>' +
    '<div style="display:flex; gap:8px;">' + actions + '</div>' +
    '</div>' +
    '</div>'
  );
}

async function renderAdmin() {
  if (!currentUser || currentUser.role !== 'admin') return;
  if (adminActiveTab === 'avatars') return renderAvatarQueue();

  const el = document.getElementById('adminUsersList');
  el.innerHTML = '<div class="empty-state">Yükleniyor…</div>';
  try {
    const { users } = await api.adminListUsers(adminActiveTab);
    if (users.length === 0) {
      const emptyMsg = {
        pending: 'Onay bekleyen üye yok.',
        approved: 'Onaylı üye yok.',
        rejected: 'Reddedilen üye yok.',
      }[adminActiveTab];
      el.innerHTML = '<div class="empty-state"><h4>Liste boş</h4>' + emptyMsg + '</div>';
      return;
    }
    el.innerHTML = users.map(adminUserCardHTML).join('');
  } catch (e) {
    el.innerHTML = '<div class="empty-state"><h4>Yüklenemedi</h4>' + escapeHtml(e.message) + '</div>';
  }
}

/* ===================== PROFİL FOTOĞRAFI ONAYI ===================== */
// Hesap durumundan (users.status) bağımsız ayrı bir kuyruk: bir avatar isteği, hesap
// zaten onaylıyken de (profil fotoğrafı sonradan değiştirildiğinde) gelebilir.
function adminAvatarCardHTML(u) {
  const uploaded = u.avatar_uploaded_at ? new Date(u.avatar_uploaded_at).toLocaleString('tr-TR') : '—';
  return (
    '<div class="pending-card">' +
    '<div style="display:flex; gap:16px; align-items:center;">' +
    '<div class="avatar-ring avatar-ring-lg admin-avatar-thumb"><img src="' + avatarUrl(u.id, u.avatar_uploaded_at) + '" alt=""></div>' +
    '<div>' +
    '<h4>' + escapeHtml(u.full_name) + '</h4>' +
    '<div class="meta">' +
    escapeHtml(u.bar_association) + ' · Sicil ' + escapeHtml(u.bar_registry_no) + '<br>' +
    escapeHtml(u.province) + ' · ' + escapeHtml(u.courthouse) + '<br>' +
    'Yüklendi: ' + uploaded +
    '</div>' +
    '</div>' +
    '</div>' +
    '<div style="display:flex; gap:8px;">' +
    '<button class="small-btn solid" onclick="handleApproveAvatar(' + u.id + ')">Onayla</button>' +
    '<button class="small-btn danger" onclick="handleRejectAvatar(' + u.id + ')">Reddet</button>' +
    '</div>' +
    '</div>'
  );
}

async function renderAvatarQueue() {
  const el = document.getElementById('adminUsersList');
  el.innerHTML = '<div class="empty-state">Yükleniyor…</div>';
  try {
    const { users } = await api.adminListAvatarRequests('pending');
    if (users.length === 0) {
      el.innerHTML = '<div class="empty-state"><h4>Liste boş</h4>Onay bekleyen profil fotoğrafı yok.</div>';
      return;
    }
    el.innerHTML = users.map(adminAvatarCardHTML).join('');
  } catch (e) {
    el.innerHTML = '<div class="empty-state"><h4>Yüklenemedi</h4>' + escapeHtml(e.message) + '</div>';
  }
}

async function handleApproveAvatar(id) {
  try {
    await api.adminApproveAvatar(id);
    showToast('Fotoğraf onaylandı.');
    renderAvatarQueue();
  } catch (e) {
    showToast(e.message);
  }
}

async function handleRejectAvatar(id) {
  const reason = window.prompt('Red sebebi (opsiyonel):', '') || '';
  try {
    await api.adminRejectAvatar(id, reason);
    showToast('Fotoğraf reddedildi.');
    renderAvatarQueue();
  } catch (e) {
    showToast(e.message);
  }
}

async function handleApprove(id) {
  try {
    await api.adminApproveUser(id);
    showToast('Üye onaylandı.');
    renderAdmin();
  } catch (e) {
    showToast(e.message);
  }
}

async function handleReject(id) {
  const reason = window.prompt('Red sebebi (opsiyonel):', '') || '';
  try {
    await api.adminRejectUser(id, reason);
    showToast('Üye reddedildi.');
    renderAdmin();
  } catch (e) {
    showToast(e.message);
  }
}
