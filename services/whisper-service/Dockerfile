FROM python:3.11-slim
COPY --from=ghcr.io/astral-sh/uv:0.9.28 /uv /uvx /bin/
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libsndfile1 curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt requirements.lock* ./
RUN if [ -f requirements.lock ]; then \
      uv pip install --system --no-cache -r requirements.lock ; \
    else \
      uv pip install --system --no-cache -r requirements.txt ; \
    fi
COPY . .
RUN mkdir -p uploads
EXPOSE 8421
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8421"]
