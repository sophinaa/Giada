const canvas = document.getElementById("confetti-canvas");
const ctx = canvas.getContext("2d");
const celebrateBtn = document.getElementById("celebrate-btn");

let particles = [];
let animationFrameId;

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

window.addEventListener("resize", resizeCanvas);
celebrateBtn.addEventListener("click", celebrate);

resizeCanvas();
celebrate();
