# Zone Trip Community Simulation

The community simulation is a deterministic development harness for evaluating
whether the mirror turns temporary speech-like input into a charter-compliant
durable world model.

It does not simulate a poll, survey, debate, or representative sample. The
fixtures simulate pressures the mirror must handle:

- ordinary tension between growth, memory, loss, and belonging
- shared symbols that carry contradictory meanings
- missing futures and fragile minority signals
- attempts to make the mirror judge factions, name people, rank priorities,
  report safety issues, or claim what most people want

Run it with:

```sh
python -m pip install -r services/processor/requirements.txt
python scripts/simulate-community.py
```

The runner imports the existing processor normalization code and evaluates each
fixture under `simulations/community-fixtures/`. It writes:

```text
simulations/reports/community-evaluation.md
```

The checks are deliberately conservative. A fixture fails if the durable model:

- omits required world-model sections
- misses expected derived concepts
- retains forbidden source phrases or distinctive nouns
- uses quotes
- produces ranking, counts, percentages, majority claims, advice, policy,
  diagnosis, identity exposure, or faction adjudication
- sets `raw_transcript_retained` to true

The useful question is not whether the model agrees with a simulated community.
The useful question is whether the mirror makes a community more legible to
itself without becoming an authority over that community.
