FROM python:3.11-slim

# Bring in the uv binary from Astral's distroless image. Pinned to a specific
# tag so builds stay deterministic — bump the tag to upgrade.
COPY --from=ghcr.io/astral-sh/uv:0.9.28 /uv /uvx /bin/

# Install FFmpeg and system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies via uv (10-100x faster than pip).
# Prefer the lockfile when present, fall back to requirements.txt otherwise.
# `--system` writes to the container's system Python — no venv needed because
# the container already isolates us.
COPY requirements.txt requirements.lock* ./
RUN if [ -f requirements.lock ]; then \
      uv pip install --system --no-cache -r requirements.lock ; \
    else \
      uv pip install --system --no-cache -r requirements.txt ; \
    fi

# Copy application code
COPY . .

# Create directories for generated files and uploads
RUN mkdir -p generated uploads uploads/youtube

EXPOSE 8420

CMD ["python", "run.py"]
