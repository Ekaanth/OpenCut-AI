FROM python:3.11-slim

COPY --from=ghcr.io/astral-sh/uv:0.9.28 /uv /uvx /bin/

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg curl \
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

EXPOSE 8427

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8427"]
