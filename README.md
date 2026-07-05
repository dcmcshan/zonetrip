# Zone Trip

Zone Trip is a browser-based listening interface backed by the working white paper:

**Zone Trip: A Non-Directive Local AI Mirror for Community Self-Understanding**

The front page simulates the physical installation for review. The real booth is a microphone connected to one Linux box running capture, Whisper, Ollama, and the processor locally. Pages and local install use the same front end by default; local install only adds the localhost audio endpoint. The manifesto route presents the project's core question, constitutional limits, local-first architecture, deployment gates, and collaborator needs.

## Live Site

https://zonetrip.castalia.institute/

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

## Local AI Processor

The local AI path uses Whisper plus Ollama on equivalent local hardware. Cloud Run is treated as a simulator for this processor, not the charter-compliant default runtime.

See `PROCESSOR.md`.

## Cloud Run Review Deployment

For a public review endpoint, the same static site can deploy to Google Cloud Run with scale-to-zero:

```sh
./scripts/deploy-cloud-run.sh YOUR_PROJECT_ID us-central1 zonetrip
```

See `CLOUD_RUN.md`. This is intended for public static content review, not for participant-material processing under the local/offline charter.

## Project Structure

- `index.html` - browser-based installation simulator
- `booth.html` - compatibility route for the simulator
- `manifesto/` - project manifesto and deployment doctrine
- `architecture/` - runtime architecture and processing-loop documentation
- `styles.css` - responsive visual system
- `script.js` - content data and rendering
- `scene.js` - Three.js rendered booth scene
- `booth.js` - local microphone recording controls
- `booth-config.js` - explicit world-model endpoint configuration
- `CNAME` - GitHub Pages custom domain
- `charter.md` - immutable LLM input for constitutional boundaries
- `model.md` - seeded durable derived world model
- `WORLD_MODEL.md` - boundary for derived model updates without transcript storage
- `HARDWARE.md` - one-PC-per-booth hardware assumption
- `PROCESSOR.md` - local Whisper/Ollama processor and Cloud Run simulator
- `SIMULATION.md` - synthetic community simulation and mirror evaluation harness
- `assets/` - local responsive stage imagery
- `vendor/three/` - vendored Three.js runtime module
- `services/processor/` - FastAPI processor for Whisper and Ollama
- `docs/` - source white paper PDF
- `bin/zonetrip-serve` - local static server
- `bin/zonetrip-capture-once` - local microphone capture helper for the real booth
- `deploy/systemd/` - optional systemd unit
- `scripts/` - standalone audit and Linux package scripts
- `Dockerfile` - Cloud Run compatible container

## Community Simulation

Run the synthetic mirror-evaluation harness with:

```sh
python -m pip install -r services/processor/requirements.txt
python scripts/simulate-community.py
```

It evaluates representative temporary inputs against charter boundaries and
writes `simulations/reports/community-evaluation.md`. See `SIMULATION.md`.

## Product Direction

The next useful step is to turn this static site into a prototype workspace for:

- booth consent copy
- local processing architecture notes
- nightly burn protocol
- steward review checklist
- public reflection examples
