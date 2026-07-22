/**
 * Vite 환경 변수에서 API base URL을 읽습니다.
 * - 로컬(.env.local): http://localhost:8080
 * - 프로덕션(.env.production): '' (상대 경로로 같은 origin 호출)
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export function buildApiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('token')
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(buildApiUrl(path), {
    ...options,
    headers,
  })

  if (!response.ok) {
    let errorMessage = `API 요청 실패: ${response.status} ${response.statusText}`
    try {
      const errorData = await response.json()
      if (errorData && errorData.message) {
        errorMessage = errorData.message
      }
    } catch (e) {
      // Ignore and use default message if not JSON
    }
    throw new Error(errorMessage)
  }

  const text = await response.text()
  return text ? JSON.parse(text) : null
}

// 사용 예시:
//
// import { apiFetch } from './api/client'
//
// // GET http://localhost:8080/api/stocks (로컬)
// // GET /api/stocks (프로덕션, 같은 origin)
// const stocks = await apiFetch('/api/stocks')
//
// // POST
// const created = await apiFetch('/api/orders', {
//   method: 'POST',
//   body: JSON.stringify({ symbol: 'AAPL', quantity: 10 }),
// })
