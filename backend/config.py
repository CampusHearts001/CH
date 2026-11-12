"""
CampusMatch - Central configuration.
All secrets are loaded from environment variables.
"""

import os
from dotenv import load_dotenv

load_dotenv()


def _csv(name: str, default: str = "") -> list[str]:
    return [
        v.strip().lower() for v in os.environ.get(name, default).split(",") if v.strip()
    ]


# Authentication and college restrictions
ALLOWED_EMAIL_DOMAINS: list[str] = _csv("ALLOWED_EMAIL_DOMAINS")

REQUIRE_VERIFIED_EMAIL: bool = (
    os.environ.get("REQUIRE_VERIFIED_EMAIL", "true").lower() == "true"
)


# CORS
CORS_ORIGINS: list[str] = _csv(
    "CORS_ORIGINS",
    "http://localhost:5173,"
    "http://127.0.0.1:5173,"
    "http://localhost:3000,"
    "https://campusmatch01.netlify.app",
)


# Reporting
AUTO_HIDE_REPORTS: int = int(os.environ.get("AUTO_HIDE_REPORTS", "3"))


# Self-hosted UPI Gateway
UPI_GATEWAY_BASE_URL: str = os.environ.get(
    "UPI_GATEWAY_BASE_URL",
    "https://upi-gateway-production-91514c2e.up.railway.app",
).rstrip("/")

UPI_GATEWAY_API_KEY: str = os.environ.get("UPI_GATEWAY_API_KEY", "")

UPI_GATEWAY_API_SECRET: str = os.environ.get("UPI_GATEWAY_API_SECRET", "")

UPI_GATEWAY_WEBHOOK_SECRET: str = os.environ.get("UPI_GATEWAY_WEBHOOK_SECRET", "")


# Weekly membership
SUBSCRIPTION_AMOUNT_PAISE: int = 12900
SUBSCRIPTION_CURRENCY: str = "INR"
SUBSCRIPTION_PERIOD_DAYS: int = 7
