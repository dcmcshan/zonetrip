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
OLLAMA_MODEL = os.getenv("ZONETRIP_OLLAMA_MODEL", "gemma3:12b")
WHISPER_MODEL = os.getenv("ZONETRIP_WHISPER_MODEL", "base")
PROCESSOR_TOKEN = os.getenv("ZONETRIP_PROCESSOR_TOKEN", "")
ENABLE_DEV_STT = os.getenv("ZONETRIP_ENABLE_DEV_STT", "0") == "1"
DAILY_BATCH_MODE = os.getenv("ZONETRIP_DAILY_BATCH_MODE", "0") == "1"
LOAD_MODELS_ON_STARTUP = os.getenv("ZONETRIP_PRELOAD_MODELS", "0") == "1"
MODEL_PATH = Path(os.getenv("ZONETRIP_MODEL_PATH", "model.md"))
DAY_NOTES_PATH = Path(os.getenv("ZONETRIP_DAY_NOTES_PATH", str(MODEL_PATH.parent / "day-notes.jsonl")))
CHARTER_PATH = Path(os.getenv("ZONETRIP_CHARTER_PATH", "charter.md"))
MODEL_MARKDOWN_LIMIT = int(os.getenv("ZONETRIP_MODEL_MARKDOWN_LIMIT", "16000"))
CHARTER_MARKDOWN_LIMIT = int(os.getenv("ZONETRIP_CHARTER_MARKDOWN_LIMIT", "12000"))
DAY_NOTES_MARKDOWN_LIMIT = int(os.getenv("ZONETRIP_DAY_NOTES_MARKDOWN_LIMIT", "48000"))

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
  model_markdown: str


class AudioProcessResponse(DerivedSignals):
  stt_engine: str
  whisper_model: str


class SegmentNotes(BaseModel):
  transcript_chars: int
  tensions: list[str]
  contradictions: list[str]
  absences: list[str]
  symbolic_patterns: list[str]
  minority_signals: list[str]
  open_questions: list[str]
  rejected_content: list[str]
  raw_transcript_retained: bool = False


class FinalizeDayResponse(DerivedSignals):
  segment_count: int
  day_notes_cleared: bool


def require_token(token: str | None) -> None:
  if PROCESSOR_TOKEN and token != PROCESSOR_TOKEN:
    raise HTTPException(status_code=401, detail="invalid processor token")


def audio_suffix(content_type: str) -> str:
  normalized = content_type.lower()
  if "mp4" in normalized or "m4a" in normalized:
    return ".mp4"
  if "wav" in normalized or "wave" in normalized or "x-wav" in normalized:
    return ".wav"
  if "mpeg" in normalized or "mp3" in normalized:
    return ".mp3"
  if "ogg" in normalized:
    return ".ogg"
  return ".webm"


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


def initial_model_markdown() -> str:
  return """# Zone Trip World Model

This file is the durable derived state of the booth.

It must not contain raw transcript, participant identity, faction labels, rankings, counts, recommendations, or claims of representativeness.

## Tensions

- None surfaced

## Contradictions

- None surfaced

## Absences

- None surfaced

## Symbolic Patterns

- None surfaced

## Minority Signals

- None surfaced

## Open Questions

- None surfaced

## Rejected Boundary Material

- None surfaced
"""


def default_charter_markdown() -> str:
  return """# Zone Trip Charter

Zone Trip is a non-directive local AI mirror for community self-understanding.

The booth receives speech as ephemeral microphone input. It may use temporary speech-to-text internally, but the transcript is not a durable artifact and is not returned to the participant-facing surface.

The durable artifact is model.md: a derived world model. It may preserve tensions, contradictions, absences, symbolic patterns, minority signals, open questions, and rejected boundary material.

The durable model must not preserve raw transcript, participant identity, faction labels, subgroup maps, rankings, counts, percentages, sentiment scores, recommendations, policy proposals, diagnoses, mandates, safety reports, or claims of representativeness.

Reflect, do not instruct. Preserve uncertainty, contradiction, absence, and minority signals without naming or mapping factions. Never quote participant speech in the durable model.
"""


