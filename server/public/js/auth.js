/* ===================== OTURUM DURUMU ===================== */
// currentUser artık backend'den gelen gerçek kullanıcı kaydı (bkz. server/src/models/userModel.js)
// null => oturum yok. {..., status:'pending'|'approved'|'rejected', role:'lawyer'|'admin'}
let currentUser = null;

async function bootstrapSession() {
  try {
    const { user } = await api.me();
    currentUser = user;
  } catch (e) {
    currentUser = null;
  }
  updateHeaderAuth();
}

/* ===================== AUTH TAB SWITCH ===================== */
function setAuthTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('tabLogin').classList.toggle('active', isLogin);
  document.getElementById('tabRegister').classList.toggle('active', !isLogin);
  document.getElementById('loginForm').style.display = isLogin ? 'block' : 'none';
  document.getElementById('registerForm').style.display = isLogin ? 'none' : 'block';
  document.getElementById('forgotForm').style.display = 'none';
  document.getElementById('resetForm').style.display = 'none';
  document.querySelector('.tab-switch').style.display = 'flex';
}
document.getElementById('tabLogin').addEventListener('click', () => setAuthTab('login'));
document.getElementById('tabRegister').addEventListener('click', () => setAuthTab('register'));

/* ===================== KAYIT — FOTOĞRAF SEÇİCİ ===================== */
const regAvatarBtn = document.getElementById('regAvatarBtn');
const regAvatarInput = document.getElementById('regAvatarInput');
if (regAvatarBtn && regAvatarInput) {
  regAvatarBtn.addEventListener('click', () => regAvatarInput.click());
  regAvatarInput.addEventListener('change', () => {
    const file = regAvatarInput.files[0];
    const img = document.getElementById('regAvatarPreviewImg');
    const icon = document.getElementById('regAvatarPreviewIcon');
    if (!file) {
      img.style.display = 'none';
      icon.style.display = 'block';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      img.src = reader.result;
      img.style.display = 'block';
      icon.style.display = 'none';
    };
    reader.readAsDataURL(file);
  });
}
function resetRegAvatarPicker() {
  if (!regAvatarInput) return;
  regAvatarInput.value = '';
  document.getElementById('regAvatarPreviewImg').style.display = 'none';
  document.getElementById('regAvatarPreviewIcon').style.display = 'block';
}

/* ===================== ŞİFREMİ UNUTTUM / SIFIRLAMA ===================== */
function showForgotForm() {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('registerForm').style.display = 'none';
  document.getElementById('resetForm').style.display = 'none';
  document.getElementById('forgotForm').style.display = 'block';
  document.querySelector('.tab-switch').style.display = 'none';
}
document.getElementById('forgotPasswordLink').addEventListener('click', (e) => {
  e.preventDefault();
  showForgotForm();
});
document.getElementById('backToLoginLink').addEventListener('click', (e) => {
  e.preventDefault();
  setAuthTab('login');
});

async function handleForgotPassword() {
  const email = document.getElementById('forgotEmail').value.trim();
  const errEl = document.getElementById('forgotErr');
  const okEl = document.getElementById('forgotOk');
  errEl.style.display = 'none';
  okEl.style.display = 'none';
  if (!email) {
    errEl.textContent = 'E-posta girin.';
    errEl.style.display = 'block';
    return;
  }
  const btn = document.getElementById('forgotBtn');
  btn.disabled = true;
  try {
    const { message } = await api.forgotPassword(email);
    okEl.textContent = message;
    okEl.style.display = 'block';
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
  }
}

/** ?resetToken=... ile açılan bağlantıda otomatik olarak şifre yenileme formunu gösterir. */
let pendingResetToken = null;
function showResetFormIfTokenPresent() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('resetToken');
  if (!token) return false;
  pendingResetToken = token;
  switchView('auth');
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('registerForm').style.display = 'none';
  document.getElementById('forgotForm').style.display = 'none';
  document.getElementById('resetForm').style.display = 'block';
  document.querySelector('.tab-switch').style.display = 'none';
  return true;
}

async function handleResetPassword() {
  const password = document.getElementById('resetPassword').value;
  const passwordConfirm = document.getElementById('resetPasswordConfirm').value;
  const errEl = document.getElementById('resetErr');
  const okEl = document.getElementById('resetOk');
  errEl.style.display = 'none';
  okEl.style.display = 'none';

  if (!password) {
    errEl.textContent = 'Yeni şifre girin.';
    errEl.style.display = 'block';
    return;
  }
  if (password !== passwordConfirm) {
    errEl.textContent = 'Şifreler eşleşmiyor.';
    errEl.style.display = 'block';
    return;
  }
  const btn = document.getElementById('resetBtn');
  btn.disabled = true;
  try {
    const { message } = await api.resetPassword(pendingResetToken, password);
    okEl.textContent = message;
    okEl.style.display = 'block';
    setTimeout(() => {
      window.history.replaceState({}, '', window.location.pathname);
      setAuthTab('login');
    }, 1500);
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
  }
}

