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

consentCheckbox.addEventListener("change", () => {
  startButton.disabled = !consentCheckbox.checked;
});

startButton.addEventListener("click", startRecording);
stopButton.addEventListener("click", stopRecording);
updateButton.addEventListener("click", async () => {
  if (!recordingBlob) {
    return;
  }

  if (!boothConfig.worldModelEndpoint) {
    setState("Endpoint missing");
    setMessage("No world-model endpoint is configured for this booth.");
    return;
  }

  updateButton.disabled = true;
  setState("Updating");
  setMessage("Sending ephemeral audio for derived world-model update.");

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

    clearRecording();
    setState("Updated");
    setMessage("World model update accepted. Ephemeral audio was cleared from this browser.");
  } catch (error) {
    updateButton.disabled = false;
    setState("Update failed");
    setMessage("The world model was not updated. Delete or retry from this browser.");
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
} else if (boothConfig.autoStart) {
  window.addEventListener("load", () => {
    startButton.disabled = true;
    startRecording();
  });
}