def read_charter_markdown() -> str:
  try:
    text = CHARTER_PATH.read_text(encoding="utf-8")
  except FileNotFoundError:
    return default_charter_markdown()

  text = text.strip()
  if not text:
    return default_charter_markdown()
  return text[:CHARTER_MARKDOWN_LIMIT]


def read_model_markdown() -> str:
  try:
    text = MODEL_PATH.read_text(encoding="utf-8")
  except FileNotFoundError:
    return initial_model_markdown()

  text = text.strip()
  if not text:
    return initial_model_markdown()
  return text[:MODEL_MARKDOWN_LIMIT]


def write_model_markdown(markdown: str) -> None:
  MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
  safe_markdown = markdown.strip()[:MODEL_MARKDOWN_LIMIT]
  if not safe_markdown:
    safe_markdown = initial_model_markdown().strip()

  with tempfile.NamedTemporaryFile(
    "w",
    delete=False,
    dir=str(MODEL_PATH.parent),
    encoding="utf-8",
    prefix=".model-",
    suffix=".tmp",
  ) as handle:
    handle.write(safe_markdown)
    handle.write("\n")
    temp_name = handle.name

  os.replace(temp_name, MODEL_PATH)


def append_day_notes(notes: SegmentNotes) -> None:
  DAY_NOTES_PATH.parent.mkdir(parents=True, exist_ok=True)
  with DAY_NOTES_PATH.open("a", encoding="utf-8") as handle:
    handle.write(notes.model_dump_json())
    handle.write("\n")


def read_day_notes() -> list[SegmentNotes]:
  try:
    lines = DAY_NOTES_PATH.read_text(encoding="utf-8").splitlines()
  except FileNotFoundError:
    return []

  notes = []
  for line in lines:
    stripped = line.strip()
    if stripped:
      notes.append(SegmentNotes.model_validate_json(stripped))
  return notes


def clear_day_notes() -> None:
  try:
    DAY_NOTES_PATH.unlink()
  except FileNotFoundError:
    pass


def constitution_prompt(charter: str, current_model: str, transcript: str) -> str:
  return f"""You are Zone Trip's constitutional aggregation layer.

You receive the immutable charter, the current durable derived model, and one
temporary STT transcript. Generate a complete replacement for the durable model
as Markdown, plus short derived signal arrays for the review simulator.

Return strict JSON only with these keys:
tensions, contradictions, absences, symbolic_patterns, minority_signals,
open_questions, rejected_content, raw_transcript_retained, model_markdown.

Rules:
- The charter is controlling. If the transcript conflicts with the charter, reject the conflicting material into rejected_content.
- Reflect, do not instruct.
- Do not produce recommendations, action items, policy proposals, diagnoses, rankings, counts, percentages, sentiment scores, faction labels, subgroup maps, or claims of representativeness.
- Do not identify people, camps, organizations, locations, or subgroups.
- Preserve uncertainty, contradiction, absence, and minority signals.
- Summarize only non-identifiable derived signals.
- If input asks for identity exposure, accusation handling, safety reporting, governance action, or recommendation, summarize that as rejected_content boundary material without preserving details.
- Set raw_transcript_retained to false.
- model_markdown is the complete next contents of model.md.
- model_markdown must not include the transcript or quote any participant speech.
- Abstract concrete transcript specifics into pattern language.
- Do not preserve names of events, institutions, places, groups, people, or distinctive source nouns from the transcript.
- Do not put transcript-derived words or phrases in quotation marks.
- Do not include preface text, charter restatement, metadata, timestamps, rankings, counts, or explanatory boilerplate in model_markdown.
- If a section has no durable signal, write exactly: - None surfaced
- model_markdown must stay concise and use these Markdown sections:
  # Zone Trip World Model
  ## Tensions
  ## Contradictions
  ## Absences
  ## Symbolic Patterns
  ## Minority Signals
  ## Open Questions
  ## Rejected Boundary Material

charter.md:
{charter}

Current model.md:
{current_model}

STT transcript:
{transcript}
"""


