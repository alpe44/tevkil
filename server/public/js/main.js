/* ===================== GÖREVLER — gerçek /api/tasks uçları ===================== */
let pickedStars = 0;
let modalTaskId = null;

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
}

/* ===================== NAV ===================== */
function switchView(name) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
  const navBtn = document.querySelector('.nav-btn[data-view="' + name + '"]');
  if (navBtn) navBtn.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (name === 'board') renderBoard();
  if (name === 'panel') renderPanel();
  if (name === 'admin') renderAdmin();
  if (name === 'tracking') renderTracking();
  if (name === 'completed') renderCompletedShowcase();
}

document.querySelectorAll('[data-view]').forEach((el) => {
  el.addEventListener('click', () => {
    const v = el.getAttribute('data-view');
    if (v === 'panel') {
      if (!currentUser) {
        switchView('auth');
        setAuthTab('login');
        showToast('Panele erişmek için giriş yapmalısınız.');
        return;
      }
      if (currentUser.status !== 'approved') {
        showToast('Hesabınız admin onayı bekliyor, panele henüz erişemezsiniz.');
        return;
      }
    }
    if (v === 'admin') {
      if (!currentUser || currentUser.role !== 'admin') {
        showToast('Bu sayfaya yalnızca admin erişebilir.');
        return;
      }
    }
    if (v === 'tracking') {
      if (!currentUser) {
        switchView('auth');
        setAuthTab('login');
        showToast('Görev Takibi için giriş yapmalısınız.');
        return;
      }
      if (currentUser.status !== 'approved') {
        showToast('Hesabınız admin onayı bekliyor, bu sayfaya henüz erişemezsiniz.');
        return;
      }
    }
    if (v === 'auth') {
      setAuthTab(el.getAttribute('data-tab') || 'login');
    }
    switchView(v);
  });
});

document.querySelectorAll('.ptab[data-ptab]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ptab[data-ptab]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    ['open', 'mine', 'taken', 'profile'].forEach((k) => {
      document.getElementById('ptab-' + k).style.display = k === btn.dataset.ptab ? 'block' : 'none';
    });
  });
});

/* ===================== ADİL SIRA (adliye kuyruğu önizlemesi) ===================== */
const taskCityInput = document.getElementById('taskCity');
if (taskCityInput) {
  taskCityInput.addEventListener('blur', async () => {
    const hint = document.getElementById('taskCityQueueHint');
    const city = taskCityInput.value.trim();
    if (!city || !currentUser) {
      hint.textContent = '';
      return;
    }
    try {
      const { queue, myPosition } = await api.getQueue(city);
      if (queue.length === 0) {
        hint.textContent = 'Bu adliyede henüz onaylı üye yok — görev yine de yayınlanabilir.';
        return;
      }
      const preview = queue
        .slice(0, 3)
        .map((q) => q.position + '. ' + q.fullName)
        .join(', ');
      hint.textContent =
        'Adil sırada bildirim alacaklar: ' + preview + (queue.length > 3 ? ' …' : '') +
        (myPosition ? ' (bu adliyedeki sıranız: ' + myPosition + '.)' : '');
    } catch (e) {
      hint.textContent = '';
    }
  });
}

/* ===================== TASKS ===================== */
// "Adliye Dışı İşlem mi?" anahtarı açılınca adres alanını göster/gizle.
const taskOffSiteToggle = document.getElementById('taskOffSite');
if (taskOffSiteToggle) {
  taskOffSiteToggle.addEventListener('change', () => {
    document.getElementById('taskOffSiteAddress').style.display = taskOffSiteToggle.checked ? 'block' : 'none';
  });
}
// "Hazır Açıklamalar" seçilince açıklama kutusuna metni doldurur.
const taskQuickDescSelect = document.getElementById('taskQuickDesc');
if (taskQuickDescSelect) {
  taskQuickDescSelect.addEventListener('change', () => {
    if (taskQuickDescSelect.value) {
      document.getElementById('taskDesc').value = taskQuickDescSelect.value;
      taskQuickDescSelect.selectedIndex = 0;
    }
  });
}

