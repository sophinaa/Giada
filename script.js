const canvas = document.getElementById("confetti-canvas");
const ctx = canvas ? canvas.getContext("2d") : null;
const celebrateBtn = document.getElementById("celebrate-btn");
const photoCakeWrap = document.getElementById("photo-cake-wrap");
const cakePhoto = document.getElementById("cake-photo");
const photoFlame = document.getElementById("photo-flame");
const enableMicBtn = document.getElementById("enable-mic-btn");
const relightBtn = document.getElementById("relight-btn");
const micStatus = document.getElementById("mic-status");

const CAKE_IMAGE_SRC = "cake.jpeg";

let particles = [];
let animationFrameId;
let audioContext;
let analyser;
let audioData;
let micStream;
let monitoringFrameId;
let blowBaseline = 0;
let lastBlowAt = 0;

const BLOW_COOLDOWN_MS = 1500;
const ABSOLUTE_RMS_THRESHOLD = 0.05;
const ABSOLUTE_PEAK_THRESHOLD = 0.22;
const RELATIVE_BLOW_MULTIPLIER = 1.45;

function getFlames() {
  return Array.from(document.querySelectorAll(".photo-flame"));
}

function addRandomCandles(count = 5) {
  if (!photoCakeWrap) {
    return;
  }

  const usedX = [50];

  for (let i = 0; i < count; i += 1) {
    let x = 50;
    let y = 18.2;
    let attempts = 0;

    while (attempts < 40) {
      const nextX = 32 + Math.random() * 36;
      const nextY = 16.7 + Math.random() * 4;
      const farEnough = usedX.every((takenX) => Math.abs(takenX - nextX) > 5);

      if (farEnough) {
        x = nextX;
        y = nextY;
        break;
      }

      attempts += 1;
    }

    usedX.push(x);

    const flame = document.createElement("div");
    flame.className = "photo-flame";
    flame.dataset.row = "top";
    flame.style.setProperty("--x", `${x}%`);
    flame.style.setProperty("--y", `${y}%`);
    photoCakeWrap.appendChild(flame);
  }
}

function addLowerRowCandles(count = 4) {
  if (!photoCakeWrap) {
    return;
  }

  const usedX = [];

  for (let i = 0; i < count; i += 1) {
    let x = 50;
    let y = 25.2;
    let attempts = 0;

    while (attempts < 40) {
      const nextX = 34 + Math.random() * 32;
      const nextY = 23.5 + Math.random() * 3.2;
      const farEnough = usedX.every((takenX) => Math.abs(takenX - nextX) > 6);

      if (farEnough) {
        x = nextX;
        y = nextY;
        break;
      }

      attempts += 1;
    }

    usedX.push(x);

    const flame = document.createElement("div");
    flame.className = "photo-flame";
    flame.dataset.row = "bottom";
    flame.style.setProperty("--x", `${x}%`);
    flame.style.setProperty("--y", `${y}%`);
    photoCakeWrap.appendChild(flame);
  }
}

function removeLeftMostBottomCandle() {
  const bottomFlames = Array.from(
    document.querySelectorAll('.photo-flame[data-row="bottom"]')
  );

  if (bottomFlames.length === 0) {
    return;
  }

  let leftMost = bottomFlames[0];
  let leftMostX = Number.parseFloat(leftMost.style.getPropertyValue("--x")) || 50;

  bottomFlames.forEach((flame) => {
    const x = Number.parseFloat(flame.style.getPropertyValue("--x")) || 50;
    if (x < leftMostX) {
      leftMost = flame;
      leftMostX = x;
    }
  });

  leftMost.remove();
}

function nudgeLeftMostCandleDown(offset = 1.8) {
  const flames = getFlames();
  if (flames.length === 0) {
    return;
  }

  let leftMost = flames[0];
  let leftMostX = Number.parseFloat(leftMost.style.getPropertyValue("--x")) || 50;

  flames.forEach((flame) => {
    const x = Number.parseFloat(flame.style.getPropertyValue("--x")) || 50;
    if (x < leftMostX) {
      leftMost = flame;
      leftMostX = x;
    }
  });

  const currentY =
    Number.parseFloat(leftMost.style.getPropertyValue("--y")) || 19.5;
  leftMost.style.setProperty("--y", `${currentY + offset}%`);
}

function relightCandle() {
  getFlames().forEach((flame) => flame.classList.remove("out"));
  if (micStatus) {
    micStatus.textContent = "Candles relit. Blow toward your mic.";
  }
}

function blowOutCandle() {
  getFlames().forEach((flame) => flame.classList.add("out"));
  if (micStatus) {
    micStatus.textContent = "Wish made. Candles are out.";
  }
  celebrate();
}

