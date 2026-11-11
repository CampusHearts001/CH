import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'
import { COLLEGE_NAME, OPPOSITE_GENDER } from '../lib/config'

const INTEREST_OPTIONS = [
  { label: 'Music 🎵',   value: 'Music' },
  { label: 'Gaming 🎮',  value: 'Gaming' },
  { label: 'Sports ⚽',  value: 'Sports' },
  { label: 'Movies 🎬',  value: 'Movies' },
  { label: 'Reading 📚', value: 'Reading' },
  { label: 'Coding 💻',  value: 'Coding' },
  { label: 'Art 🎨',     value: 'Art' },
  { label: 'Food 🍕',    value: 'Food' },
  { label: 'Travel ✈️',  value: 'Travel' },
  { label: 'Fitness 💪', value: 'Fitness' },
]

const TOTAL_STEPS = 3

export default function Setup() {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const fileRef   = useRef(null)

  const [step, setStep]           = useState(1)
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [avatarFile, setAvatarFile]       = useState(null)

  // Form state
  const [form, setForm] = useState({
    name: '',
    age: '',
    gender: '',
    interested_in: '',
    college: COLLEGE_NAME,
    bio: '',
    interests: [],
    contact_info: '',
  })

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const toggleInterest = (val) => {
    setForm((f) => ({
      ...f,
      interests: f.interests.includes(val)
        ? f.interests.filter((i) => i !== val)
        : [...f.interests, val],
    }))
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Photo must be under 5 MB.')
      return
    }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    setError('')
  }

  // ── Step validation ────────────────────────────────────────────────────────

  const validateStep1 = () => {
    if (!form.name.trim()) return 'Name is required.'
    if (!form.age || parseInt(form.age) < 18) return 'You must be at least 18 years old.'
    if (!form.gender) return 'Please select your gender.'
    if (!form.interested_in) return 'Please select who you are interested in.'
    return null
  }

  const validateStep2 = () => {
    if (form.interests.length === 0) return 'Select at least one interest.'
    if (form.contact_info.trim().length < 3) return 'Add your Instagram / phone so matches can reach you.'
    return null
  }

  const nextStep = () => {
    setError('')
    if (step === 1) {
      const err = validateStep1()
      if (err) return setError(err)
    }
    if (step === 2) {
      const err = validateStep2()
      if (err) return setError(err)
    }
    setStep((s) => s + 1)
  }

  // ── Final submit ───────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setError('')
    setLoading(true)

    try {
      let avatar_url = null

      // Upload avatar if one was selected
      if (avatarFile && user) {
        const ext  = avatarFile.name.split('.').pop()
        const path = `${user.id}/avatar.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, avatarFile, { upsert: true })

        if (uploadError) throw new Error(`Avatar upload failed: ${uploadError.message}`)

        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
        avatar_url = urlData?.publicUrl || null
      }

      await api.post('/profiles/me', {
        name:         form.name.trim(),
        age:          parseInt(form.age),
        gender:       form.gender,
        interested_in: form.interested_in,
        college:      form.college.trim(),
        bio:          form.bio.trim() || null,
        interests:    form.interests,
        avatar_url,
        contact_info: form.contact_info.trim() || null,
      })

      navigate('/subscription')
    } catch (err) {
      setError(err.message || 'Failed to save profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const progressPct = ((step - 1) / TOTAL_STEPS) * 100

  return (
    <div className="min-h-screen bg-surface-400 flex flex-col items-center px-4 py-10">
      {/* Header */}
      <div className="w-full max-w-sm mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">💘</span>
          <h1 className="text-2xl font-extrabold text-white">Profile Setup</h1>
        </div>
        {/* Progress bar */}
        <div className="w-full h-1.5 bg-surface-50 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-white/40 text-xs mt-2">Step {step} of {TOTAL_STEPS}</p>
      </div>

      <div className="card w-full max-w-sm p-6 animate-fade-in">
        {error && (
          <div className="bg-primary/10 border border-primary/30 text-primary-300 rounded-xl px-4 py-3 mb-5 text-sm">
            {error}
          </div>
        )}

        {/* ── Step 1: Basic info ── */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white mb-4">The basics</h2>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">Full name</label>
              <input
                className="input-field"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Alex Johnson"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">Age</label>
              <input
                type="number"
                className="input-field"
                value={form.age}
                onChange={(e) => set('age', e.target.value)}
                placeholder="21"
                min={18}
                max={99}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">Gender</label>
              <div className="flex gap-2">
                {['male', 'female', 'non-binary'].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, gender: g, interested_in: OPPOSITE_GENDER[g] }))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200 capitalize ${
                      form.gender === g
                        ? 'bg-primary/20 border-primary text-primary-300'
                        : 'bg-surface-50 border-white/10 text-white/60 hover:border-white/30'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">
                Show me <span className="text-white/30">(we pick the opposite gender for you)</span>
              </label>
              <div className="flex gap-2 flex-wrap">
                {['male', 'female', 'non-binary', 'everyone'].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => set('interested_in', g)}
                    className={`py-2 px-3 rounded-xl text-sm font-medium border transition-all duration-200 capitalize ${
                      form.interested_in === g
                        ? 'bg-primary/20 border-primary text-primary-300'
                        : 'bg-surface-50 border-white/10 text-white/60 hover:border-white/30'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">College / University</label>
              <input
                className="input-field"
                readOnly
                value={form.college}
                onChange={(e) => set('college', e.target.value)}
                
              />
            </div>
          </div>
        )}

        {/* ── Step 2: Bio + Interests ── */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-white mb-4">About you</h2>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">
                Bio <span className="text-white/30">(optional)</span>
              </label>
              <textarea
                className="input-field resize-none"
                rows={4}
                value={form.bio}
                onChange={(e) => set('bio', e.target.value)}
                placeholder="Tell potential matches a little about yourself…"
                maxLength={500}
              />
              <p className="text-white/30 text-xs mt-1 text-right">{form.bio.length}/500</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-3">
                Interests <span className="text-white/30">(pick as many as you like)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map(({ label, value }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleInterest(value)}
                    className={`interest-tag ${
                      form.interests.includes(value)
                        ? 'interest-tag-active'
                        : 'interest-tag-inactive'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">
                Contact info <span className="text-white/30">(hidden until you AND your match both agree)</span>
              </label>
              <input
                className="input-field"
                value={form.contact_info}
                onChange={(e) => set('contact_info', e.target.value)}
                placeholder="Instagram @handle, phone, etc."
              />
            </div>
          </div>
        )}

        {/* ── Step 3: Photo ── */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-white mb-4">Profile photo</h2>

            <div
              className="w-full aspect-square max-h-72 rounded-2xl overflow-hidden bg-surface-50 border-2 border-dashed border-white/20 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-all duration-200 relative"
              onClick={() => fileRef.current?.click()}
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center">
                  <div className="text-5xl mb-3">📸</div>
                  <p className="text-white/50 text-sm">Tap to select a photo</p>
                  <p className="text-white/30 text-xs mt-1">JPG, PNG, WebP — max 5 MB</p>
                </div>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />

            {avatarPreview && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="btn-ghost w-full text-sm"
              >
                Change photo
              </button>
            )}

            <p className="text-white/30 text-xs text-center">
              You can skip this and add a photo later from your profile.
            </p>
          </div>
        )}

        {/* ── Navigation buttons ── */}
        <div className="flex gap-3 mt-6">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="btn-secondary flex-1"
            >
              Back
            </button>
          )}

          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={nextStep}
              className="btn-primary flex-1"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="btn-primary flex-1"
            >
              {loading ? 'Saving…' : 'Finish setup 🎉'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
