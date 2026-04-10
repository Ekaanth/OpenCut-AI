FROM python:3.11-slim

# Bring in the uv binary from Astral's distroless image. Pinned for determinism.
COPY --from=ghcr.io/astral-sh/uv:0.9.28 /uv /uvx /bin/

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies via uv. The base install uses the lockfile when present
# (which is what `requirements.lock*` glob accomplishes — tolerant of missing
# file on first build, picks it up on subsequent ones).
#
# TURBOQUANT_EXTRAS is empty by default (CPU build). Set to "gpu" via the GPU
# compose override file to layer cuTile kernels on top of the base install.
# We deliberately keep the GPU extras OUT of the lockfile so the override
# doesn't bloat CPU images.
ARG TURBOQUANT_EXTRAS=""
COPY requirements.txt requirements.lock* ./
RUN if [ -f requirements.lock ]; then \
      uv pip install --system --no-cache -r requirements.lock ; \
    else \
      uv pip install --system --no-cache -r requirements.txt ; \
    fi \
 && if [ -n "$TURBOQUANT_EXTRAS" ]; then \
      uv pip install --system --no-cache \
        "turboquant-gpu[$TURBOQUANT_EXTRAS]" \
        --extra-index-url https://pypi.nvidia.com ; \
    fi

# Application
COPY app.py .

# Model cache
RUN mkdir -p /app/models
ENV HF_HOME=/app/models
ENV TRANSFORMERS_CACHE=/app/models

EXPOSE 8430

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8430"]