function hasLitCandle() {
  return getFlames().some((flame) => !flame.classList.contains("out"));
}

function resizeCanvas() {
  if (!canvas) {
    return;
  }

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function createParticle() {
  if (!canvas) {
    return {
      x: 0,
      y: 0,
      size: 0,
      speedY: 0,
      speedX: 0,
      rotation: 0,
      spin: 0,
      color: "#000000"
    };
  }

  return {
    x: Math.random() * canvas.width,
    y: -20,
    size: 4 + Math.random() * 8,
    speedY: 1.3 + Math.random() * 2.6,
    speedX: -1.6 + Math.random() * 3.2,
    rotation: Math.random() * Math.PI,
    spin: -0.08 + Math.random() * 0.16,
    color: ["#95d5b2", "#74c69d", "#52b788", "#40916c", "#2d6a4f"][
      Math.floor(Math.random() * 5)
    ]
  };
}

function burst(count = 160) {
  particles = Array.from({ length: count }, createParticle);
}

function draw() {
  if (!ctx || !canvas) {
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  particles.forEach((p) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
    ctx.restore();

    p.x += p.speedX;
    p.y += p.speedY;
    p.rotation += p.spin;
  });

  particles = particles.filter((p) => p.y < canvas.height + 30);

  if (particles.length > 0) {
    animationFrameId = requestAnimationFrame(draw);
  }
}

function celebrate() {
  if (!ctx || !canvas) {
    return;
  }

  cancelAnimationFrame(animationFrameId);
  burst();
  draw();
}

function getAudioLevels() {
  analyser.getByteTimeDomainData(audioData);
  let sumSquares = 0;
  let peak = 0;

  for (let i = 0; i < audioData.length; i += 1) {
    const normalized = (audioData[i] - 128) / 128;
    sumSquares += normalized * normalized;
    const magnitude = Math.abs(normalized);
    if (magnitude > peak) {
      peak = magnitude;
    }
  }

  return {
    rms: Math.sqrt(sumSquares / audioData.length),
    peak
  };
}

function monitorMic() {
  if (!analyser) {
    return;
  }

  const { rms, peak } = getAudioLevels();
  blowBaseline = blowBaseline === 0 ? rms : blowBaseline * 0.9 + rms * 0.1;

  const now = Date.now();
  const isStrongEnough = rms > ABSOLUTE_RMS_THRESHOLD || peak > ABSOLUTE_PEAK_THRESHOLD;
  const isBurstAboveRoomNoise = rms > blowBaseline * RELATIVE_BLOW_MULTIPLIER;
  const cooldownFinished = now - lastBlowAt > BLOW_COOLDOWN_MS;

  if (isStrongEnough && isBurstAboveRoomNoise && cooldownFinished && hasLitCandle()) {
    lastBlowAt = now;
    blowOutCandle();
  }

  monitoringFrameId = requestAnimationFrame(monitorMic);
}

async function enableMicMonitoring() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (micStatus) {
      micStatus.textContent = "Mic input not supported in this browser.";
    }
    return;
  }

  const isLocalHost =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.hostname === "::1";

  if (!window.isSecureContext && !isLocalHost) {
    if (micStatus) {
      micStatus.textContent = "Mic needs HTTPS (or localhost) to work.";
    }
    return;
  }

  try {
    if (!audioContext) {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(micStream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.55;
      source.connect(analyser);
      audioData = new Uint8Array(analyser.fftSize);
    } else if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    cancelAnimationFrame(monitoringFrameId);
    blowBaseline = 0;
    monitorMic();
    if (micStatus) {
      micStatus.textContent = "Mic active. Blow toward your computer to extinguish.";
    }
  } catch (error) {
    if (micStatus) {
      micStatus.textContent = "Mic permission denied or unavailable.";
    }
  }
}

if (canvas) {
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
  celebrate();
}

if (celebrateBtn) {
  celebrateBtn.addEventListener("click", celebrate);
}

if (enableMicBtn) {
  enableMicBtn.addEventListener("click", enableMicMonitoring);
}

if (relightBtn) {
  relightBtn.addEventListener("click", relightCandle);
}

if (cakePhoto) {
  cakePhoto.addEventListener("error", () => {
    if (micStatus) {
      micStatus.textContent = `Missing ${CAKE_IMAGE_SRC} in project root.`;
    }
  });

  cakePhoto.src = CAKE_IMAGE_SRC;
}

if (photoCakeWrap && photoFlame) {
  addRandomCandles(5);
  addLowerRowCandles(4);
  removeLeftMostBottomCandle();
  nudgeLeftMostCandleDown();
}
