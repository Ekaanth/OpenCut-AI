FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ffmpeg \
    libsndfile1 \
    espeak-ng \
    build-essential \
    cargo \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN pip install --upgrade pip
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN mkdir -p generated/voices
ENV COQUI_TOS_AGREED=1
EXPOSE 8422
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8422"]
