// API Configuration
// Detects the backend URL based on environment

const getApiUrl = () => {
  // Use environment variable if set (for Railway or custom deployments)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  
  // For localhost development
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://127.0.0.1:8000'
  }
  
  // In production, backend is on same domain (Railway handles routing)
  return window.location.origin
}

export const API_URL = getApiUrl()
export const WS_URL = API_URL.replace('http://', 'ws://').replace('https://', 'wss://')

