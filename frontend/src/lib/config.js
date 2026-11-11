// Campus settings. Override in frontend/.env
export const COLLEGE_NAME = import.meta.env.VITE_COLLEGE_NAME || 'The NorthCap University'

// Comma separated list of allowed student-email domains, e.g. "ncuindia.edu"
export const ALLOWED_EMAIL_DOMAINS = (import.meta.env.VITE_ALLOWED_EMAIL_DOMAINS || 'ncuindia.edu')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean)

export function isCollegeEmail(email) {
  const domain = email.trim().toLowerCase().split('@')[1] || ''
  return ALLOWED_EMAIL_DOMAINS.some((d) => domain === d || domain.endsWith('.' + d))
}

export const OPPOSITE_GENDER = { male: 'female', female: 'male', 'non-binary': 'everyone' }
