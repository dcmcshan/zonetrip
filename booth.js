const consentCheckbox = document.querySelector("#consent-checkbox");
const startButton = document.querySelector("#start-recording");
const stopButton = document.querySelector("#stop-recording");
const updateButton = document.querySelector("#update-world-model");
const deleteButton = document.querySelector("#delete-recording");
const stateLabel = document.querySelector("#recording-state");
const timeLabel = document.querySelector("#recording-time");
const message = document.querySelector("#booth-message");
const meterBar = document.querySelector("#meter-bar");
const reviewPanel = document.querySelector(".recording-review");
const playback = document.querySelector("#recording-playback");
const threshold = document.querySelector("#threshold");
const enterThresholdButton = document.querySelector("#enter-threshold");
const worldDrawer = document.querySelector("#world-drawer");
const worldDrawerToggle = document.querySelector("#world-drawer-toggle");
const worldModelStatus = document.querySelector("#world-model-status");
const worldModelText = document.querySelector("#world-model-text");
const boothConfig = window.ZoneTripBoothConfig || {};

let mediaRecorder;
let mediaStream;
let audioContext;
let analyser;
let meterAnimation;
let recordingStartedAt = 0;
let timerInterval;
let chunks = [];
let recordingUrl;
let recordingBlob;

function setMessage(text) {
  if (message) {
    message.textContent = text;
  }
}

function setState(text) {
  if (stateLabel) {
    stateLabel.textContent = text;
  }
}

function setWorldDrawerOpen(open) {
  if (!worldDrawer || !worldDrawerToggle) {
    return;
  }

  worldDrawer.dataset.open = open ? "true" : "false";
  worldDrawerToggle.setAttribute("aria-expanded", String(open));
}

function setWorldModelStatus(text) {
  if (worldModelStatus) {
    worldModelStatus.textContent = text;
  }
}

function boundedList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item).replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function formatWorldSection(title, items) {
  const body = boundedList(items);
  const lines = [title];

  if (!body.length) {
    lines.push("- None surfaced");
    return lines.join("\n");
  }

  for (const item of body) {
    lines.push(`- ${item}`);
  }

  return lines.join("\n");
}

function renderWorldModel(payload) {
  if (!worldModelText) {
    return;
  }

  if (!payload || typeof payload !== "object") {
    setWorldModelStatus("No derived model was returned.");
    worldModelText.textContent = "No derived model yet.";
    setWorldDrawerOpen(true);
    return;
  }

  if (typeof payload.model_markdown === "string" && payload.model_markdown.trim()) {
    setWorldModelStatus("Updated from local model.md.");
    worldModelText.textContent = payload.model_markdown.trim();
    setWorldDrawerOpen(true);
    return;
  }

  const retained = payload.raw_transcript_retained === true ? "yes" : "no";
  const lines = [
    "Derived World Model",
    `Raw transcript retained: ${retained}`,
    "",
    formatWorldSection("Tensions", payload.tensions),
    "",
    formatWorldSection("Contradictions", payload.contradictions),
    "",
    formatWorldSection("Absences", payload.absences),
    "",
    formatWorldSection("Symbolic Patterns", payload.symbolic_patterns),
    "",
    formatWorldSection("Minority Signals", payload.minority_signals),
    "",
    formatWorldSection("Open Questions", payload.open_questions),
    "",
    formatWorldSection("Rejected Boundary Material", payload.rejected_content),
  ];

  setWorldModelStatus("Updated from local STT and LLM derived signals.");
  worldModelText.textContent = lines.join("\n");
  setWorldDrawerOpen(true);
}

function formatElapsed(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function startTimer() {
  recordingStartedAt = Date.now();
  timerInterval = window.setInterval(() => {
    if (timeLabel) {
      timeLabel.textContent = formatElapsed((Date.now() - recordingStartedAt) / 1000);
    }
  }, 250);
}

function stopTimer() {
  window.clearInterval(timerInterval);
}

function startMeter(stream) {
  audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);

  const data = new Uint8Array(analyser.frequencyBinCount);
  const render = () => {
    analyser.getByteFrequencyData(data);
    const average = data.reduce((sum, value) => sum + value, 0) / data.length;
    if (meterBar) {
      meterBar.style.transform = `scaleX(${Math.min(1, average / 120)})`;
    }
    meterAnimation = requestAnimationFrame(render);
  };
  render();
}

function stopMeter() {
  cancelAnimationFrame(meterAnimation);
  if (meterBar) {
    meterBar.style.transform = "scaleX(0)";
  }
  if (audioContext) {
    audioContext.close();
  }
}

