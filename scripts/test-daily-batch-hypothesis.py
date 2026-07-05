#!/usr/bin/env python3
"""Compare incremental mirroring with end-of-day batch mirroring."""

from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "processor"))

import app  # noqa: E402


SIMULATE_PATH = ROOT / "scripts" / "simulate-community.py"
spec = importlib.util.spec_from_file_location("simulate_community", SIMULATE_PATH)
if spec is None or spec.loader is None:
  raise RuntimeError(f"could not load {SIMULATE_PATH}")
simulate_community = importlib.util.module_from_spec(spec)
sys.modules["simulate_community"] = simulate_community
spec.loader.exec_module(simulate_community)


COMMUNITY_FIXTURE_DIR = ROOT / "simulations" / "community-fixtures"
DAILY_FIXTURE = ROOT / "simulations" / "daily-batch-fixtures" / "one-day-community.json"
DEFAULT_REPORT = ROOT / "simulations" / "reports" / "daily-batch-hypothesis.md"


@dataclass
class MirrorMetrics:
  label: str
  bullet_count: int
  coverage_hits: list[str]
  integration_hits: list[str]
  charter_failures: list[str]
  score: float
  model_markdown: str


def load_json(path: Path) -> dict[str, Any]:
  with path.open(encoding="utf-8") as handle:
    return json.load(handle)


def normalize(text: str) -> str:
  return re.sub(r"\s+", " ", text.lower()).strip()


def section_bullets(model_markdown: str) -> dict[str, list[str]]:
  sections: dict[str, list[str]] = {heading: [] for heading in simulate_community.SECTION_HEADINGS}
  current = ""
  for line in model_markdown.splitlines():
    stripped = line.strip()
    if stripped.startswith("## "):
      current = stripped[3:]
      continue
    if current in sections and stripped.startswith("- ") and stripped != "- None surfaced":
      sections[current].append(stripped[2:])
  return sections


def render_model_from_sections(sections: dict[str, list[str]]) -> str:
  lines = ["# Zone Trip World Model", ""]
  for heading in simulate_community.SECTION_HEADINGS:
    lines.append(f"## {heading}")
    lines.append("")
    items = sections.get(heading, [])
    if items:
      for item in items:
        lines.append(f"- {item}")
    else:
      lines.append("- None surfaced")
    lines.append("")
  return "\n".join(lines).rstrip() + "\n"


def incremental_model(fixtures: list[dict[str, Any]]) -> str:
  merged = {heading: [] for heading in simulate_community.SECTION_HEADINGS}
  for fixture in fixtures:
    result = app.normalize_result(fixture["temporary_input"], fixture["simulated_payload"])
    sections = section_bullets(result.model_markdown)
    for heading, items in sections.items():
      for item in items:
        if item not in merged[heading]:
          merged[heading].append(item)
  return render_model_from_sections(merged)


def daily_model(daily_fixture: dict[str, Any], fixtures: list[dict[str, Any]]) -> str:
  transcript = "\n".join(fixture["temporary_input"] for fixture in fixtures)
  result = app.normalize_result(transcript, daily_fixture["daily_payload"])
  return result.model_markdown


def concept_hits(model_markdown: str, concepts: list[str]) -> list[str]:
  lowered = normalize(model_markdown)
  return [concept for concept in concepts if normalize(concept) in lowered]


def score_model(
  label: str,
  model_markdown: str,
  coverage_concepts: list[str],
  integration_concepts: list[str],
) -> MirrorMetrics:
  bullets = sum(len(items) for items in section_bullets(model_markdown).values())
  coverage = concept_hits(model_markdown, coverage_concepts)
  integration = concept_hits(model_markdown, integration_concepts)
  charter_failures = simulate_community.assert_charter_boundaries(model_markdown)
  density = len(coverage) / max(bullets, 1)
  score = (len(coverage) * 2.0) + (len(integration) * 3.0) + (density * 5.0)
  score -= len(charter_failures) * 10.0
  return MirrorMetrics(
    label=label,
    bullet_count=bullets,
    coverage_hits=coverage,
    integration_hits=integration,
    charter_failures=charter_failures,
    score=round(score, 2),
    model_markdown=model_markdown,
  )


