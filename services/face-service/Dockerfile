FROM --platform=linux/amd64 python:3.11-slim

COPY --from=ghcr.io/astral-sh/uv:0.9.28 /uv /uvx /bin/

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg libsndfile1 libgl1 libglib2.0-0 curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt requirements.lock* ./
RUN --mount=type=cache,target=/root/.cache/uv \
    if [ -f requirements.lock ]; then \
      uv pip install --system -r requirements.lock ; \
    else \
      uv pip install --system -r requirements.txt ; \
    fi

COPY . .

RUN mkdir -p uploads

EXPOSE 8425

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8425"]
