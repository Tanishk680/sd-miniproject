const BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_err) {
    data = { error: text };
  }

  if (!res.ok) {
    const error = new Error((data && data.error) || `Request failed (${res.status})`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const api = {
  register: (payload) => request('/users/register', { method: 'POST', body: payload }),
  login: (payload) => request('/users/login', { method: 'POST', body: payload }),
  profile: () => request('/users/profile'),
  listProducts: (category) =>
    request(`/products${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  searchProducts: (q) => request(`/products/search?q=${encodeURIComponent(q)}`),
  getProduct: (id) => request(`/products/${id}`),
  createOrder: (items) => request('/orders', { method: 'POST', body: { items } }),
  listOrders: () => request('/orders'),
  getOrder: (id) => request(`/orders/${id}`)
};