# --- Frontend build ---
FROM node:20-alpine AS frontend
WORKDIR /ui
COPY ui/package.json ui/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci
COPY ui/ .
RUN npm run build

# --- Python base ---
FROM python:3.12-slim AS base
WORKDIR /app
RUN addgroup --system app && adduser --system --ingroup app app

# --- Dependencies ---
FROM base AS deps
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir -r requirements.txt

# --- Production ---
FROM deps AS production
COPY app/ app/
COPY --from=frontend /ui/dist ui/dist
USER app
EXPOSE 8200
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8200/health')"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8200", "--workers", "2"]

# --- Development ---
FROM deps AS development
COPY app/ app/
EXPOSE 8200
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8200", "--reload"]
