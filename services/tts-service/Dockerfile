FROM python:3.11-slim

COPY --from=ghcr.io/astral-sh/uv:0.9.28 /uv /uvx /bin/

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ffmpeg libsndfile1 espeak-ng build-essential cargo \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt requirements.lock* ./
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=cache,target=/root/.cache/pip \
    if [ -f requirements.lock ]; then \
      uv pip install --system \
        --index-strategy unsafe-best-match \
        --extra-index-url https://download.pytorch.org/whl/cpu \
        -r requirements.lock ; \
    else \
      uv pip install --system \
        --index-strategy unsafe-best-match \
        --extra-index-url https://download.pytorch.org/whl/cpu \
        -r requirements.txt ; \
    fi

COPY . .

RUN mkdir -p generated/voices
ENV COQUI_TOS_AGREED=1

EXPOSE 8422

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8422"]
