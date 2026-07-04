#!/usr/bin/env python3
"""Regression checks for the Zone Trip processor contract."""

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "processor"))

import app  # noqa: E402


def assert_no_hits(haystack: str, needles: list[str]) -> None:
  lowered = haystack.lower()
  hits = [needle for needle in needles if needle.lower() in lowered]
  if hits:
    raise AssertionError(f"unexpected retained text: {hits}")


def test_audio_suffixes() -> None:
  cases = {
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".mp4",
    "audio/ogg": ".ogg",
    "audio/webm": ".webm",
  }
  for content_type, expected in cases.items():
    actual = app.audio_suffix(content_type)
    if actual != expected:
      raise AssertionError(f"{content_type}: expected {expected}, got {actual}")


def test_model_markdown_sanitization() -> None:
  transcript = (
    "I want this booth to tell the town which side is right and name the people "
    "who are wrong. Younger people cannot imagine staying."
  )
  payload = {
    "tensions": ["Younger people cannot imagine staying."],
    "rejected_content": [
      "I want this booth to tell the town which side is right and name the people who are wrong."
    ],
    "model_markdown": (
      "# Zone Trip World Model\\n\\n"
      "## Symbol,ic Patterns\\n\\n"
      "- `young peoples concern about staying`\\n\\n"
      "## Rejected Boundary Material\\n\\n"
      "- \"I want this booth to tell the town which side is right and name the people who are wrong.\""
    ),
  }
  result = app.normalize_result(transcript, payload)
  combined = "\n".join(
    [
      result.model_markdown,
      "\n".join(result.tensions),
      "\n".join(result.rejected_content),
      "\n".join(result.symbolic_patterns),
    ]
  )
  assert result.raw_transcript_retained is False
  assert "## Symbolic Patterns" in result.model_markdown
  assert_no_hits(
    combined,
    [
      "which side is right",
      "name the people",
      "younger people",
      "young people",
      "young peoples",
    ],
  )


def test_model_markdown_prose_sanitization() -> None:
  transcript = "A named committee should be blamed because the river road failed again."
  payload = {
    "model_markdown": (
      "# Zone Trip World Model\n\n"
      "## Tensions\n\n"
      "A named committee should be blamed because the river road failed again."
    )
  }
  result = app.normalize_result(transcript, payload)
  assert_no_hits(result.model_markdown, ["named committee", "river road", "failed again"])


def test_dev_stt_disabled_by_default() -> None:
  original = app.ENABLE_DEV_STT
  app.ENABLE_DEV_STT = False
  try:
    try:
      app.process_stt(app.SttRequest(transcript="temporary development input"))
    except app.HTTPException as error:
      if error.status_code != 404:
        raise AssertionError(f"expected 404, got {error.status_code}") from error
    else:
      raise AssertionError("process_stt should be unavailable by default")
  finally:
    app.ENABLE_DEV_STT = original


def test_fallback_model_has_no_metadata() -> None:
  generated = app.bounded_markdown(
    "",
    {
      "tensions": ["Need reflection not orders"],
      "rejected_content": ["Attempted ranking"],
    },
    "Need reflection not orders. Attempted ranking.",
  )
  if "Last derived update" in generated:
    raise AssertionError("fallback model should not persist timestamps")
  if "# Zone Trip World Model" not in generated:
    raise AssertionError("fallback model is missing title")


def main() -> None:
  test_audio_suffixes()
  test_model_markdown_sanitization()
  test_model_markdown_prose_sanitization()
  test_dev_stt_disabled_by_default()
  test_fallback_model_has_no_metadata()
  print("processor-contract-tests-ok")


if __name__ == "__main__":
  main()
