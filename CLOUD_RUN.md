# Google Cloud Run Deployment

This deployment path runs the same static Zone Trip site in a container on Cloud Run with scale-to-zero enabled.

Cloud Run is useful for public review and lightweight availability. It is **not** the charter-compliant booth runtime for participant material unless the deployment is explicitly scoped to public, non-sensitive static content. The standalone Linux path remains the default for local/offline installations.

## Processor Simulator

The processor simulator is a separate Cloud Run service that approximates the local LLM hardware path:

- raw audio input
- Whisper STT through `faster-whisper`
- Ollama LLM processing
- constitutionally filtered derived signals

Deploy it with:

```sh
./scripts/deploy-cloud-run-processor.sh YOUR_PROJECT_ID us-central1 zonetrip-processor
```

This uses one NVIDIA L4 GPU, `min-instances=0`, and `max-instances=1`. It should be treated as a sizing and behavior simulator for equivalent local hardware, not as the default participant-material runtime.

The local equivalent is documented in `PROCESSOR.md`.

For fidelity testing, the processor simulator keeps the LLM inside the Cloud Run container through Ollama and the same default Gemma model used by the local booth path. A managed cloud Gemma endpoint may be operationally simpler, but it is not the same runtime path.

## Idle Scale-Down

The processor simulator deploys with `min-instances=0`, so Cloud Run is allowed to scale it to zero when it has no active traffic. Cloud Run controls the exact drain timing; the repository does not assume an exact one-minute provider shutdown.

The Pages simulator uses `idlePowerdownMs: 60000` in `booth-config.js` as a visible operational cue. Browser-side VAD estimates microphone speech energy; after one minute without detected speech, recording stops and the eight booth spotlights dim to indicate that the Cloud Run simulator can be idle or scaled down. Any interaction or renewed speech brings the lights back up.

The browser VAD is deliberately lightweight. The processor still treats Whisper/faster-whisper output as the server-side authority: if the audio produces no transcript, `/process-audio` returns `422 no speech detected` and does not update `model.md`.

## Behavior

- Containerized static site
- Public HTTP endpoint
- `min-instances=0`
- No runtime analytics, APIs, CDN, or external browser calls
- No participant data capture
- No write path

## Prerequisites

- Google Cloud project with billing enabled
- `gcloud` CLI installed and authenticated
- Cloud Run and Cloud Build APIs enabled

```sh
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

## Deploy

```sh
./scripts/deploy-cloud-run.sh YOUR_PROJECT_ID us-central1 zonetrip
```

The script deploys from source using the repository `Dockerfile`.

For the Inquiry Institute profile on this machine:

```sh
CLOUDSDK_ACTIVE_CONFIG_NAME=default ./scripts/deploy-cloud-run.sh institute-481516 us-central1 zonetrip
```

That profile is expected to use `custodian@inquiry.institute`.

## Equivalent Manual Command

```sh
gcloud run deploy zonetrip \
  --project YOUR_PROJECT_ID \
  --region us-central1 \
  --source . \
  --allow-unauthenticated \
  --port 8080 \
  --min-instances 0 \
  --max-instances 3 \
  --cpu 1 \
  --memory 512Mi \
  --set-env-vars ZONETRIP_HOST=0.0.0.0,ZONETRIP_ROOT=/app
```

## Verify

```sh
gcloud run services describe zonetrip \
  --project YOUR_PROJECT_ID \
  --region us-central1 \
  --format='value(status.url)'
```

Then check the returned URL and the PDF path:

```sh
curl -I "$URL/"
curl -I "$URL/docs/Zone_Trip_White_Paper_First_Review.pdf"
```