async function createTask() {
  if (!currentUser) {
    showToast('Görev açmak için giriş yapmalısınız.');
    return;
  }
  const city = document.getElementById('taskCity').value.trim();
  const taskType = document.getElementById('taskType').value;
  const dueDate = document.getElementById('taskDate').value;
  const dueTime = document.getElementById('taskTime').value;
  const budget = document.getElementById('taskBudget').value;
  const isOffSite = document.getElementById('taskOffSite').checked;
  const offSiteAddress = document.getElementById('taskOffSiteAddress').value.trim();
  const title = document.getElementById('taskTitle').value.trim();
  const description = document.getElementById('taskDesc').value.trim();

  if (!city || !taskType || !title || !description) {
    showToast('Lütfen adliye, görev türü, başlık ve açıklama girin.');
    return;
  }
  if (isOffSite && !offSiteAddress) {
    showToast('Adliye dışı işlem için adres girin.');
    return;
  }

  try {
    await api.createTask({
      title, description, city, taskType,
      dueDate: dueDate || undefined,
      dueTime: dueTime || undefined,
      budget: budget || undefined,
      isOffSite,
      offSiteAddress: isOffSite ? offSiteAddress : undefined,
    });
    document.getElementById('taskCity').value = '';
    document.getElementById('taskType').value = '';
    document.getElementById('taskDate').value = '';
    document.getElementById('taskTime').value = '';
    document.getElementById('taskBudget').value = '';
    document.getElementById('taskOffSite').checked = false;
    document.getElementById('taskOffSiteAddress').value = '';
    document.getElementById('taskOffSiteAddress').style.display = 'none';
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskDesc').value = '';
    showToast('Görev yayınlandı.');
    renderPanel();
  } catch (e) {
    showToast(e.message);
  }
}

let acceptModalTaskId = null;

function openAcceptTaskModal(id) {
  if (!currentUser) {
    showToast('Göreve başvurmak için giriş yapmalısınız.');
    switchView('auth');
    return;
  }
  acceptModalTaskId = id;
  document.getElementById('acceptPhone').value = '';
  document.getElementById('acceptContact').value = '';
  document.getElementById('acceptNote').value = '';
  document.getElementById('acceptErr').style.display = 'none';
  document.getElementById('acceptModal').classList.add('active');
}

function closeAcceptModal() {
  document.getElementById('acceptModal').classList.remove('active');
  acceptModalTaskId = null;
}

async function submitAcceptTask() {
  const errEl = document.getElementById('acceptErr');
  errEl.style.display = 'none';
  const phone = document.getElementById('acceptPhone').value.trim();
  const contactAddress = document.getElementById('acceptContact').value.trim();
  const note = document.getElementById('acceptNote').value.trim();

  if (!phone || !contactAddress || !note) {
    errEl.textContent = 'Telefon, iletişim adresi ve tevkil bilgileri zorunludur.';
    errEl.style.display = 'block';
    return;
  }

  try {
    await api.applyToTask(acceptModalTaskId, { phone, contactAddress, note });
    closeAcceptModal();
    showToast('Başvurunuz alındı. Görev sahibi onayladığında bilgilendirileceksiniz.');
    renderPanel();
    renderBoard();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = 'block';
  }
}

function openRatingModal(id) {
  modalTaskId = id;
  pickedStars = 0;
  document.getElementById('ratingComment').value = '';
  const picker = document.getElementById('starPicker');
  picker.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const b = document.createElement('button');
    b.textContent = '★';
    b.onclick = () => {
      pickedStars = i;
      renderStars();
    };
    picker.appendChild(b);
  }
  renderStars();
  document.getElementById('ratingModal').classList.add('active');
}
function renderStars() {
  const btns = document.querySelectorAll('#starPicker button');
  btns.forEach((b, idx) => b.classList.toggle('picked', idx < pickedStars));
}
function closeModal() {
  document.getElementById('ratingModal').classList.remove('active');
  modalTaskId = null;
}

