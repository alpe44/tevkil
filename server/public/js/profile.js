/* ===================== PROFİL FOTOĞRAFI ===================== */
// Fotoğraf, backend'de görünürlük kontrolünden geçerek servis edilir (bkz.
// server/src/controllers/user.controller.js): onaylıysa herkese, değilse yalnızca sahibi/admin.
function avatarUrl(userId, uploadedAt) {
  return '/api/users/' + userId + '/avatar' + (uploadedAt ? '?t=' + new Date(uploadedAt).getTime() : '');
}

function avatarStatusLabel(status) {
  return { pending: 'Onay bekliyor', approved: 'Onaylı', rejected: 'Reddedildi' }[status] || null;
}

function initialsOf(fullName) {
  return String(fullName || '')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** Panelim > Profilim sekmesindeki avatar + onay rozetini currentUser'a göre çizer. */
function renderProfileAvatar(user) {
  const img = document.getElementById('profAvatarImg');
  const initials = document.getElementById('profAvatarInitials');
  const statusEl = document.getElementById('profAvatarStatus');
  if (!img) return;

  const hasOwnPhoto = user.avatar_status && user.avatar_status !== 'none';
  if (hasOwnPhoto) {
    img.onerror = () => {
      img.style.display = 'none';
      initials.style.display = 'block';
    };
    img.src = avatarUrl(user.id, user.avatar_uploaded_at);
    img.style.display = 'block';
    initials.style.display = 'none';
  } else {
    img.style.display = 'none';
    initials.style.display = 'block';
    initials.textContent = initialsOf(user.full_name);
  }

  const label = avatarStatusLabel(user.avatar_status);
  if (label) {
    statusEl.innerHTML =
      (user.avatar_status === 'pending' ? '<span class="p"></span>' : '') +
      'Fotoğraf: ' + label +
      (user.avatar_status === 'rejected' && user.avatar_rejection_reason ? ' — ' + escapeHtml(user.avatar_rejection_reason) : '');
    statusEl.className = 'avatar-status-badge status-' + user.avatar_status;
    statusEl.style.display = 'inline-flex';
  } else {
    statusEl.style.display = 'none';
  }
}

const profAvatarUploadBtn = document.getElementById('profAvatarUploadBtn');
const profAvatarInput = document.getElementById('profAvatarInput');
if (profAvatarUploadBtn && profAvatarInput) {
  profAvatarUploadBtn.addEventListener('click', () => profAvatarInput.click());
  profAvatarInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    profAvatarUploadBtn.disabled = true;
    try {
      const { user, message } = await api.uploadAvatar(file);
      currentUser = user;
      renderProfileAvatar(user);
      showToast(message);
    } catch (err) {
      showToast(err.message);
    } finally {
      profAvatarUploadBtn.disabled = false;
      e.target.value = '';
    }
  });
}
