# 💘 CampusMatch

A dating web app for the students of **one college**, designed for people who are shy or afraid of rejection.

**How it works**
1. Sign up with your college email (verified by link). Everyone on the app is single.
2. Swipe through people of the opposite gender. ✕ = pass, ❤️ = send a heart.
3. **Hearts are secret.** Nobody is ever told they were passed on, and a heart is only revealed if the other person hearts you back.
4. On a match, either of you can tap *Share Contact*. Numbers/Instagram unlock only when **both** agree. Then you message privately on your own.
5. Not ready to share contact? Play a turn-based word game together first.

Stack: React + Vite + Tailwind · FastAPI · Supabase (Auth, Postgres, Storage)

## Setup

### 1. Supabase
1. Create a project at supabase.com.
2. SQL Editor → run `supabase_schema.sql`.  
   *(Already ran the old schema? Run `supabase_migration_v1_1.sql` instead.)*
3. Authentication → Providers → Email: keep **Confirm email** ON.
4. Authentication → URL Configuration: add `http://localhost:5173` (and your deployed URL) as a redirect URL.
5. Settings → API: copy the Project URL, `anon` key and `service_role` key.

### 2. Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # fill in keys + ALLOWED_EMAIL_DOMAINS
uvicorn main:app --reload --port 8000
```
Docs at http://localhost:8000/docs

### 3. Frontend
```bash
cd frontend
npm install
cp .env.example .env      # fill in keys, college name, email domain
npm run dev
```
Open http://localhost:5173

## Security model
- The browser only uses the public anon key for **login and avatar upload**. All other data goes through the FastAPI backend.
- Every database table has Row Level Security on with **no public policies**, so the anon key can read nothing. The backend uses the `service_role` key (never put it in the frontend or git) and checks permissions itself.
- `contact_info` is never sent to anyone until both people in a match have tapped *Share Contact*.
- The college-email rule and email verification are enforced on the **server** (`ALLOWED_EMAIL_DOMAINS`), not just in the browser.
- Reporting someone hides them from you, ends any match, and auto-hides their profile after `AUTO_HIDE_REPORTS` (default 3) different reporters.

## API
| Method | Path | Purpose |
|---|---|---|
| GET/POST/PUT | `/profiles/me` | own profile |
| GET | `/profiles/discover` | next random profile to swipe |
| POST | `/swipes` | swipe; auto-creates a match on mutual hearts |
| GET | `/matches` | my matches |
| POST | `/matches/{id}/share-contact` | opt in to contact exchange |
| DELETE | `/matches/{id}` | unmatch |
| POST | `/games` | start (or resume) the word game for a match |
| GET | `/games/match/{id}`, `/games/{id}` | game state |
| POST | `/games/{id}/guess` | submit a guess |
| POST | `/reports` | report a profile |

## Deploying
Frontend → Vercel/Netlify (set the `VITE_*` vars). Backend → Render/Railway/Fly (set the backend vars, and put your frontend URL in `CORS_ORIGINS`).