async function submitRating() {
  if (!modalTaskId || pickedStars === 0) {
    showToast('Lütfen bir puan seçin.');
    return;
  }
  try {
    const comment = document.getElementById('ratingComment').value.trim();
    const { message } = await api.completeTask(modalTaskId, pickedStars, comment || undefined);
    closeModal();
    showToast(message || 'Görev tamamlandı ve puanlandı.');
    renderPanel();
    // Panelde gösterilen puan/tamamlanan sayaçları tazelemek için oturumu yeniden çek.
    const { user } = await api.me();
    currentUser = user;
  } catch (e) {
    showToast(e.message);
  }
}

/* ===================== RENDER ===================== */
function timeAgo(isoOrMs) {
  const ts = typeof isoOrMs === 'number' ? isoOrMs : new Date(isoOrMs).getTime();
  const diff = Math.floor((Date.now() - ts) / 60000);
  if (diff < 1) return 'az önce';
  if (diff < 60) return diff + ' dk önce';
  const h = Math.floor(diff / 60);
  if (h < 24) return h + ' sa önce';
  return Math.floor(h / 24) + ' gün önce';
}

function taskCardHTML(t, opts = {}) {
  const statusMap = { open: ['Açık', 'status-open'], assigned: ['Üstlenildi', 'status-assigned'], completed: ['Tamamlandı', 'status-completed'] };
  const [label, cls] = statusMap[t.status];
  let actionBtn = '';
  if (opts.mode === 'board' || opts.mode === 'open') {
    if (t.status === 'open') {
      actionBtn = currentUser
        ? '<button class="small-btn solid" onclick="openAcceptTaskModal(' + t.id + ')">Başvur</button>'
        : '<button class="small-btn" onclick="switchView(\'auth\')">Başvurmak için giriş yap</button>';
    }
  }
  if (opts.mode === 'mine' && t.status === 'assigned') {
    actionBtn = '<button class="small-btn solid" onclick="openRatingModal(' + t.id + ')">Tamamla &amp; Puanla</button>';
  }
  const dateTime = (t.date || '—') + (t.dueTime ? ' ' + t.dueTime : '');
  return (
    '<div class="task-card">' +
    '<div>' +
    '<span class="city-tag">' + escapeHtml(t.isOffSite ? 'Adliye Dışı · ' + t.city : t.city) + '</span>' +
    (t.taskType ? '<span class="city-tag" style="margin-left:6px;">' + escapeHtml(t.taskType) + '</span>' : '') +
    '<h4>' + escapeHtml(t.title) + '</h4>' +
    '<div class="desc">' + escapeHtml(t.desc) + '</div>' +
    (t.isOffSite && t.offSiteAddress ? '<div class="desc" style="color:var(--brass-bright);">Adres: ' + escapeHtml(t.offSiteAddress) + '</div>' : '') +
    '<div class="meta">Açan: ' + escapeHtml(t.ownerName) + ' · Tarih: ' + escapeHtml(dateTime) + ' · ' + timeAgo(t.createdAt) +
    (t.budget ? ' · Bütçe: ' + escapeHtml(t.budget) : '') +
    (t.assigneeName ? ' · Üstlenen: ' + escapeHtml(t.assigneeName) : '') +
    (t.rating ? ' · Puan: ' + t.rating + '★' : '') +
    '</div>' +
    '</div>' +
    '<div style="display:flex; flex-direction:column; align-items:flex-end; gap:10px;">' +
    '<span class="status-badge ' + cls + '">' + label + '</span>' +
    actionBtn +
    '</div>' +
    '</div>'
  );
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

async function renderLandingDocket() {
  const el = document.getElementById('landingDocket');
  try {
    const { tasks } = await api.listOpenTasks();
    const open = tasks.slice(0, 5);
    if (open.length === 0) {
      el.innerHTML = '<div class="docket-item"><span class="desc">Şu anda açık görev yok.</span></div>';
      return;
    }
    el.innerHTML = open
      .map(
        (t) =>
          '<div class="docket-item"><div><div class="city">' + escapeHtml(t.city) + '</div><div class="desc">' + escapeHtml(t.title) + '</div></div><div class="time">' + timeAgo(t.createdAt) + '</div></div>'
      )
      .join('');
  } catch (e) {
    el.innerHTML = '<div class="docket-item"><span class="desc">Görevler yüklenemedi.</span></div>';
  }
}

function completedItemHTML(t) {
  return (
    '<div class="docket-item">' +
    '<div>' +
    '<div class="city">' + escapeHtml(t.city) + (t.rating ? ' · ' + t.rating + '★' : '') + '</div>' +
    '<div class="desc">' + escapeHtml(t.title) + '</div>' +
    (t.comment ? '<div class="desc" style="font-style:italic; margin-top:4px;">“' + escapeHtml(t.comment) + '”</div>' : '') +
    '</div>' +
    '<div class="time">' + timeAgo(t.completedAt) + '</div>' +
    '</div>'
  );
}

async function renderLandingCompleted() {
  const el = document.getElementById('landingCompleted');
  try {
    const { tasks } = await api.publicCompleted();
    const recent = tasks.slice(0, 4);
    el.innerHTML = recent.length
      ? recent.map(completedItemHTML).join('')
      : '<div class="docket-item"><span class="desc">Henüz onaylı yorum yok.</span></div>';
  } catch (e) {
    el.innerHTML = '<div class="docket-item"><span class="desc">Yüklenemedi.</span></div>';
  }
}

async function renderCompletedShowcase() {
  const el = document.getElementById('completedList');
  el.innerHTML = '<div class="empty-state">Yükleniyor…</div>';
  try {
    const { tasks } = await api.publicCompleted();
    if (tasks.length === 0) {
      el.innerHTML = '<div class="empty-state"><h4>Henüz yok</h4>Admin onaylı bir yorum yayınlandığında burada listelenir.</div>';
      return;
    }
    el.innerHTML =
      '<div class="docket completed-box" style="max-width:720px;">' +
      '<div class="docket-list" style="max-height:none;">' +
      tasks.map(completedItemHTML).join('') +
      '</div></div>';
  } catch (e) {
    el.innerHTML = '<div class="empty-state"><h4>Yüklenemedi</h4>' + escapeHtml(e.message) + '</div>';
  }
}

async function renderStats() {
  try {
    const { approvedLawyers, totalTasks, completedTasks } = await api.publicStats();
    document.getElementById('statLawyers').textContent = approvedLawyers;
    document.getElementById('statTasks').textContent = totalTasks;
    document.getElementById('statDone').textContent = completedTasks;
  } catch (e) {
    document.getElementById('statLawyers').textContent = '—';
    document.getElementById('statTasks').textContent = '—';
    document.getElementById('statDone').textContent = '—';
  }
}

async function renderBoard() {
  const el = document.getElementById('boardList');
  try {
    const { tasks } = await api.listOpenTasks();
    if (tasks.length === 0) {
      el.innerHTML = '<div class="empty-state"><h4>Şu anda açık görev yok</h4>Yeni bir görev açan ilk siz olun.</div>';
      return;
    }
    el.innerHTML = tasks.map((t) => taskCardHTML(t, { mode: 'board' })).join('');
  } catch (e) {
    el.innerHTML = '<div class="empty-state"><h4>Yüklenemedi</h4>' + escapeHtml(e.message) + '</div>';
  }
}

async function renderPanel() {
  if (!currentUser) {
    switchView('auth');
    return;
  }
  document.getElementById('panelWho').textContent = currentUser.full_name;

  const openEl = document.getElementById('openTasksList');
  const mineEl = document.getElementById('mineTasksList');
  const takenEl = document.getElementById('takenTasksList');

  try {
    const [{ tasks: open }, { tasks: mine }, { tasks: taken }] = await Promise.all([
      api.listOpenTasks(),
      api.listMyTasks(),
      api.listTakenTasks(),
    ]);

    openEl.innerHTML = open.length
      ? open.map((t) => taskCardHTML(t, { mode: 'open' })).join('')
      : '<div class="empty-state"><h4>Açık görev yok</h4>Yukarıdan yeni bir görev oluşturabilirsiniz.</div>';

    mineEl.innerHTML = mine.length
      ? mine.map((t) => taskCardHTML(t, { mode: 'mine' })).join('')
      : '<div class="empty-state"><h4>Henüz görev oluşturmadınız</h4>"Açık Görevler" sekmesinden yeni görev açabilirsiniz.</div>';

    takenEl.innerHTML = taken.length
      ? taken.map((t) => taskCardHTML(t, { mode: 'taken' })).join('')
      : '<div class="empty-state"><h4>Henüz görev üstlenmediniz</h4>Açık görevlerden birini alarak başlayın.</div>';
  } catch (e) {
    showToast('Görevler yüklenemedi: ' + e.message);
  }

  renderProfileAvatar(currentUser);
  document.getElementById('profName').textContent = currentUser.full_name;
  document.getElementById('profMeta').textContent = currentUser.bar_association + ' · Sicil ' + currentUser.bar_registry_no + ' · ' + currentUser.province;
  document.getElementById('profRating').textContent = currentUser.rating_avg ? currentUser.rating_avg + ' ★' : '—';
  document.getElementById('profCompleted').textContent = currentUser.completed_count || 0;
  document.getElementById('profCreated').textContent = currentUser.created_count || 0;
}

/* ===================== GÖREV TAKİBİ ===================== */
function trackingTaskHTML(t) {
  const rows = t.applications
    .map(
      (a, idx) =>
        '<tr>' +
        '<td class="mono">' + (idx + 1) + '.</td>' +
        '<td>' + escapeHtml(a.displayName) + '</td>' +
        '<td>' + escapeHtml(a.address || '—') + '</td>' +
        '<td class="mono">' + timeAgo(a.appliedAt) + '</td>' +
        '<td class="tracking-actions">' +
        '<button class="icon-btn approve" title="Onayla" onclick="handleApproveApplication(' + t.taskId + ',' + a.applicantId + ')">✓</button>' +
        '<button class="icon-btn reject" title="Reddet" onclick="handleRejectApplication(' + t.taskId + ',' + a.applicantId + ')">✕</button>' +
        '</td>' +
        '</tr>'
    )
    .join('');
  return (
    '<div class="tracking-card">' +
    '<div class="tracking-card-head"><span class="city-tag">' + escapeHtml(t.city) + '</span><h4>' + escapeHtml(t.title) + '</h4></div>' +
    '<div style="overflow-x:auto;">' +
    '<table class="tracking-table">' +
    '<thead><tr><th>Sıra</th><th>Başvuran</th><th>Adres</th><th>Başvuru</th><th>İşlem</th></tr></thead>' +
    '<tbody>' + rows + '</tbody>' +
    '</table>' +
    '</div>' +
    '</div>'
  );
}

async function renderTracking() {
  const el = document.getElementById('trackingList');
  el.innerHTML = '<div class="empty-state"><h4>Yükleniyor…</h4></div>';
  try {
    const { tasks } = await api.listMyApplications();
    el.innerHTML = tasks.length
      ? tasks.map(trackingTaskHTML).join('')
      : '<div class="empty-state"><h4>Bekleyen başvuru yok</h4>Açık görevlerinize başvuru geldiğinde burada, adil sıraya göre sıralanmış şekilde listelenir.</div>';
  } catch (e) {
    el.innerHTML = '<div class="empty-state"><h4>Yüklenemedi</h4>' + escapeHtml(e.message) + '</div>';
  }
}

async function handleApproveApplication(taskId, applicantId) {
  try {
    await api.approveApplication(taskId, applicantId);
    showToast('Başvuru onaylandı, görev üstlendirildi.');
    renderTracking();
    renderPanel();
  } catch (e) {
    showToast(e.message);
  }
}

async function handleRejectApplication(taskId, applicantId) {
  try {
    await api.rejectApplication(taskId, applicantId);
    showToast('Başvuru reddedildi.');
    renderTracking();
  } catch (e) {
    showToast(e.message);
  }
}

/* ===================== INIT ===================== */
(async function init() {
  await bootstrapSession();
  showResetFormIfTokenPresent();
  renderLandingDocket();
  renderLandingCompleted();
  renderStats();
  renderBoard();
  startNotifPolling();
})();