function clearRecording() {
  if (recordingUrl) {
    URL.revokeObjectURL(recordingUrl);
  }

  chunks = [];
  recordingUrl = undefined;
  recordingBlob = undefined;
  if (playback) {
    playback.removeAttribute("src");
  }
  if (reviewPanel) {
    reviewPanel.hidden = true;
  }
  updateButton.disabled = true;
  deleteButton.disabled = true;
  if (timeLabel) {
    timeLabel.textContent = "00:00";
  }
}

function stopStream() {
  if (mediaStream) {
    for (const track of mediaStream.getTracks()) {
      track.stop();
    }
  }
  mediaStream = undefined;
}

function recordingMimeType() {
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return options.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

async function startRecording() {
  clearRecording();
  setMessage("");

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false,
      },
    });
  } catch (error) {
    setState("Microphone unavailable");
    setMessage("The browser could not access the microphone.");
    return;
  }

  const mimeType = recordingMimeType();
  mediaRecorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined);
  mediaRecorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  });
  mediaRecorder.addEventListener("stop", () => {
    const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
    recordingBlob = blob;
    recordingUrl = URL.createObjectURL(blob);
    if (playback) {
      playback.src = recordingUrl;
    }
    if (reviewPanel) {
      reviewPanel.hidden = false;
    }
    updateButton.disabled = false;
    deleteButton.disabled = false;
    setState("Stopped");
    setMessage("Audio is held in memory. Update the world model or delete it.");
    stopStream();
    stopMeter();
  });

  mediaRecorder.start(1000);
  startMeter(mediaStream);
  startTimer();
  setState("Listening");
  startButton.disabled = true;
  stopButton.disabled = false;
  updateButton.disabled = true;
  deleteButton.disabled = true;
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }
  stopTimer();
  startButton.disabled = !consentCheckbox.checked;
  stopButton.disabled = true;
}

function enterThreshold() {
  if (consentCheckbox) {
    consentCheckbox.checked = true;
  }
  if (threshold) {
    threshold.hidden = true;
  }
  if (startButton) {
    startButton.disabled = true;
  }
  setWorldModelStatus("Listening. Awaiting local processor update.");
  startRecording();
}

consentCheckbox.addEventListener("change", () => {
  startButton.disabled = !consentCheckbox.checked;
});

startButton.addEventListener("click", startRecording);
if (enterThresholdButton) {
  enterThresholdButton.addEventListener("click", enterThreshold);
}
if (worldDrawerToggle) {
  worldDrawerToggle.addEventListener("click", () => {
    setWorldDrawerOpen(worldDrawer?.dataset.open !== "true");
  });
}
stopButton.addEventListener("click", stopRecording);
updateButton.addEventListener("click", async () => {
  if (!recordingBlob) {
    return;
  }

  if (!boothConfig.worldModelEndpoint) {
    setState("Endpoint missing");
    setMessage("No world-model endpoint is configured for this booth.");
    setWorldModelStatus("No local processor endpoint is configured.");
    setWorldDrawerOpen(true);
    return;
  }

  updateButton.disabled = true;
  setState("Updating");
  setMessage("Sending ephemeral audio for derived world-model update.");
  setWorldModelStatus("Processing local audio into derived signals.");

  try {
    const response = await fetch(boothConfig.worldModelEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": recordingBlob.type || "application/octet-stream",
        "X-ZoneTrip-Intent": "world-model-update",
      },
      body: recordingBlob,
    });

    if (!response.ok) {
      throw new Error(`World model update failed: ${response.status}`);
    }

    const payload = await response.json().catch(() => null);
    renderWorldModel(payload);
    clearRecording();
    setState("Updated");
    setMessage("World model update accepted. Ephemeral audio was cleared from this browser.");
  } catch (error) {
    updateButton.disabled = false;
    setState("Update failed");
    setMessage("The world model was not updated. Delete or retry from this browser.");
    setWorldModelStatus("The processor did not return a world-model update.");
    setWorldDrawerOpen(true);
  }
});
deleteButton.addEventListener("click", () => {
  clearRecording();
  setState("Deleted");
  setMessage("The current in-browser audio has been deleted.");
});

if (!navigator.mediaDevices || !window.MediaRecorder) {
  setState("Unsupported browser");
  setMessage("This browser does not support local audio recording.");
  consentCheckbox.disabled = true;
  if (enterThresholdButton) {
    enterThresholdButton.disabled = true;
  }
} else if (boothConfig.autoStart) {
  window.addEventListener("load", () => {
    startButton.disabled = true;
    startRecording();
  });
}

window.ZoneTripWorldDrawer = {
  render: renderWorldModel,
  setOpen: setWorldDrawerOpen,
};
