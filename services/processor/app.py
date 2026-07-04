import json
import os
import re
import tempfile
from pathlib import Path
from typing import Any

import requests
from fastapi import FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, Field


OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("ZONETRIP_OLLAMA_MODEL", "llama3.1:8b-instruct-q4_K_M")
WHISPER_MODEL = os.getenv("ZONETRIP_WHISPER_MODEL", "base")
PROCESSOR_TOKEN = os.getenv("ZONETRIP_PROCESSOR_TOKEN", "")
LOAD_MODELS_ON_STARTUP = os.getenv("ZONETRIP_PRELOAD_MODELS", "0") == "1"

_whisper_model = None


class SttRequest(BaseModel):
  transcript: str = Field(min_length=1, max_length=24000)
  deployment_id: str | None = None


class DerivedSignals(BaseModel):
  transcript_chars: int
  tensions: list[str]
  contradictions: list[str]
  absences: list[str]
  symbolic_patterns: list[str]
  minority_signals: list[str]
  open_questions: list[str]
  rejected_content: list[str]
  raw_transcript_retained: bool = False


class AudioProcessResponse(DerivedSignals):
  stt_engine: str
  whisper_model: str


def require_token(token: str | None) -> None:
  if PROCESSOR_TOKEN and token != PROCESSOR_TOKEN:
    raise HTTPException(status_code=401, detail="invalid processor token")


def load_whisper_model():
  global _whisper_model
  if _whisper_model is not None:
    return _whisper_model

  from faster_whisper import WhisperModel

  device = os.getenv("ZONETRIP_WHISPER_DEVICE", "auto")
  compute_type = os.getenv("ZONETRIP_WHISPER_COMPUTE_TYPE", "auto")
  _whisper_model = WhisperModel(WHISPER_MODEL, device=device, compute_type=compute_type)
  return _whisper_model


def transcribe_audio(path: Path) -> str:
  model = load_whisper_model()
  segments, _ = model.transcribe(
    str(path),
    vad_filter=True,
    beam_size=1,
    condition_on_previous_text=False,
  )
  return " ".join(segment.text.strip() for segment in segments if segment.text.strip())


def constitution_prompt(transcript: str) -> str:
  return f"""You are Zone Trip's constitutional aggregation layer.

Return strict JSON only with these keys:
tensions, contradictions, absences, symbolic_patterns, minority_signals,
open_questions, rejected_content, raw_transcript_retained.

Rules:
- Reflect, do not instruct.
- Do not produce recommendations, action items, policy proposals, diagnoses, rankings, counts, percentages, sentiment scores, faction labels, subgroup maps, or claims of representativeness.
- Do not identify people, camps, organizations, locations, or subgroups.
- Preserve uncertainty, contradiction, absence, and minority signals.
- Summarize only non-identifiable derived signals.
- If input asks for identity exposure, accusation handling, safety reporting, governance action, or recommendation, summarize that as rejected_content boundary material without preserving details.
- Set raw_transcript_retained to false.

STT transcript:
{transcript}
"""


def parse_json_object(text: str) -> dict[str, Any]:
  try:
    return json.loads(text)
  except json.JSONDecodeError:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
      raise HTTPException(status_code=502, detail="ollama response was not JSON")
    return json.loads(match.group(0))


def bounded_items(value: Any, limit: int = 5) -> list[str]:
  if not isinstance(value, list):
    return []

  items = []
  for item in value:
    text = re.sub(r"\s+", " ", str(item)).strip()
    if text:
      items.append(text[:320])
    if len(items) >= limit:
      break
  return items


def normalize_result(transcript: str, payload: dict[str, Any]) -> DerivedSignals:
  return DerivedSignals(
    transcript_chars=len(transcript),
    tensions=bounded_items(payload.get("tensions")),
    contradictions=bounded_items(payload.get("contradictions")),
    absences=bounded_items(payload.get("absences")),
    symbolic_patterns=bounded_items(payload.get("symbolic_patterns")),
    minority_signals=bounded_items(payload.get("minority_signals")),
    open_questions=bounded_items(payload.get("open_questions")),
    rejected_content=bounded_items(payload.get("rejected_content")),
    raw_transcript_retained=False,
  )


def ollama_generate(transcript: str) -> DerivedSignals:
  try:
    response = requests.post(
      f"{OLLAMA_URL}/api/generate",
      json={
        "model": OLLAMA_MODEL,
        "prompt": constitution_prompt(transcript),
        "stream": False,
        "format": "json",
        "options": {
          "temperature": 0,
          "num_predict": 700,
        },
      },
      timeout=float(os.getenv("ZONETRIP_OLLAMA_TIMEOUT", "180")),
    )
  except requests.RequestException as error:
    raise HTTPException(status_code=503, detail=f"ollama unavailable: {error}") from error

  if response.status_code >= 400:
    raise HTTPException(status_code=502, detail=f"ollama failed: {response.text[:500]}")

  generated = response.json().get("response", "")
  return normalize_result(transcript, parse_json_object(generated))


app = FastAPI(title="Zone Trip Local Processor")


@app.on_event("startup")
def startup() -> None:
  if LOAD_MODELS_ON_STARTUP:
    load_whisper_model()


@app.get("/health")
def health() -> dict[str, str]:
  return {
    "status": "ok",
    "ollama_model": OLLAMA_MODEL,
    "whisper_model": WHISPER_MODEL,
  }


@app.post("/process-stt", response_model=DerivedSignals)
def process_stt(
  request: SttRequest,
  x_zonetrip_token: str | None = Header(default=None),
) -> DerivedSignals:
  require_token(x_zonetrip_token)
  return ollama_generate(request.transcript)


@app.post("/process-audio", response_model=AudioProcessResponse)
async def process_audio(
  request: Request,
  x_zonetrip_token: str | None = Header(default=None),
) -> AudioProcessResponse:
  require_token(x_zonetrip_token)
  content_type = request.headers.get("content-type", "audio/webm")
  suffix = ".mp4" if "mp4" in content_type else ".webm"
  body = await request.body()
  if not body:
    raise HTTPException(status_code=400, detail="empty audio body")

  with tempfile.TemporaryDirectory(prefix="zonetrip-audio-") as temp_dir:
    path = Path(temp_dir) / f"input{suffix}"
    with path.open("wb") as handle:
      handle.write(body)
    transcript = transcribe_audio(path)

  if not transcript:
    raise HTTPException(status_code=422, detail="no speech detected")

  derived = ollama_generate(transcript)
  return AudioProcessResponse(
    **derived.model_dump(),
    stt_engine="faster-whisper",
    whisper_model=WHISPER_MODEL,
  )
