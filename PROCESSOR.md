# Zone Trip Processor

The processor is the local AI boundary for speech-to-text and derived world-model updates.

It is designed to run on the same Linux booth PC as the microphone capture process. Cloud Run is only a simulator for sizing and operational review. GitHub Pages is only a visual/browser simulation of the installation.

## Local Runtime

Local path:

1. A microphone connected to the booth PC captures audio.
2. The local capture process sends temporary audio to the processor on the same Linux box.
3. Processor runs Whisper through `faster-whisper`.
4. Processor reads immutable `charter.md` and current durable `model.md`.
5. Processor sends `charter.md`, `model.md`, and the temporary STT transcript to local Ollama.
6. Ollama returns a complete replacement `model.md` plus simulator review fields.
7. Processor atomically writes the new `model.md`.
8. Temporary audio and transcript buffers die with the request.

Default local endpoints:

- `GET http://127.0.0.1:8090/health`
- `POST http://127.0.0.1:8090/process-audio`

Development-only endpoint:

- `POST http://127.0.0.1:8090/process-stt`

`/process-stt` is disabled unless `ZONETRIP_ENABLE_DEV_STT=1` is set.

## Install On The Booth PC

Install the static site first:

```sh
sudo ./install.sh
```

Then install Ollama and the processor on the same machine:

```sh
sudo ./scripts/install-local-ai.sh
```

The installer:

- installs Ollama if missing
- creates `/opt/zonetrip/.venv`
- seeds `/var/lib/zonetrip/model.md` from the packaged model
- installs `services/processor/requirements.txt`
- pulls `gemma3:12b` by default
- installs `zonetrip-processor.service`

Override the model before installing:

```sh
sudo ZONETRIP_OLLAMA_MODEL=gemma3:4b ./scripts/install-local-ai.sh
```

By default the installed browser simulator is nearly identical to GitHub Pages:
it shows the same booth scene, starts with the same threshold, listens through
the microphone path, and keeps the text drawer hidden. The only default
difference is that local install points `worldModelEndpoint` at the localhost
processor.

## Capture From The Booth Microphone

The real booth path does not require a participant browser. For a single capture pass:

```sh
ZONETRIP_CAPTURE_SECONDS=90 ./bin/zonetrip-capture-once
```

The helper records from the local ALSA default input and posts the temporary audio to `http://127.0.0.1:8090/process-audio`. Override the input device with:

```sh
ZONETRIP_AUDIO_DEVICE=hw:1,0 ./bin/zonetrip-capture-once
```

The browser/Pages route can still simulate capture for review, but it is not the real participant interface.

## Idle Simulation

The browser simulator uses Web Audio RMS as lightweight VAD. `idlePowerdownMs: 60000` dims the eight overhead spots after one minute without detected speech. This is a visual cue for Cloud Run scale-to-zero review; the physical local booth does not need a visitor UI to enforce this state.

The processor also uses faster-whisper with `vad_filter=True`. If Whisper produces no transcript, `/process-audio` returns `422 no speech detected` and skips the `model.md` update.

## Cloud Run Simulator

Cloud Run can simulate the one-box booth PC with an L4 GPU:

```sh
./scripts/deploy-cloud-run-processor.sh PROJECT_ID us-central1 zonetrip-processor
```

The simulator container runs:

- Ollama
- `faster-whisper`
- FastAPI processor endpoints

Use it to estimate latency, memory, model size, and cold-start behavior for the equivalent local Linux box. It is not the default participant-material runtime.

## API

Raw audio:

```sh
curl -X POST http://127.0.0.1:8090/process-audio \
  -H 'Content-Type: audio/webm' \
  --data-binary @sample.webm
```

Existing STT text, after starting the processor with
`ZONETRIP_ENABLE_DEV_STT=1`:

```sh
curl -X POST http://127.0.0.1:8090/process-stt \
  -H 'Content-Type: application/json' \
  -d '{"transcript":"I feel the community is changing, but I am not sure what we are losing."}'
```

## Development Text Input

The installed local simulator can enable a drawer text form for development:

```sh
sudo ZONETRIP_ENABLE_DEV_TEXT=1 ./scripts/install-local-ai.sh
```

That opt-in writes this local browser configuration:

```js
window.ZoneTripBoothConfig = {
  worldModelEndpoint: "http://127.0.0.1:8090/process-audio",
  textModelEndpoint: "http://127.0.0.1:8090/process-stt",
  devTextInput: true,
};
```

The installer also writes `/etc/default/zonetrip-processor` with
`ZONETRIP_ENABLE_DEV_STT=1`, so the API and browser shortcut are enabled
together. Without that opt-in, `/process-stt` returns 404 and the drawer form
stays hidden. The form is only a developer shortcut for testing the STT-output
side of the loop. It posts text to `/process-stt`, renders the returned
`model_markdown`, and clears the textarea after a successful update. The real
booth remains microphone-only.

Response fields are limited to constitutionally allowed derived signals:

- `tensions`
- `contradictions`
- `absences`
- `symbolic_patterns`
- `minority_signals`
- `open_questions`
- `rejected_content`
- `raw_transcript_retained`
- `model_markdown`

`model_markdown` is the complete current derived `model.md`. It is generated under `charter.md` and must not contain transcript text.

## Contract Regression Test

Run the local processor contract checks with a Python environment that has
`services/processor/requirements.txt` installed:

```sh
python scripts/test-processor-contract.py
```

The test covers audio content-type handling, model Markdown normalization, raw
transcript scrubbing, subgroup-term scrubbing, and timestamp-free fallback
generation.
