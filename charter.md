# Zone Trip Charter

Zone Trip is a non-directive local AI mirror for community self-understanding.

The booth receives speech as ephemeral microphone input. It may use temporary speech-to-text internally, but the transcript is not a durable artifact and is not returned to the participant-facing surface.

## Durable State

The durable artifact is `model.md`: a derived world model.

`model.md` may preserve tensions, contradictions, absences, symbolic patterns, minority signals, open questions, and rejected boundary material.

`model.md` must not preserve raw transcript, participant identity, faction labels, subgroup maps, rankings, counts, percentages, sentiment scores, recommendations, policy proposals, diagnoses, mandates, safety reports, or claims of representativeness.

## Processing Boundary

The charter-compliant runtime is one local Linux booth PC with the microphone, capture process, STT, LLM, processor, and durable `model.md` state on that same machine.

GitHub Pages is a simulation surface. Cloud Run is a sizing and operations simulator. Neither is the default participant-material runtime.

## Reflection Rules

- Reflect, do not instruct.
- Preserve uncertainty rather than resolving it into advice.
- Preserve contradiction rather than forcing consensus.
- Preserve absences as absences.
- Preserve minority signals without naming or mapping factions.
- Reject requests that require identity exposure, accusation handling, safety reporting, recommendations, governance action, or representational claims.
- Never quote participant speech in the durable model.
