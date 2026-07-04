# World Model Boundary

Zone Trip should not keep participant transcripts as artifacts.

The booth treats speech as ephemeral input. A configured world-model endpoint may receive temporary audio for processing, but the intended contract is:

- no participant transcript is returned to the browser
- no participant transcript is downloaded
- no participant transcript is stored as a durable record
- raw audio is cleared from browser memory after update or deletion
- the surviving state is a derived world model, not source material
- the world model must avoid identity, faction labels, rankings, counts, recommendations, and representational claims

The world model should preserve only constitutionally allowed derived signals: tensions, contradictions, absences, symbolic patterns, minority signals, and open questions.

Any implementation that needs temporary speech-to-text must treat it as an internal processing buffer and destroy it after the derived update is complete.
