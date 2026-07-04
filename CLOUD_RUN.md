# Google Cloud Run Deployment

This deployment path runs the same static Zone Trip site in a container on Cloud Run with scale-to-zero enabled.

Cloud Run is useful for public review and lightweight availability. It is **not** the charter-compliant booth runtime for participant material unless the deployment is explicitly scoped to public, non-sensitive static content. The standalone Linux path remains the default for local/offline installations.

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