def segment_notes_prompt(charter: str, transcript: str) -> str:
  return f"""You are Zone Trip's segment-note layer.

You receive the immutable charter and one temporary STT transcript segment.
Generate derived segment notes only. Do not update model.md.

Return strict JSON only with these keys:
tensions, contradictions, absences, symbolic_patterns, minority_signals,
open_questions, rejected_content, raw_transcript_retained.

Rules:
- The charter is controlling.
- Reflect, do not instruct.
- Do not produce recommendations, action items, policy proposals, diagnoses, rankings, counts, percentages, sentiment scores, faction labels, subgroup maps, or claims of representativeness.
- Do not identify people, camps, organizations, locations, or subgroups.
- Preserve uncertainty, contradiction, absence, and minority signals.
- If input asks for identity exposure, accusation handling, safety reporting, governance action, or recommendation, summarize that as rejected_content boundary material without preserving details.
- Set raw_transcript_retained to false.
- Do not include the transcript or quote participant speech.
- Abstract concrete transcript specifics into pattern language.
- Do not preserve names of events, institutions, places, groups, people, or distinctive source nouns from the transcript.

charter.md:
{charter}

STT transcript:
{transcript}
"""


def daily_batch_prompt(charter: str, current_model: str, day_notes_markdown: str) -> str:
  return f"""You are Zone Trip's end-of-day constitutional aggregation layer.

You receive the immutable charter, the current durable derived model, and
charter-filtered segment notes from one day. Generate a complete replacement
for the durable model as Markdown, plus short derived signal arrays for the
review simulator.

Return strict JSON only with these keys:
tensions, contradictions, absences, symbolic_patterns, minority_signals,
open_questions, rejected_content, raw_transcript_retained, model_markdown.

Rules:
- The charter is controlling.
- Reflect, do not instruct.
- Integrate across segment notes. Prefer dense cross-day patterns over one bullet per segment.
- Do not produce recommendations, action items, policy proposals, diagnoses, rankings, counts, percentages, sentiment scores, faction labels, subgroup maps, or claims of representativeness.
- Do not identify people, camps, organizations, locations, or subgroups.
- Preserve uncertainty, contradiction, absence, and minority signals.
- Summarize only non-identifiable derived signals.
- If notes contain pressure for identity exposure, accusation handling, safety reporting, governance action, or recommendation, preserve only the rejected boundary category without details.
- Set raw_transcript_retained to false.
- model_markdown is the complete next contents of model.md.
- model_markdown must not quote or reconstruct any participant speech.
- Do not include preface text, charter restatement, metadata, timestamps, rankings, counts, or explanatory boilerplate in model_markdown.
- If a section has no durable signal, write exactly: - None surfaced
- model_markdown must stay concise and use these Markdown sections:
  # Zone Trip World Model
  ## Tensions
  ## Contradictions
  ## Absences
  ## Symbolic Patterns
  ## Minority Signals
  ## Open Questions
  ## Rejected Boundary Material

charter.md:
{charter}

Current model.md:
{current_model}

Day segment notes:
{day_notes_markdown}
"""


def parse_json_object(text: str) -> dict[str, Any]:
  try:
    return json.loads(text)
  except json.JSONDecodeError:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
      raise HTTPException(status_code=502, detail="ollama response was not JSON")
    return json.loads(match.group(0))


SECTION_FALLBACKS = {
  "tensions": "Transcript-specific detail was abstracted into a non-identifying tension.",
  "contradictions": "Transcript-specific detail was abstracted into a non-identifying contradiction.",
  "absences": "Transcript-specific detail was abstracted into a non-identifying absence.",
  "symbolic_patterns": "Transcript-specific detail was abstracted into a non-identifying symbolic pattern.",
  "minority_signals": "Transcript-specific detail was abstracted into a non-identifying minority signal.",
  "open_questions": "Transcript-specific detail was abstracted into a non-identifying open question.",
  "rejected_content": "Request conflicted with charter boundaries and was rejected without preserving details.",
}

