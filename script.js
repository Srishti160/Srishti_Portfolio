// ---------------------------------------------------------------------
// A. SCENE, CAMERA, & RENDERER SETUP
// ---------------------------------------------------------------------
const container = document.getElementById('webgl-container');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  75, 
  window.innerWidth / window.innerHeight, 
  0.1, 
  1000
);
camera.position.z = 50;

// Front-facing Directional Light attached to camera
const cameraLight = new THREE.DirectionalLight(0xffffff, 1.2);
cameraLight.position.set(0, 0, 1);
camera.add(cameraLight);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.setClearColor(0x030308, 1);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
if (container) container.appendChild(renderer.domElement);

// ---------------------------------------------------------------------
// B. TINY TWINKLING STARFIELD CREATION
// ---------------------------------------------------------------------
const starCount = 3200;
const starGeometry = new THREE.BufferGeometry();

const positions = new Float32Array(starCount * 3);
const twinkleOffsets = new Float32Array(starCount); // Random time offset per star
const twinkleSpeeds = new Float32Array(starCount);  // Random speed per star

for (let i = 0; i < starCount; i++) {
  positions[i * 3]     = (Math.random() - 0.5) * 200;
  positions[i * 3 + 1] = (Math.random() - 0.5) * 200;
  positions[i * 3 + 2] = (Math.random() - 0.5) * 200;

  twinkleOffsets[i] = Math.random() * Math.PI * 2;
  twinkleSpeeds[i]  = 3.5 + Math.random() * 8.0;
}

starGeometry.setAttribute('aOffset', new THREE.BufferAttribute(twinkleOffsets, 1));
starGeometry.setAttribute('aSpeed', new THREE.BufferAttribute(twinkleSpeeds, 1));
starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

const starMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 }
  },
  vertexShader: `
    attribute float aOffset;
    attribute float aSpeed;
    uniform float uTime;
    varying float vAlpha;

    void main() {
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      float twinkle = sin(uTime * aSpeed + aOffset);
      vAlpha = 0.3 + 0.7 * (0.5 + 0.5 * twinkle);
      float depth = max(-mvPosition.z, 1.0);
      gl_PointSize = (260.0 * (0.7 + 0.3 * twinkle)) / depth;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    varying float vAlpha;

    void main() {
      float dist = length(gl_PointCoord - vec2(0.5));
      if (dist > 0.5) discard;
      float alpha = smoothstep(0.5, 0.0, dist) * vAlpha;
      gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
    }
  `,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});

const starField = new THREE.Points(starGeometry, starMaterial);
starField.layers.set(1);
scene.add(starField);



// ---------------------------------------------------------------------
// C. REALISTIC SHOOTING STARS SYSTEM
// ---------------------------------------------------------------------
function createMeteorTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;

  const ctx = canvas.getContext("2d");

  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.2, "rgba(220,245,255,0.9)");
  gradient.addColorStop(0.45, "rgba(90,200,255,0.35)");
  gradient.addColorStop(1, "rgba(90,200,255,0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);

  return new THREE.CanvasTexture(canvas);
}

const meteorTexture = createMeteorTexture();

const trailMaterial = new THREE.SpriteMaterial({
  map: meteorTexture,
  color: 0xffffff,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});