/* ===================== LOGIN ===================== */
async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginErr');
  errEl.style.display = 'none';

  if (!email || !password) {
    errEl.textContent = 'E-posta ve şifre girin.';
    errEl.style.display = 'block';
    return;
  }

  const btn = document.getElementById('loginBtn');
  btn.disabled = true;
  try {
    const { user } = await api.login({ email, password });
    currentUser = user;
    showToast('Hoş geldiniz, ' + user.full_name);
    updateHeaderAuth();
    switchView('panel');
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
  }
}

/* ===================== REGISTER ===================== */
async function handleRegister() {
  const fullName = document.getElementById('regName').value.trim();
  const barAssociation = document.getElementById('regBaro').value.trim();
  const barRegistryNo = document.getElementById('regSicil').value.trim();
  const province = document.getElementById('regIl').value.trim();
  const courthouse = document.getElementById('regAdliye').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const password = document.getElementById('regPassword').value;
  const passwordConfirm = document.getElementById('regPasswordConfirm').value;
  const bio = document.getElementById('regBio').value.trim();
  const kvkkConsent = document.getElementById('regKvkkConsent').checked;
  const errEl = document.getElementById('regErr');
  const okEl = document.getElementById('regOk');
  errEl.style.display = 'none';
  okEl.style.display = 'none';

  if (!fullName || !barAssociation || !barRegistryNo || !province || !courthouse || !email || !phone || !password) {
    errEl.textContent = 'Lütfen tüm zorunlu alanları doldurun.';
    errEl.style.display = 'block';
    return;
  }
  if (!kvkkConsent) {
    errEl.textContent = 'Devam etmek için KVKK Aydınlatma Metni\'ni okuyup açık rıza kutucuğunu işaretlemeniz gerekiyor.';
    errEl.style.display = 'block';
    return;
  }
  if (password !== passwordConfirm) {
    errEl.textContent = 'Şifreler eşleşmiyor.';
    errEl.style.display = 'block';
    return;
  }

  const btn = document.getElementById('registerBtn');
  btn.disabled = true;
  try {
    const avatarFile = regAvatarInput && regAvatarInput.files[0];
    let payload;
    if (avatarFile) {
      payload = new FormData();
      payload.append('fullName', fullName);
      payload.append('barAssociation', barAssociation);
      payload.append('barRegistryNo', barRegistryNo);
      payload.append('province', province);
      payload.append('courthouse', courthouse);
      payload.append('email', email);
      payload.append('phone', phone);
      payload.append('password', password);
      payload.append('kvkkConsent', 'true');
      if (bio) payload.append('bio', bio);
      payload.append('avatar', avatarFile);
    } else {
      payload = { fullName, barAssociation, barRegistryNo, province, courthouse, email, phone, password, bio, kvkkConsent };
    }
    const { message } = await api.register(payload);
    okEl.textContent = message + ' Onaylandığınızda aynı e-posta/şifre ile giriş yapabilirsiniz.';
    okEl.style.display = 'block';
    document.getElementById('registerForm').querySelectorAll('input, textarea').forEach((el) => (el.value = ''));
    document.getElementById('regKvkkConsent').checked = false;
    resetRegAvatarPicker();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
  }
}

/* ===================== LOGOUT ===================== */
async function handleLogout() {
  try {
    await api.logout();
  } catch (e) {
    /* cookie zaten geçersizse yoksay */
  }
  currentUser = null;
  updateHeaderAuth();
  showToast('Çıkış yapıldı.');
  switchView('landing');
}

/* ===================== HEADER ===================== */
function updateHeaderAuth() {
  const area = document.getElementById('headerAuthArea');
  const navAdmin = document.getElementById('navAdmin');
  const navTracking = document.getElementById('navTracking');
  navAdmin.style.display = currentUser && currentUser.role === 'admin' ? '' : 'none';
  navTracking.style.display = currentUser && currentUser.status === 'approved' ? '' : 'none';

  if (currentUser) {
    const adminTag = currentUser.role === 'admin' ? '<span class="admin-badge">Admin</span>' : '';
    area.innerHTML =
      '<button class="ghost-btn" id="headerPanelBtn">Panelim' + adminTag + '</button>' +
      '<button class="ghost-btn" id="headerLogoutBtn">Çıkış</button>';
    document.getElementById('headerPanelBtn').addEventListener('click', () => switchView('panel'));
    document.getElementById('headerLogoutBtn').addEventListener('click', handleLogout);
  } else {
    area.innerHTML =
      '<button class="ghost-btn" data-view="auth" data-tab="login">Giriş Yap</button>' +
      '<button class="cta-btn" data-view="auth" data-tab="register">Kayıt Ol</button>';
    area.querySelectorAll('[data-view]').forEach((el) => {
      el.addEventListener('click', () => {
        setAuthTab(el.getAttribute('data-tab') || 'login');
        switchView('auth');
      });
    });
  }
  refreshNotifications();
}