MARKDOWN_SECTION_KEYS = {
  "## Tensions": "tensions",
  "## Contradictions": "contradictions",
  "## Absences": "absences",
  "## Symbolic Patterns": "symbolic_patterns",
  "## Minority Signals": "minority_signals",
  "## Open Questions": "open_questions",
  "## Rejected Boundary Material": "rejected_content",
}

SUBGROUP_ROOTS = {
  "young",
  "old",
  "elder",
  "student",
  "worker",
  "owner",
  "renter",
  "newcomer",
  "local",
  "outsider",
  "resident",
  "family",
  "immigrant",
}


def normalized_words(text: str) -> list[str]:
  return re.findall(r"[a-z0-9]+", text.lower())


def contains_shared_subgroup_term(text_words: list[str], transcript_words: list[str]) -> bool:
  for root in SUBGROUP_ROOTS:
    if any(word.startswith(root) for word in text_words) and any(
      word.startswith(root) for word in transcript_words
    ):
      return True
  return False


def looks_like_transcript_copy(text: str, transcript: str) -> bool:
  normalized_text = re.sub(r"\s+", " ", text.lower()).strip()
  normalized_transcript = re.sub(r"\s+", " ", transcript.lower()).strip()
  if len(normalized_text) >= 24 and normalized_text in normalized_transcript:
    return True

  text_words = normalized_words(text)
  transcript_word_list = normalized_words(transcript)
  if contains_shared_subgroup_term(text_words, transcript_word_list):
    return True

  if len(text_words) < 6:
    return False

  transcript_words = set(transcript_word_list)
  if not transcript_words:
    return False

  overlap = sum(1 for word in text_words if word in transcript_words)
  return overlap / len(text_words) >= 0.72


def scrub_transcript_copy(text: str, transcript: str, key: str) -> str:
  cleaned = re.sub(r"\s+", " ", str(text)).strip()
  cleaned = re.sub(r"[\"'`]", "", cleaned)
  if looks_like_transcript_copy(cleaned, transcript):
    return SECTION_FALLBACKS.get(key, "Transcript-specific detail was abstracted.")
  return cleaned


def bounded_items(value: Any, limit: int = 5, transcript: str = "", key: str = "") -> list[str]:
  if not isinstance(value, list):
    return []

  items = []
  for item in value:
    text = scrub_transcript_copy(str(item), transcript, key)
    if text:
      items.append(text[:320])
    if len(items) >= limit:
      break
  return items


def fallback_model_markdown(payload: dict[str, Any], transcript: str) -> str:
  def section(title: str, key: str) -> str:
    items = bounded_items(payload.get(key), transcript=transcript, key=key)
    if not items:
      items = ["None surfaced"]
    return f"## {title}\n\n" + "\n".join(f"- {item}" for item in items)

  sections = [
    "# Zone Trip World Model",
    "",
    section("Tensions", "tensions"),
    "",
    section("Contradictions", "contradictions"),
    "",
    section("Absences", "absences"),
    "",
    section("Symbolic Patterns", "symbolic_patterns"),
    "",
    section("Minority Signals", "minority_signals"),
    "",
    section("Open Questions", "open_questions"),
    "",
    section("Rejected Boundary Material", "rejected_content"),
  ]
  return "\n".join(sections)


