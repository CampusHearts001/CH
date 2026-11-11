import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

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

export default function Profile() {
  const { user, signOut } = useAuth()
  const navigate           = useNavigate()
  const fileRef            = useRef(null)

  const [profile, setProfile]       = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [editing, setEditing]       = useState(false)
  const [saving, setSaving]         = useState(false)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)

  const [form, setForm] = useState({})

  useEffect(() => {
    api.get('/profiles/me')
      .then(({ data }) => {
        setProfile(data)
        setForm({
          name:         data.name,
          age:          data.age,
          bio:          data.bio || '',
          gender:       data.gender,
          interested_in: data.interested_in,
          college:      data.college,
          interests:    data.interests || [],
          contact_info: data.contact_info || '',
        })
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

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
    if (file.size > 5 * 1024 * 1024) { setError('Photo must be under 5 MB.'); return }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    setError('')
    setSaving(true)
    try {
      let avatar_url = profile.avatar_url

      if (avatarFile && user) {
        const ext  = avatarFile.name.split('.').pop()
        const path = `${user.id}/avatar.${ext}`
        const { error: upErr } = await supabase.storage
          .from('avatars')
          .upload(path, avatarFile, { upsert: true })
        if (upErr) throw new Error(`Upload failed: ${upErr.message}`)
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
        avatar_url = urlData?.publicUrl || null
      }

      const { data } = await api.put('/profiles/me', {
        ...form,
        age:      parseInt(form.age),
        bio:      form.bio || null,
        avatar_url,
        contact_info: form.contact_info || null,
      })

      setProfile(data)
      setEditing(false)
      setAvatarFile(null)
      setAvatarPreview(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-primary" />
      </div>
    )
  }

  const displayProfile = profile || {}
  const displayAvatar  = avatarPreview || displayProfile.avatar_url

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <span>👤</span> Profile
        </h1>
        <div className="flex items-center gap-2">
          {!editing ? (
            <button onClick={() => setEditing(true)} className="btn-ghost text-sm">
              Edit ✏️
            </button>
          ) : (
            <button onClick={() => { setEditing(false); setAvatarFile(null); setAvatarPreview(null) }} className="btn-ghost text-sm">
              Cancel
            </button>
          )}
          <button onClick={handleSignOut} className="btn-ghost text-sm text-primary-400">
            Sign out
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-primary/10 border border-primary/30 text-primary-300 rounded-xl px-4 py-3 mb-5 text-sm">
          {error}
        </div>
      )}

      {/* Avatar */}
      <div className="flex flex-col items-center mb-6">
        <div
          className={`w-32 h-32 rounded-full overflow-hidden border-4 border-primary shadow-lg shadow-primary/20 ${editing ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
          onClick={editing ? () => fileRef.current?.click() : undefined}
        >
          {displayAvatar ? (
            <img src={displayAvatar} alt={displayProfile.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-primary/20 flex items-center justify-center text-5xl font-bold text-primary">
              {displayProfile.name?.[0] ?? '?'}
            </div>
          )}
        </div>
        {editing && (
          <>
            <button
              onClick={() => fileRef.current?.click()}
              className="mt-2 text-primary-400 text-sm font-medium hover:text-primary-300"
            >
              Change photo
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
          </>
        )}
        {!editing && (
          <>
            <h2 className="text-xl font-bold text-white mt-3">{displayProfile.name}, {displayProfile.age}</h2>
            <p className="text-white/50 text-sm">🎓 {displayProfile.college}</p>
          </>
        )}
      </div>

      {/* View mode */}
      {!editing && (
        <div className="space-y-4 animate-fade-in">
          {displayProfile.bio && (
            <div className="card p-4">
              <p className="text-white/40 text-xs font-medium mb-1 uppercase tracking-wider">Bio</p>
              <p className="text-white text-sm leading-relaxed">{displayProfile.bio}</p>
            </div>
          )}

          <div className="card p-4 grid grid-cols-2 gap-3">
            <div>
              <p className="text-white/40 text-xs uppercase tracking-wider mb-0.5">Gender</p>
              <p className="text-white text-sm capitalize">{displayProfile.gender}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs uppercase tracking-wider mb-0.5">Looking for</p>
              <p className="text-white text-sm capitalize">{displayProfile.interested_in}</p>
            </div>
          </div>

          {displayProfile.interests?.length > 0 && (
            <div className="card p-4">
              <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Interests</p>
              <div className="flex flex-wrap gap-2">
                {displayProfile.interests.map((tag) => (
                  <span key={tag} className="interest-tag interest-tag-active text-xs">{tag}</span>
                ))}
              </div>
            </div>
          )}

          {displayProfile.contact_info && (
            <div className="card p-4">
              <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Contact info</p>
              <p className="text-white text-sm">{displayProfile.contact_info}</p>
              <p className="text-white/30 text-xs mt-1">Shared with mutual matches only</p>
            </div>
          )}
        </div>
      )}

      {/* Edit mode */}
      {editing && (
        <div className="space-y-4 animate-fade-in">
          <div>
            <label className="block text-sm font-medium text-white/60 mb-1.5">Name</label>
            <input className="input-field" value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-1.5">Age</label>
            <input type="number" className="input-field" value={form.age} onChange={(e) => set('age', e.target.value)} min={18} max={99} />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-1.5">College</label>
            <input className="input-field opacity-60" value={form.college} readOnly />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-1.5">Bio</label>
            <textarea
              className="input-field resize-none"
              rows={3}
              value={form.bio}
              onChange={(e) => set('bio', e.target.value)}
              maxLength={500}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-1.5">Gender</label>
            <div className="flex gap-2">
              {['male', 'female', 'non-binary'].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => set('gender', g)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all capitalize ${
                    form.gender === g
                      ? 'bg-primary/20 border-primary text-primary-300'
                      : 'bg-surface-50 border-white/10 text-white/60'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-1.5">Interested in</label>
            <div className="flex gap-2 flex-wrap">
              {['male', 'female', 'non-binary', 'everyone'].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => set('interested_in', g)}
                  className={`py-2 px-3 rounded-xl text-sm font-medium border transition-all capitalize ${
                    form.interested_in === g
                      ? 'bg-primary/20 border-primary text-primary-300'
                      : 'bg-surface-50 border-white/10 text-white/60'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-3">Interests</label>
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleInterest(value)}
                  className={`interest-tag ${
                    form.interests.includes(value) ? 'interest-tag-active' : 'interest-tag-inactive'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-1.5">Contact info</label>
            <input
              className="input-field"
              value={form.contact_info}
              onChange={(e) => set('contact_info', e.target.value)}
              placeholder="Instagram, phone, etc."
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary w-full mt-2"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}
    </div>
  )
}
