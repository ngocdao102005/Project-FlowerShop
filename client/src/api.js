const API_BASE = import.meta.env.VITE_API_BASE || '/api'
const TOKEN_KEY = 'flowery_token'

let token = localStorage.getItem(TOKEN_KEY) || ''

export function setToken(nextToken) {
  token = nextToken || ''
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export function hasToken() {
  return Boolean(token)
}

export async function request(path, options = {}) {
  // Khối HTTP dùng chung: tự gắn token, mã hóa JSON và chuẩn hóa lỗi từ API.
  const headers = new Headers(options.headers || {})
  headers.set('Accept', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: options.body && !(options.body instanceof FormData)
      ? JSON.stringify(options.body)
      : options.body,
  })

  if (response.status === 204) return null
  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text()
  if (!response.ok) {
    const requestId = payload?.request_id ? ` (mã lỗi: ${payload.request_id})` : ''
    const error = new Error(`${payload?.error || payload || 'Không thể kết nối hệ thống.'}${response.status >= 500 ? requestId : ''}`)
    error.status = response.status
    error.payload = payload
    throw error
  }
  return payload
}

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
}