def bounded_markdown(value: Any, payload: dict[str, Any], transcript: str) -> str:
  text = re.sub(r"\n{3,}", "\n\n", str(value or "")).strip()
  if not text:
    text = fallback_model_markdown(payload, transcript)
  text = text.replace("\\n", "\n").replace("\\t", "  ")
  text = re.sub(r"##\s+Abs,?ences", "## Absences", text, flags=re.IGNORECASE)
  text = re.sub(r"##\s+Symbol,?ic\s+Patterns", "## Symbolic Patterns", text, flags=re.IGNORECASE)
  text = re.sub(r"[\"'`]", "", text)
  section_key = ""
  scrubbed_lines = []
  for line in text.splitlines():
    stripped = line.strip()
    if stripped in MARKDOWN_SECTION_KEYS:
      section_key = MARKDOWN_SECTION_KEYS[stripped]
      scrubbed_lines.append(line)
      continue
    if stripped.startswith("- "):
      prefix = line[: len(line) - len(line.lstrip())]
      item = stripped[2:].strip()
      item = scrub_transcript_copy(item, transcript, section_key)
      scrubbed_lines.append(f"{prefix}- {item}")
      continue
    if section_key and stripped:
      prefix = line[: len(line) - len(line.lstrip())]
      scrubbed_lines.append(f"{prefix}{scrub_transcript_copy(stripped, transcript, section_key)}")
      continue
    scrubbed_lines.append(line)
  text = "\n".join(scrubbed_lines)
  text = re.sub(r"\n{3,}", "\n\n", text).strip()
  return text[:MODEL_MARKDOWN_LIMIT]


def normalize_result(transcript: str, payload: dict[str, Any]) -> DerivedSignals:
  return DerivedSignals(
    transcript_chars=len(transcript),
    tensions=bounded_items(payload.get("tensions"), transcript=transcript, key="tensions"),
    contradictions=bounded_items(payload.get("contradictions"), transcript=transcript, key="contradictions"),
    absences=bounded_items(payload.get("absences"), transcript=transcript, key="absences"),
    symbolic_patterns=bounded_items(payload.get("symbolic_patterns"), transcript=transcript, key="symbolic_patterns"),
    minority_signals=bounded_items(payload.get("minority_signals"), transcript=transcript, key="minority_signals"),
    open_questions=bounded_items(payload.get("open_questions"), transcript=transcript, key="open_questions"),
    rejected_content=bounded_items(payload.get("rejected_content"), transcript=transcript, key="rejected_content"),
    raw_transcript_retained=False,
    model_markdown=bounded_markdown(payload.get("model_markdown"), payload, transcript),
  )


def normalize_segment_notes(transcript: str, payload: dict[str, Any]) -> SegmentNotes:
  return SegmentNotes(
    transcript_chars=len(transcript),
    tensions=bounded_items(payload.get("tensions"), transcript=transcript, key="tensions"),
    contradictions=bounded_items(payload.get("contradictions"), transcript=transcript, key="contradictions"),
    absences=bounded_items(payload.get("absences"), transcript=transcript, key="absences"),
    symbolic_patterns=bounded_items(payload.get("symbolic_patterns"), transcript=transcript, key="symbolic_patterns"),
    minority_signals=bounded_items(payload.get("minority_signals"), transcript=transcript, key="minority_signals"),
    open_questions=bounded_items(payload.get("open_questions"), transcript=transcript, key="open_questions"),
    rejected_content=bounded_items(payload.get("rejected_content"), transcript=transcript, key="rejected_content"),
    raw_transcript_retained=False,
  )


def ollama_json(prompt: str, num_predict: int = 700) -> dict[str, Any]:
  try:
    response = requests.post(
      f"{OLLAMA_URL}/api/generate",
      json={
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {
          "temperature": 0,
          "num_predict": num_predict,
        },
      },
      timeout=float(os.getenv("ZONETRIP_OLLAMA_TIMEOUT", "180")),
    )
  except requests.RequestException as error:
    raise HTTPException(status_code=503, detail=f"ollama unavailable: {error}") from error

  if response.status_code >= 400:
    raise HTTPException(status_code=502, detail=f"ollama failed: {response.text[:500]}")

  generated = response.json().get("response", "")
  return parse_json_object(generated)


def ollama_generate(transcript: str) -> DerivedSignals:
  charter = read_charter_markdown()
  current_model = read_model_markdown()
  payload = ollama_json(constitution_prompt(charter, current_model, transcript))
  result = normalize_result(transcript, payload)
  write_model_markdown(result.model_markdown)
  return result


