# Force linux/amd64 because mediapipe (used by this service) does NOT publish
# aarch64 Linux wheels — only manylinux_2_28_x86_64, macosx_arm64, and win_amd64.
# On Apple Silicon hosts this runs through Rosetta (slower but works).
FROM --platform=linux/amd64 python:3.11-slim
COPY --from=ghcr.io/astral-sh/uv:0.9.28 /uv /uvx /bin/
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libsndfile1 libgl1 libglib2.0-0 curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt requirements.lock* ./
RUN if [ -f requirements.lock ]; then \
      uv pip install --system --no-cache -r requirements.lock ; \
    else \
      uv pip install --system --no-cache -r requirements.txt ; \
    fi
COPY . .
RUN mkdir -p uploads
EXPOSE 8425
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8425"]
