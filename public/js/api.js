/* Backend API'ye fetch() sarmalayıcısı. Cookie tabanlı oturum kullanır (credentials:'include'). */
const API_BASE = '/api';

async function apiRequest(path, { method = 'GET', body } = {}) {
  // FormData (dosya yüklemeleri) tarayıcının kendi Content-Type + boundary'sini ayarlamasına
  // izin vermek için JSON.stringify edilmeden ve header'sız gönderilir.
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const res = await fetch(API_BASE + path, {
    method,
    credentials: 'include',
    headers: body && !isFormData ? { 'Content-Type': 'application/json' } : undefined,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    /* body boş olabilir (ör. 204) */
  }

  if (!res.ok) {
    const err = new Error((data && data.error) || 'İstek başarısız oldu.');
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

const api = {
  register: (payload) => apiRequest('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => apiRequest('/auth/login', { method: 'POST', body: payload }),
  logout: () => apiRequest('/auth/logout', { method: 'POST' }),
  forgotPassword: (email) => apiRequest('/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (token, password) => apiRequest('/auth/reset-password', { method: 'POST', body: { token, password } }),
  me: () => apiRequest('/auth/me'),
  publicStats: () => apiRequest('/public/stats'),
  adminListUsers: (status) => apiRequest('/admin/users?status=' + encodeURIComponent(status)),
  adminApproveUser: (id) => apiRequest('/admin/users/' + id + '/approve', { method: 'POST' }),
  adminRejectUser: (id, reason) => apiRequest('/admin/users/' + id + '/reject', { method: 'POST', body: { reason } }),
  uploadAvatar: (file) => {
    const fd = new FormData();
    fd.append('avatar', file);
    return apiRequest('/users/me/avatar', { method: 'POST', body: fd });
  },
  adminListAvatarRequests: (status) => apiRequest('/admin/avatars?status=' + encodeURIComponent(status)),
  adminApproveAvatar: (id) => apiRequest('/admin/users/' + id + '/avatar/approve', { method: 'POST' }),
  adminRejectAvatar: (id, reason) => apiRequest('/admin/users/' + id + '/avatar/reject', { method: 'POST', body: { reason } }),
  getQueue: (courthouse) => apiRequest('/tasks/queue?courthouse=' + encodeURIComponent(courthouse)),
  listOpenTasks: () => apiRequest('/tasks/open'),
  listMyTasks: () => apiRequest('/tasks/mine'),
  listTakenTasks: () => apiRequest('/tasks/taken'),
  createTask: (payload) => apiRequest('/tasks', { method: 'POST', body: payload }),
  acceptTask: (id) => apiRequest('/tasks/' + id + '/accept', { method: 'POST' }),
  completeTask: (id, rating) => apiRequest('/tasks/' + id + '/complete', { method: 'POST', body: { rating } }),
  listNotifications: () => apiRequest('/notifications'),
  markNotificationRead: (id) => apiRequest('/notifications/' + id + '/read', { method: 'POST' }),
  markAllNotificationsRead: () => apiRequest('/notifications/read-all', { method: 'POST' }),
};
