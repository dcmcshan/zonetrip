FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ZONETRIP_HOST=0.0.0.0 \
    ZONETRIP_ROOT=/app

WORKDIR /app

COPY index.html booth.html styles.css script.js booth.js favicon.svg .nojekyll ./
COPY docs ./docs
COPY bin ./bin

RUN chmod 0755 /app/bin/zonetrip-serve

EXPOSE 8080

CMD ["/app/bin/zonetrip-serve"]