def render_report(daily_fixture: dict[str, Any], incremental: MirrorMetrics, daily: MirrorMetrics) -> str:
  delta = round(daily.score - incremental.score, 2)
  conclusion = (
    "supported"
    if daily.score > incremental.score and not daily.charter_failures
    else "not supported"
  )
  lines = [
    "# Daily Batch Mirroring Hypothesis",
    "",
    f"Hypothesis: {daily_fixture['hypothesis']}",
    "",
    "This is a deterministic simulation, not proof from a live LLM. It compares",
    "two mirror strategies over the same synthetic day:",
    "",
    "- Incremental: normalize each utterance-level update, then merge the resulting model sections.",
    "- End-of-day batch: reason once over the day's temporary inputs and emit one integrated durable model.",
    "",
    "## Result",
    "",
    f"- Hypothesis: {conclusion}",
    f"- Incremental score: {incremental.score}",
    f"- End-of-day score: {daily.score}",
    f"- Delta: {delta}",
    "",
    "## Metrics",
    "",
    "| Strategy | Bullets | Coverage | Integration | Charter failures | Score |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    f"| Incremental | {incremental.bullet_count} | {len(incremental.coverage_hits)} | {len(incremental.integration_hits)} | {len(incremental.charter_failures)} | {incremental.score} |",
    f"| End-of-day batch | {daily.bullet_count} | {len(daily.coverage_hits)} | {len(daily.integration_hits)} | {len(daily.charter_failures)} | {daily.score} |",
    "",
    "## Interpretation",
    "",
  ]

  if conclusion == "supported":
    lines.extend(
      [
        "The end-of-day model preserved the same charter boundaries while producing",
        "a denser and more integrated mirror. The incremental model retained more",
        "separate artifacts of individual turns, which increases fragmentation even",
        "when no raw transcript is retained.",
      ]
    )
  else:
    lines.extend(
      [
        "This run does not support switching to end-of-day-only reasoning. Either",
        "the batch model failed a charter boundary or did not improve integration",
        "enough to justify losing turn-level updates.",
      ]
    )

  lines.extend(
    [
      "",
      "## Incremental Model",
      "",
      "```markdown",
      incremental.model_markdown.rstrip(),
      "```",
      "",
      "## End-of-Day Batch Model",
      "",
      "```markdown",
      daily.model_markdown.rstrip(),
      "```",
      "",
      "## Caveat",
      "",
      "The next test should run both prompts through the same live local model with",
      "fixed temperature and compare multiple synthetic days. This deterministic",
      "test is useful because it isolates the evaluation contract and makes the",
      "hypothesis measurable before spending GPU time.",
    ]
  )
  return "\n".join(lines).rstrip() + "\n"


def main() -> int:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--daily-fixture", type=Path, default=DAILY_FIXTURE)
  parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
  parser.add_argument("--no-write", action="store_true")
  args = parser.parse_args()

  daily_fixture = load_json(args.daily_fixture)
  fixtures_by_id = {
    fixture["id"]: fixture
    for fixture in (load_json(path) for path in sorted(COMMUNITY_FIXTURE_DIR.glob("*.json")))
  }
  fixtures = [fixtures_by_id[fixture_id] for fixture_id in daily_fixture["fixture_ids"]]
  incremental_markdown = incremental_model(fixtures)
  daily_markdown = daily_model(daily_fixture, fixtures)
  coverage = daily_fixture["coverage_concepts"]
  integration = daily_fixture["integration_concepts"]

  incremental_metrics = score_model("Incremental", incremental_markdown, coverage, integration)
  daily_metrics = score_model("End-of-day batch", daily_markdown, coverage, integration)
  report = render_report(daily_fixture, incremental_metrics, daily_metrics)

  if args.no_write:
    print(report)
  else:
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(report, encoding="utf-8")
    print(f"wrote {args.report}")

  if daily_metrics.score <= incremental_metrics.score or daily_metrics.charter_failures:
    print("daily-batch-hypothesis-not-supported", file=sys.stderr)
    return 1

  print(
    "daily-batch-hypothesis-supported: "
    f"{incremental_metrics.score} -> {daily_metrics.score}"
  )
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
