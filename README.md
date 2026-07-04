# Zone Trip

Zone Trip is a browser-based listening interface backed by the working white paper:

**Zone Trip: A Non-Directive Local AI Mirror for Community Self-Understanding**

The front page is the participant interface. The manifesto route presents the project's core question, constitutional limits, local-first architecture, deployment gates, and collaborator needs.

## Live Site

https://castaliainstitute.github.io/zonetrip/

## Source Document

The reviewed PDF is included at:

`docs/Zone_Trip_White_Paper_First_Review.pdf`

## Run Locally

This project has no build step. Open `index.html` in a browser, or serve the folder:

```sh
./bin/zonetrip-serve --host 127.0.0.1 --port 5173 --root .
```

Then open <http://localhost:5173>.

## Standalone Linux Deployment

Zone Trip is structured as a standalone static site with no external runtime assets, no analytics, no API calls, and no cloud dependency.

Build a Linux deployment archive:

```sh
./scripts/package-linux.sh
```

See `DEPLOY.md` for systemd installation and manual run instructions.

## Cloud Run Review Deployment

For a public review endpoint, the same static site can deploy to Google Cloud Run with scale-to-zero:

```sh
./scripts/deploy-cloud-run.sh YOUR_PROJECT_ID us-central1 zonetrip
```

See `CLOUD_RUN.md`. This is intended for public static content review, not for participant-material processing under the local/offline charter.

## Project Structure

- `index.html` - browser-based listening interface
- `booth.html` - compatibility route for the listening interface
- `manifesto/` - project manifesto and deployment doctrine
- `styles.css` - responsive visual system
- `script.js` - content data and rendering
- `booth.js` - local microphone recording controls
- `booth-config.js` - explicit world-model endpoint configuration
- `WORLD_MODEL.md` - boundary for derived model updates without transcript storage
- `assets/` - local responsive stage imagery
- `docs/` - source white paper PDF
- `bin/zonetrip-serve` - local static server
- `deploy/systemd/` - optional systemd unit
- `scripts/` - standalone audit and Linux package scripts
- `Dockerfile` - Cloud Run compatible container

## Product Direction

The next useful step is to turn this static site into a prototype workspace for:

- booth consent copy
- local processing architecture notes
- nightly burn protocol
- steward review checklist
- public reflection examples
