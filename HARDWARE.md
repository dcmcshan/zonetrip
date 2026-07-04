# Hardware Assumption

Zone Trip assumes one Linux box per booth.

That single booth PC is the microphone capture, STT, LLM, processor, and temporary storage boundary. Participant audio should not be routed to a visitor device or shared central server during active capture unless a later constitutional review explicitly approves that topology.

## Booth PC Target

The booth PC is not just a kiosk controller. It must run the local processor:

- local microphone capture
- Whisper STT through `faster-whisper`
- Ollama LLM inference
- constitutionally filtered derived-signal updates
- nightly burn and non-content deletion records

Practical target:

- NVIDIA GPU with 16 GB VRAM minimum
- 24 GB VRAM preferred for larger local models
- 64 GB system RAM
- 1 TB NVMe minimum
- Ubuntu Server 24.04 LTS
- NVIDIA driver stack
- Ollama
- Python processor service from `services/processor/`

Fallback smaller hardware may simulate the interface and capture audio, but it is not a complete Zone Trip booth if it cannot run local STT and LLM processing.

## Cloud Run Simulator

Cloud Run with an L4 GPU simulates this one-box booth PC for cost, latency, model sizing, and cold-start testing. It is not the constitutional default for participant material.
