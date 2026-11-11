"""
CampusMatch - Central configuration (read from environment variables).
"""
import os

from dotenv import load_dotenv

load_dotenv()


def _csv(name: str, default: str = "") -> list[str]:
    return [v.strip().lower() for v in os.environ.get(name, default).split(",") if v.strip()]


# Only emails ending in one of these domains may create a profile.
# Example: "ncuindia.edu"  (leave empty ONLY for local development)
ALLOWED_EMAIL_DOMAINS: list[str] = _csv("ALLOWED_EMAIL_DOMAINS")

# Require the user to have clicked the confirmation link in their inbox.
REQUIRE_VERIFIED_EMAIL: bool = os.environ.get("REQUIRE_VERIFIED_EMAIL", "true").lower() == "true"

# Allowed browser origins (comma separated). Add your deployed frontend URL here.
CORS_ORIGINS: list[str] = _csv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000",
)

# A profile is hidden automatically once this many different people report it.
AUTO_HIDE_REPORTS: int = int(os.environ.get("AUTO_HIDE_REPORTS", "3"))
