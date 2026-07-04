# Hardware Assumption

Zone Trip assumes one local PC per booth.

Each booth PC is its own capture and processing boundary. Participant audio should not be routed to a shared central booth server during active capture unless a later constitutional review explicitly approves that topology.

## Budget Booth PC

The $500-class booth PC target is a local controller and light processing node, not a replacement for a cloud GPU service.

Minimum practical target:

- AMD Ryzen 5 7640HS, Ryzen 7 7840HS, or comparable recent mini PC CPU
- 32 GB RAM
- 1 TB NVMe storage
- 2.5 GbE networking
- Ubuntu Server 24.04 LTS
- Docker or systemd service deployment
- Optional Coral USB or M.2 accelerator for small classifiers only

Expected local responsibilities:

- serve the booth interface
- capture microphone input locally
- hold raw audio only in temporary local storage or browser memory
- run light local speech-to-text or transient interpretation where feasible
- run local redaction and derived-signal updates where feasible
- execute nightly burn and produce non-content deletion records

Not expected from the $500-class booth PC:

- large GPU-class model inference
- high-throughput multi-booth processing
- cloud-equivalent L4 GPU performance
- long-term storage of raw participant material
- shared central collection of raw booth audio

If stronger local synthesis is needed, add a separate steward-reviewed local AI workstation. That machine must still remain inside the deployment boundary and must not become a raw-material archive.
