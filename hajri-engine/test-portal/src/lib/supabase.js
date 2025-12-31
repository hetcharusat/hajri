import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://etmlimraemfdpvrsgdpk.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bWxpbXJhZW1mZHB2cnNnZHBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzODI4NjksImV4cCI6MjA4MTk1ODg2OX0.7mZzdrt2bbhqI8Eh-cwWL9yIr1Kdx1WxK7ZVw7h2dbo'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Engine API base URL - use localhost for consistency
export const ENGINE_URL = 'http://localhost:8000'

// OCR Service configuration
// In development: http://localhost:8001 (hajri-ocr runs on 8001 to avoid conflict with engine on 8000)
// In production: set to your deployed OCR service URL
export const OCR_URL = 'http://localhost:8001'

// OCR API Key - required for /ocr/extract endpoint
// Set APP_API_KEY in hajri-ocr .env file to match this
// In development without APP_API_KEY configured in hajri-ocr, auth is skipped
export const OCR_API_KEY = 'MeuOm60op3aOgp9XMNuwbQK9y1LH0E_Z8uqZX6FSxOOoM2jLPW2bcgEr3AbZ3Fvj'

// Dev mode flag - uses test tokens instead of real JWT
export const DEV_MODE = true

// Fixed test student UUID (must exist in students table)
// Created by 10-sample-hierarchy-data.sql migration
export const TEST_STUDENT_ID = '11111111-1111-1111-1111-111111111111'

// Get current session token
export async function getAuthToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token
}

// API call helper with auth
// In dev mode, uses test tokens that the engine accepts
export async function apiCall(method, endpoint, body = null, studentId = null) {
  const headers = {
    'Content-Type': 'application/json',
  }
  
  if (DEV_MODE) {
    // Dev mode: use test token format that engine accepts
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id || 'anonymous'
    headers['Authorization'] = `Bearer test-token-${userId}`
    // Pass the fixed test student UUID for dev mode
    headers['X-Student-ID'] = studentId || TEST_STUDENT_ID
  } else {
    // Production: use real Supabase JWT
    const token = await getAuthToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
  }
  
  const options = { method, headers }
  if (body) {
    options.body = JSON.stringify(body)
  }
  
  const response = await fetch(`${ENGINE_URL}${endpoint}`, options)
  const data = await response.json()
  
  if (!response.ok) {
    // Handle PolicyViolation responses which have message, rule, suggestion
    if (data.error === 'policy_violation') {
      const parts = [data.message]
      if (data.suggestion) parts.push(data.suggestion)
      throw new Error(parts.join(' '))
    }
    // Handle standard FastAPI error responses
    const errorMsg = typeof data.detail === 'string' 
      ? data.detail 
      : (data.message || JSON.stringify(data.detail) || 'API Error')
    throw new Error(errorMsg)
  }
  
  return data
}

/**
 * Call the OCR service to extract attendance from an image
 * @param {File} imageFile - Image file to process
 * @returns {Promise<{success: boolean, message: string, entries: Array}>}
 */
export async function ocrExtract(imageFile) {
  const formData = new FormData()
  formData.append('file', imageFile)

  const headers = {}
  
  // Add API key authentication if configured
  if (OCR_API_KEY) {
    headers['X-API-Key'] = OCR_API_KEY
  }

  const response = await fetch(`${OCR_URL}/ocr/extract`, {
    method: 'POST',
    headers,
    body: formData,
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.detail || data.message || 'OCR extraction failed')
  }

  return data
}
