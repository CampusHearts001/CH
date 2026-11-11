import axios from 'axios'
import { supabase } from './supabase'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach the Supabase JWT to every request automatically
api.interceptors.request.use(
  async (config) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Normalize error messages from FastAPI
api.interceptors.response.use(
  (response) => response,
  (error) => {
    let detail = error.response?.data?.detail
    if (Array.isArray(detail)) detail = detail.map((d) => d.msg).join(' ')  // FastAPI validation errors
    const message =
      detail ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred.'
    return Promise.reject(new Error(message))
  }
)

export default api