def ollama_segment_notes(transcript: str) -> SegmentNotes:
  charter = read_charter_markdown()
  payload = ollama_json(segment_notes_prompt(charter, transcript), num_predict=500)
  return normalize_segment_notes(transcript, payload)


def notes_to_markdown(notes: list[SegmentNotes]) -> str:
  lines = []
  for index, note in enumerate(notes, start=1):
    lines.append(f"## Segment {index}")
    for label, values in [
      ("Tensions", note.tensions),
      ("Contradictions", note.contradictions),
      ("Absences", note.absences),
      ("Symbolic Patterns", note.symbolic_patterns),
      ("Minority Signals", note.minority_signals),
      ("Open Questions", note.open_questions),
      ("Rejected Boundary Material", note.rejected_content),
    ]:
      if values:
        lines.append(f"### {label}")
        lines.extend(f"- {value}" for value in values)
    lines.append("")
  text = "\n".join(lines).strip()
  return text[:DAY_NOTES_MARKDOWN_LIMIT]


def daily_batch_generate(notes: list[SegmentNotes]) -> DerivedSignals:
  if not notes:
    raise HTTPException(status_code=422, detail="no day notes to finalize")

  charter = read_charter_markdown()
  current_model = read_model_markdown()
  day_notes_markdown = notes_to_markdown(notes)
  payload = ollama_json(
    daily_batch_prompt(charter, current_model, day_notes_markdown),
    num_predict=900,
  )
  result = normalize_result("", payload)
  write_model_markdown(result.model_markdown)
  return result


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
    "model_path": str(MODEL_PATH),
    "charter_path": str(CHARTER_PATH),
    "dev_stt": "enabled" if ENABLE_DEV_STT else "disabled",
    "daily_batch_mode": "enabled" if DAILY_BATCH_MODE else "disabled",
    "day_notes_path": str(DAY_NOTES_PATH),
  }


@app.post("/process-stt", response_model=DerivedSignals)
def process_stt(
  request: SttRequest,
  x_zonetrip_token: str | None = Header(default=None),
) -> DerivedSignals:
  require_token(x_zonetrip_token)
  if not ENABLE_DEV_STT:
    raise HTTPException(status_code=404, detail="development STT input is disabled")
  if DAILY_BATCH_MODE:
    notes = ollama_segment_notes(request.transcript)
    append_day_notes(notes)
    return DerivedSignals(
      **notes.model_dump(),
      model_markdown=read_model_markdown(),
    )
  return ollama_generate(request.transcript)


@app.post("/finalize-day", response_model=FinalizeDayResponse)
def finalize_day(
  x_zonetrip_token: str | None = Header(default=None),
) -> FinalizeDayResponse:
  require_token(x_zonetrip_token)
  notes = read_day_notes()
  result = daily_batch_generate(notes)
  clear_day_notes()
  return FinalizeDayResponse(
    **result.model_dump(),
    segment_count=len(notes),
    day_notes_cleared=True,
  )


@app.post("/process-audio", response_model=AudioProcessResponse)
async def process_audio(
  request: Request,
  x_zonetrip_token: str | None = Header(default=None),
) -> AudioProcessResponse:
  require_token(x_zonetrip_token)
  content_type = request.headers.get("content-type", "audio/webm")
  suffix = audio_suffix(content_type)
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

  if DAILY_BATCH_MODE:
    notes = ollama_segment_notes(transcript)
    append_day_notes(notes)
    return AudioProcessResponse(
      **DerivedSignals(
        **notes.model_dump(),
        model_markdown=read_model_markdown(),
      ).model_dump(),
      stt_engine="faster-whisper",
      whisper_model=WHISPER_MODEL,
    )

  derived = ollama_generate(transcript)
  return AudioProcessResponse(
    **derived.model_dump(),
    stt_engine="faster-whisper",
    whisper_model=WHISPER_MODEL,
  )
