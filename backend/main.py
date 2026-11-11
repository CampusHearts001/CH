"""
CampusMatch - FastAPI application entry point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import config
from routers import games, matches, profiles, reports, swipes

app = FastAPI(
    title="CampusMatch API",
    description="Backend API for the CampusMatch college dating app.",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profiles.router)
app.include_router(swipes.router)
app.include_router(matches.router)
app.include_router(games.router)
app.include_router(reports.router)


@app.get("/", tags=["health"])
def health_check():
    return {"status": "ok", "app": "CampusMatch API", "version": app.version}
