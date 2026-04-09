FROM python:3.11-slim

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
# TURBOQUANT_EXTRAS is empty by default (CPU build). Set to "gpu" via the GPU
# compose override file to layer cuTile kernels on top of the base install.
ARG TURBOQUANT_EXTRAS=""
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
 && if [ -n "$TURBOQUANT_EXTRAS" ]; then \
      pip install --no-cache-dir "turboquant-gpu[$TURBOQUANT_EXTRAS]" \
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