class Meteor {
  constructor() {
    this.group = new THREE.Group();
    this.head = new THREE.Sprite(trailMaterial.clone());
    this.head.scale.set(1.8, 1.8, 1);
    this.group.add(this.head);
    this.trail = [];

    for (let i = 0; i < 28; i++) {
      const s = new THREE.Sprite(trailMaterial.clone());
      s.scale.set(1.5 - i * 0.04, 1.5 - i * 0.04, 1);
      s.material.opacity = 0;
      this.group.add(s);
      this.trail.push(s);
    }
    scene.add(this.group);

    this.sparkleCount = 12;
    this.sparkleGeometry = new THREE.BufferGeometry();
    this.sparklePositions = new Float32Array(this.sparkleCount * 3);
    this.sparkleAlphas = new Float32Array(this.sparkleCount);
    
    for (let j = 0; j < this.sparkleCount; j++) {
      this.sparklePositions[j * 3] = 0;
      this.sparklePositions[j * 3 + 1] = 0;
      this.sparklePositions[j * 3 + 2] = 0;
      this.sparkleAlphas[j] = 0.0;
    }

    this.sparkleGeometry.setAttribute('position', new THREE.BufferAttribute(this.sparklePositions, 3));

    this.sparkleMaterial = new THREE.PointsMaterial({
      color: 0x00ffff,
      size: 0.8,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.sparkles = new THREE.Points(this.sparkleGeometry, this.sparkleMaterial);
    scene.add(this.sparkles);
    this.active = false;
    this.reset();
  }

  reset() {
    this.active = false;
    this.timer = 0;
    this.speed = 1.35 + Math.random() * 0.3;
    const scale = 0.3 + Math.random() * 0.7;
    this.length = (22 + Math.random() * 14) * scale;
    this.head.material.opacity = 0;
    this.head.scale.set(1.8 * scale, 1.8 * scale, 1);

    for (let i = 0; i < this.trail.length; i++) {
      const size = (1.5 - i * 0.04) * scale;
      this.trail[i].scale.set(Math.max(0.05, size), Math.max(0.05, size), 1);
    }

    if (this.sparkleMaterial) {
      this.sparkleMaterial.size = 0.8 * scale;
    }

    const meteorColors = [0x00f0ff, 0xffffff, 0xffb700, 0xaf70ff, 0x00ffcc];
    const randomColor = meteorColors[Math.floor(Math.random() * meteorColors.length)];

    this.head.material.color.setHex(randomColor);
    this.trail.forEach(s => s.material.color.setHex(randomColor));
    
    const angle = Math.random() * Math.PI * 2;
    this.direction = new THREE.Vector3(
      Math.cos(angle),
      Math.sin(angle),
      (Math.random() - 0.5) * 0.2
    ).normalize();

    this.position = new THREE.Vector3(
      (Math.random() - 0.5) * 100,
      (Math.random() - 0.5) * 70,
      (Math.random() - 0.5) * 20
    );

    this.distanceTraveled = 0;
    this.maxDistance = 25 + Math.random() * 45;
    
    if (this.sparklePositions) {
      for (let k = 0; k < this.sparkleCount; k++) {
        this.sparklePositions[k * 3] = 9999;
      }
      this.sparkleGeometry.attributes.position.needsUpdate = true;
    }
  }

  spawn() {
    this.reset();
    this.active = true;
  }

  update() {
    if (!this.active) return;

    this.position.addScaledVector(this.direction, this.speed);
    this.distanceTraveled += this.speed;

    let lifeRatio = this.distanceTraveled / this.maxDistance;
    let fadeAlpha = Math.sin(lifeRatio * Math.PI);

    this.head.position.copy(this.position);
    this.head.material.opacity = fadeAlpha;

    let safeRatio = Math.min(Math.max(lifeRatio, 0.0), 1.0);
    let dynamicTrailLength = Math.max(0.1, this.length * (1.0 - Math.pow(safeRatio, 2)));

    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      const offset = (i + 1) * (dynamicTrailLength / this.trail.length);

      t.position.copy(
        this.position.clone().sub(
          this.direction.clone().multiplyScalar(offset)
        )
      );

      let alpha = (1 - i / this.trail.length);
      alpha *= alpha;
      t.material.opacity = alpha * 0.45 * fadeAlpha;
    }

    if (this.distanceTraveled >= this.maxDistance || Math.abs(this.position.x) > 80 || Math.abs(this.position.y) > 50) {
      this.reset();
    }

    const posArr = this.sparkleGeometry.attributes.position.array;
    for (let s = this.sparkleCount - 1; s > 0; s--) {
      posArr[s * 3] = posArr[(s - 1) * 3] - this.direction.x * (0.2 + Math.random() * 0.3);
      posArr[s * 3 + 1] = posArr[(s - 1) * 3 + 1] - this.direction.y * (0.2 + Math.random() * 0.3);
      posArr[s * 3 + 2] = posArr[(s - 1) * 3 + 2] - this.direction.z * (0.2 + Math.random() * 0.3);
    }

    posArr[0] = this.position.x + (Math.random() - 0.5) * 0.5;
    posArr[1] = this.position.y + (Math.random() - 0.5) * 0.5;
    posArr[2] = this.position.z + (Math.random() - 0.5) * 0.5;

    this.sparkleGeometry.attributes.position.needsUpdate = true;
    this.sparkleMaterial.opacity = fadeAlpha * 0.7;
  }
}

const meteors = [];
for (let i = 0; i < 3; i++) {
  meteors.push(new Meteor());
}

function scheduleMeteor() {
  setTimeout(() => {
    const m = meteors.find(x => !x.active);
    if (m) m.spawn();
    scheduleMeteor();
  }, 4000 + Math.random() * 6000);
}

scheduleMeteor();

// ---------------------------------------------------------------------
// D. LIGHTING & MOUSE VELOCITY HANDLERS
// ---------------------------------------------------------------------
const ambientLight = new THREE.AmbientLight(0x404050, 2.5);
scene.add(ambientLight);

const baseSpeed = { x: 0.0003, y: 0.0005 };
let targetSpeed = { x: baseSpeed.x, y: baseSpeed.y };
let currentSpeed = { x: baseSpeed.x, y: baseSpeed.y };

window.addEventListener('mousemove', (event) => {
  const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
  const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;

  const speedMultiplier = 0.0015;
  targetSpeed.x = baseSpeed.x + mouseY * speedMultiplier;
  targetSpeed.y = baseSpeed.y + mouseX * speedMultiplier;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------------
// E. ANIMATION LOOP
// ---------------------------------------------------------------------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const elapsedTime = clock.getElapsedTime();

  currentSpeed.x += (targetSpeed.x - currentSpeed.x) * 0.05;
  currentSpeed.y += (targetSpeed.y - currentSpeed.y) * 0.05;

  starField.rotation.x += currentSpeed.x;
  starField.rotation.y += currentSpeed.y;

  starMaterial.uniforms.uTime.value = elapsedTime;
  meteors.forEach(m => m.update());

  renderer.autoClear = false;
  renderer.clear();

  camera.layers.set(1);
  renderer.render(scene, camera);

  renderer.clearDepth();

  camera.layers.set(0);
  renderer.render(scene, camera);
}

animate();

// =========================================================================
// F. SYNCHRONIZED SPLIT SEAM SLIDE (INACTIVE SIDE BG FADES TO 0)
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
  const leftClipLayer = document.getElementById('leftClipLayer');
  const leftText      = document.getElementById('leftText');
  const rightText     = document.getElementById('rightText');

  const leftMainImg   = document.getElementById('leftMainImg');
  const leftBgImg     = document.getElementById('leftBgImg');
  const rightMainImg  = document.getElementById('rightMainImg');
  const rightBgImg    = document.getElementById('rightBgImg');

  let currentClip = 50;
  let targetClip  = 50;

  if (leftText && rightText && leftClipLayer) {

    // 1. HOVER LEFT ("designer") -> Seam moves RIGHT (100%)
    leftText.addEventListener('mouseenter', () => {
      targetClip = 100;
    });
    leftText.addEventListener('mouseleave', () => {
      targetClip = 50;
    });

    // 2. HOVER RIGHT ("<coder>") -> Seam moves LEFT (0%)
    rightText.addEventListener('mouseenter', () => {
      targetClip = 0;
    });
    rightText.addEventListener('mouseleave', () => {
      targetClip = 50;
    });

    function updateImageClip() {
      // Smooth interpolation
      const smoothnessFactor = 0.035;
      currentClip += (targetClip - currentClip) * smoothnessFactor;

      // Apply dynamic split seam clip-path
      leftClipLayer.style.clipPath = `polygon(0 0, ${currentClip}% 0, ${currentClip}% 100%, 0 100%)`;

      // Calculate shift ratio (-1.0 to +1.0)
      let shiftRatio = (currentClip - 50) / 50;

      // -------------------------------------------------------------------
      // 1. SIMULTANEOUS EQUAL DISPLACEMENT
      // -------------------------------------------------------------------
      const frontDistance = shiftRatio * 45; // Front images displace 45px
      const backDistance  = shiftRatio * 20; // Bg images displace 20px

      if (leftMainImg)  leftMainImg.style.transform  = `translateX(${frontDistance}px)`;
      if (rightMainImg) rightMainImg.style.transform = `translateX(${frontDistance}px)`;

      if (leftBgImg)    leftBgImg.style.transform    = `translateX(${backDistance}px)`;
      if (rightBgImg)   rightBgImg.style.transform   = `translateX(${backDistance}px)`;

      // -------------------------------------------------------------------
      // 2. INACTIVE SIDE BACKGROUND FADES TO 0
      // -------------------------------------------------------------------
      if (shiftRatio > 0.02) {
        // LEFT IS ACTIVE -> Left BG stays 1, Right BG fades to 0
        if (leftBgImg)  leftBgImg.style.opacity  = '1';
        if (rightBgImg) rightBgImg.style.opacity = `${Math.max(0, 1 - shiftRatio)}`;
      } 
      else if (shiftRatio < -0.02) {
        // RIGHT IS ACTIVE -> Right BG stays 1, Left BG fades to 0
        let absRatio = Math.abs(shiftRatio);
        if (rightBgImg) rightBgImg.style.opacity = '1';
        if (leftBgImg)  leftBgImg.style.opacity  = `${Math.max(0, 1 - absRatio * 2.5)}`;
      } 
      else {
        // NEUTRAL CENTER (50/50 Split) -> Both BGs fully visible
        if (leftBgImg)  leftBgImg.style.opacity  = '1';
        if (rightBgImg) rightBgImg.style.opacity = '1';
      }

      // Main images stay fully opaque
      if (leftMainImg)  leftMainImg.style.opacity  = '1';
      if (rightMainImg) rightMainImg.style.opacity = '1';

      // Dynamic text highlight opacities
      if (currentClip > 65) {
        leftText.style.opacity = '1';
        rightText.style.opacity = '0.35';
      } else if (currentClip < 35) {
        leftText.style.opacity = '0.35';
        rightText.style.opacity = '1';
      } else {
        leftText.style.opacity = '1';
        rightText.style.opacity = '1';
      }

      requestAnimationFrame(updateImageClip);
    }

    updateImageClip();
  }
});