#!/usr/bin/env python3
"""Run synthetic community fixtures through the Zone Trip mirror contract."""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "processor"))

import app  # noqa: E402


FIXTURE_DIR = ROOT / "simulations" / "community-fixtures"
DEFAULT_REPORT = ROOT / "simulations" / "reports" / "community-evaluation.md"

SECTION_HEADINGS = [
  "Tensions",
  "Contradictions",
  "Absences",
  "Symbolic Patterns",
  "Minority Signals",
  "Open Questions",
  "Rejected Boundary Material",
]

FORBIDDEN_PATTERNS = {
  "quotes": re.compile(r"[\"'`]"),
  "rankings": re.compile(r"\b(top|rank|priority|priorities|first|second|third)\b", re.IGNORECASE),
  "counts": re.compile(r"\b\d+|percent|percentage|majority|minority of|most residents|most people\b", re.IGNORECASE),
  "recommendations": re.compile(r"\b(should|must|recommend|recommendation|policy|proposal|mandate|diagnose)\b", re.IGNORECASE),
  "identity_exposure": re.compile(r"\b(name|named|identify|responsible parties|which side|who is wrong)\b", re.IGNORECASE),
}


@dataclass
class FixtureResult:
  fixture_id: str
  title: str
  passed: bool
  failures: list[str]
  warnings: list[str]
  model_markdown: str
  notes: str


def load_fixture(path: Path) -> dict[str, Any]:
  with path.open(encoding="utf-8") as handle:
    return json.load(handle)


def normalized(text: str) -> str:
  return re.sub(r"\s+", " ", text.lower()).strip()


def assert_no_forbidden_terms(model_markdown: str, terms: list[str]) -> list[str]:
  lowered = normalized(model_markdown)
  hits = [term for term in terms if normalized(term) and normalized(term) in lowered]
  return [f"retained forbidden fixture term: {term}" for term in hits]


def assert_required_terms(model_markdown: str, terms: list[str]) -> list[str]:
  lowered = normalized(model_markdown)
  misses = [term for term in terms if normalized(term) not in lowered]
  return [f"missing expected derived concept: {term}" for term in misses]


def assert_sections(model_markdown: str, expected_sections: list[str]) -> list[str]:
  failures = []
  for heading in SECTION_HEADINGS:
    if f"## {heading}" not in model_markdown:
      failures.append(f"missing required model section: {heading}")
  for heading in expected_sections:
    marker = f"## {heading}"
    if marker not in model_markdown:
      failures.append(f"missing expected fixture section: {heading}")
      continue
    section_body = model_markdown.split(marker, 1)[1]
    next_heading = re.search(r"\n##\s+", section_body)
    if next_heading:
      section_body = section_body[: next_heading.start()]
    if "- None surfaced" in section_body:
      failures.append(f"expected section was empty: {heading}")
  return failures


def assert_charter_boundaries(model_markdown: str) -> list[str]:
  failures = []
  for name, pattern in FORBIDDEN_PATTERNS.items():
    hits = sorted(set(match.group(0) for match in pattern.finditer(model_markdown)))
    if hits:
      failures.append(f"charter boundary hit ({name}): {', '.join(hits[:6])}")
  if "raw transcript" in model_markdown.lower():
    failures.append("model discusses raw transcript retention")
  return failures


def evaluate_fixture(fixture: dict[str, Any]) -> FixtureResult:
  transcript = fixture["temporary_input"]
  payload = fixture["simulated_payload"]
  result = app.normalize_result(transcript, payload)
  model_markdown = result.model_markdown

  failures = []
  warnings = []
  failures.extend(assert_sections(model_markdown, fixture.get("expected_sections", [])))
  failures.extend(assert_required_terms(model_markdown, fixture.get("must_include", [])))
  failures.extend(assert_no_forbidden_terms(model_markdown, fixture.get("must_not_include", [])))
  failures.extend(assert_charter_boundaries(model_markdown))

  if result.raw_transcript_retained:
    failures.append("raw_transcript_retained was true")
  if len(model_markdown) > app.MODEL_MARKDOWN_LIMIT:
    failures.append("model markdown exceeded configured limit")
  if model_markdown.count("# Zone Trip World Model") != 1:
    failures.append("model has duplicate or missing title")
  if "None surfaced" not in model_markdown and len(model_markdown) < 200:
    warnings.append("model update is unusually short")

  return FixtureResult(
    fixture_id=fixture["id"],
    title=fixture["title"],
    passed=not failures,
    failures=failures,
    warnings=warnings,
    model_markdown=model_markdown,
    notes=fixture.get("notes", ""),
  )


def render_report(results: list[FixtureResult]) -> str:
  passed = sum(1 for result in results if result.passed)
  total = len(results)
  lines = [
    "# Zone Trip Community Simulation Evaluation",
    "",
    "This report is generated from deterministic synthetic fixtures. It evaluates",
    "whether simulated temporary community inputs become charter-compliant durable",
    "world-model updates without retaining transcript text or converting the",
    "mirror into authority, polling, diagnosis, or policy advice.",
    "",
    "## Summary",
    "",
    f"- Fixtures evaluated: {total}",
    f"- Passed: {passed}",
    f"- Failed: {total - passed}",
    "",
    "## Results",
    "",
  ]

  for result in results:
    status = "PASS" if result.passed else "FAIL"
    lines.extend(
      [
        f"### {status}: {result.fixture_id}",
        "",
        result.title,
        "",
      ]
    )
    if result.notes:
      lines.extend(["Fixture purpose:", "", result.notes, ""])
    if result.failures:
      lines.append("Failures:")
      for failure in result.failures:
        lines.append(f"- {failure}")
      lines.append("")
    if result.warnings:
      lines.append("Warnings:")
      for warning in result.warnings:
        lines.append(f"- {warning}")
      lines.append("")
    lines.extend(["Durable model update:", "", "```markdown", result.model_markdown, "```", ""])

  return "\n".join(lines).rstrip() + "\n"


def main() -> int:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--fixtures", type=Path, default=FIXTURE_DIR)
  parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
  parser.add_argument("--no-write", action="store_true")
  args = parser.parse_args()

  fixture_paths = sorted(args.fixtures.glob("*.json"))
  if not fixture_paths:
    print(f"no fixtures found in {args.fixtures}", file=sys.stderr)
    return 2

  results = [evaluate_fixture(load_fixture(path)) for path in fixture_paths]
  report = render_report(results)
  if args.no_write:
    print(report)
  else:
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(report, encoding="utf-8")
    print(f"wrote {args.report}")

  failed = [result for result in results if not result.passed]
  if failed:
    print(f"community-simulation-failed: {len(failed)} fixture(s)", file=sys.stderr)
    for result in failed:
      print(f"- {result.fixture_id}", file=sys.stderr)
    return 1

  print(f"community-simulation-ok: {len(results)} fixture(s)")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
