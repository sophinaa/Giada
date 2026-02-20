const canvas = document.getElementById("confetti-canvas");
const ctx = canvas.getContext("2d");
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
const ABSOLUTE_BLOW_THRESHOLD = 0.11;
const RELATIVE_BLOW_MULTIPLIER = 1.9;

function getFlames() {
  return Array.from(document.querySelectorAll(".photo-flame"));
}

function addRandomCandles(count = 5) {
  const usedX = [50];

  for (let i = 0; i < count; i += 1) {
    let x = 50;
    let y = 19.5;
    let attempts = 0;

    while (attempts < 40) {
      const nextX = 32 + Math.random() * 36;
      const nextY = 18 + Math.random() * 4;
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
    flame.style.setProperty("--x", `${x}%`);
    flame.style.setProperty("--y", `${y}%`);
    photoCakeWrap.appendChild(flame);
  }
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
  micStatus.textContent = "Candles relit. Blow toward your mic.";
}

function blowOutCandle() {
  getFlames().forEach((flame) => flame.classList.add("out"));
  micStatus.textContent = "Wish made. Candles are out.";
  celebrate();
}

function hasLitCandle() {
  return getFlames().some((flame) => !flame.classList.contains("out"));
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function createParticle() {
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
  cancelAnimationFrame(animationFrameId);
  burst();
  draw();
}

function getAudioLevel() {
  analyser.getByteTimeDomainData(audioData);
  let sumSquares = 0;

  for (let i = 0; i < audioData.length; i += 1) {
    const normalized = (audioData[i] - 128) / 128;
    sumSquares += normalized * normalized;
  }

  return Math.sqrt(sumSquares / audioData.length);
}

function monitorMic() {
  if (!analyser) {
    return;
  }

  const level = getAudioLevel();
  blowBaseline = blowBaseline === 0 ? level : blowBaseline * 0.94 + level * 0.06;

  const now = Date.now();
  const isStrongEnough = level > ABSOLUTE_BLOW_THRESHOLD;
  const isBurstAboveRoomNoise = level > blowBaseline * RELATIVE_BLOW_MULTIPLIER;
  const cooldownFinished = now - lastBlowAt > BLOW_COOLDOWN_MS;

  if (isStrongEnough && isBurstAboveRoomNoise && cooldownFinished && hasLitCandle()) {
    lastBlowAt = now;
    blowOutCandle();
  }

  monitoringFrameId = requestAnimationFrame(monitorMic);
}

async function enableMicMonitoring() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    micStatus.textContent = "Mic input not supported in this browser.";
    return;
  }

  const isLocalHost =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.hostname === "::1";

  if (!window.isSecureContext && !isLocalHost) {
    micStatus.textContent = "Mic needs HTTPS (or localhost) to work.";
    return;
  }

  try {
    if (!audioContext) {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(micStream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.85;
      source.connect(analyser);
      audioData = new Uint8Array(analyser.fftSize);
    } else if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    cancelAnimationFrame(monitoringFrameId);
    blowBaseline = 0;
    monitorMic();
    micStatus.textContent = "Mic active. Blow toward your computer to extinguish.";
  } catch (error) {
    micStatus.textContent = "Mic permission denied or unavailable.";
  }
}

window.addEventListener("resize", resizeCanvas);
celebrateBtn.addEventListener("click", celebrate);
enableMicBtn.addEventListener("click", enableMicMonitoring);
relightBtn.addEventListener("click", relightCandle);
cakePhoto.addEventListener("error", () => {
  micStatus.textContent = `Missing ${CAKE_IMAGE_SRC} in project root.`;
});

cakePhoto.src = CAKE_IMAGE_SRC;
addRandomCandles(5);
nudgeLeftMostCandleDown();
resizeCanvas();
celebrate();
