FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    OLLAMA_HOST=127.0.0.1:11434 \
    OLLAMA_MODELS=/models/ollama \
    OLLAMA_URL=http://127.0.0.1:11434 \
    ZONETRIP_WHISPER_DEVICE=auto \
    ZONETRIP_WHISPER_COMPUTE_TYPE=auto \
    ZONETRIP_WHISPER_MODEL=base \
    ZONETRIP_OLLAMA_MODEL=llama3.1:8b-instruct-q4_K_M

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    python3 \
    python3-pip \
  && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://ollama.com/install.sh | sh

WORKDIR /app

COPY requirements.txt ./
RUN python3 -m pip install --no-cache-dir --upgrade pip \
  && python3 -m pip install --no-cache-dir -r requirements.txt

COPY app.py start.sh ./
RUN chmod 0755 /app/start.sh

EXPOSE 8080

CMD ["/app/start.sh"]
