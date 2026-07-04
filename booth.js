const consentCheckbox = document.querySelector("#consent-checkbox");
const startButton = document.querySelector("#start-recording");
const stopButton = document.querySelector("#stop-recording");
const deleteButton = document.querySelector("#delete-recording");
const stateLabel = document.querySelector("#recording-state");
const timeLabel = document.querySelector("#recording-time");
const message = document.querySelector("#booth-message");
const meterBar = document.querySelector("#meter-bar");
const reviewPanel = document.querySelector(".recording-review");
const playback = document.querySelector("#recording-playback");
const downloadLink = document.querySelector("#download-recording");

let mediaRecorder;
let mediaStream;
let audioContext;
let analyser;
let meterAnimation;
let recordingStartedAt = 0;
let timerInterval;
let chunks = [];
let recordingUrl;

function setMessage(text) {
  message.textContent = text;
}

function setState(text) {
  stateLabel.textContent = text;
}

function formatElapsed(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function startTimer() {
  recordingStartedAt = Date.now();
  timerInterval = window.setInterval(() => {
    timeLabel.textContent = formatElapsed((Date.now() - recordingStartedAt) / 1000);
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
    meterBar.style.transform = `scaleX(${Math.min(1, average / 120)})`;
    meterAnimation = requestAnimationFrame(render);
  };
  render();
}

function stopMeter() {
  cancelAnimationFrame(meterAnimation);
  meterBar.style.transform = "scaleX(0)";
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
  playback.removeAttribute("src");
  downloadLink.removeAttribute("href");
  reviewPanel.hidden = true;
  deleteButton.disabled = true;
  timeLabel.textContent = "00:00";
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
    recordingUrl = URL.createObjectURL(blob);
    playback.src = recordingUrl;
    downloadLink.href = recordingUrl;
    downloadLink.download = `zonetrip-reflection-${new Date().toISOString()}.webm`;
    reviewPanel.hidden = false;
    deleteButton.disabled = false;
    setState("Stopped");
    stopStream();
    stopMeter();
  });

  mediaRecorder.start(1000);
  startMeter(mediaStream);
  startTimer();
  setState("Listening");
  startButton.disabled = true;
  stopButton.disabled = false;
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
deleteButton.addEventListener("click", () => {
  clearRecording();
  setState("Deleted");
  setMessage("The current in-browser recording has been deleted.");
});

if (!navigator.mediaDevices || !window.MediaRecorder) {
  setState("Unsupported browser");
  setMessage("This browser does not support local audio recording.");
  consentCheckbox.disabled = true;
}
