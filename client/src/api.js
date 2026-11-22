// Pembungkus fetch: kirim cookie session + header CSRF, lempar ApiError saat gagal.
let csrf = null;
let onUnauthorized = () => {};

export class ApiError extends Error {
  constructor(status, data) {
    super((data && data.error) || (data && data.errors && data.errors[0]) || 'Terjadi kesalahan. Coba lagi.');
    this.status = status;
    this.data = data || {};
    this.code = this.data.code;
    this.errors = this.data.errors || [this.message];
  }
}

async function getCsrf() {
  if (!csrf) {
    const res = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
    csrf = (await res.json()).csrfToken;
  }
  return csrf;
}

async function request(method, path, body, retry = true) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') headers['X-CSRF-Token'] = await getCsrf();
  const res = await fetch('/api' + path, {
    method,
    headers,
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 403 && data.code === 'CSRF' && retry) {
    csrf = null;
    return request(method, path, body, false);
  }
  if (res.status === 401 && !path.startsWith('/auth/')) onUnauthorized();
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b = {}) => request('POST', p, b),
  put: (p, b = {}) => request('PUT', p, b),
  setCsrf: (t) => { csrf = t; },
  resetCsrf: () => { csrf = null; },
  setUnauthorizedHandler: (fn) => { onUnauthorized = fn; }
};
