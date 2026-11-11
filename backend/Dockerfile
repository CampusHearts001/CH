# CampusMatch FastAPI backend — Railway Docker deployment
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Cache dependencies separately from the application source.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . ./

# Run the API without root privileges.
RUN useradd --create-home appuser
USER appuser

# Local default only; Railway supplies PORT at runtime.
EXPOSE 8000
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
