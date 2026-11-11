"""
CampusMatch - Supabase client.

The backend is the ONLY thing that talks to the database. It uses the
service-role key (bypasses Row Level Security) and enforces every permission
check itself, after verifying the user's JWT in auth.py. Row Level Security is
switched on for all tables with no public policies, so nobody can read or write
the data directly from the browser with the public anon key.
"""
import os

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY: str = os.environ.get("SUPABASE_KEY", "")                  # anon key (only used to verify JWTs)
SUPABASE_SERVICE_KEY: str = os.environ.get("SUPABASE_SERVICE_KEY", "")  # service-role key (database access)

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise EnvironmentError(
        "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set. "
        "Copy backend/.env.example to backend/.env and fill them in "
        "(Supabase dashboard -> Project Settings -> API)."
    )

# Database client (service role)
db: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Separate client used only to validate user access tokens
auth_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY or SUPABASE_SERVICE_KEY)


def get_db() -> Client:
    """FastAPI dependency returning the database client."""
    return db
