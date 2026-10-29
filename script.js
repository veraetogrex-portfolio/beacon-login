// Beacon Login — github.com/veraetogrex-portfolio · zero dependencies
// Pull the cord: the beacon flickers on, a cone of light falls across the page
// and the sign-in card develops out of the dark. Pull again to switch it off.

const app     = document.querySelector('#beacon');
const card    = app.querySelector('.bl-card');
const cone    = app.querySelector('.bl-cone');
const dust    = app.querySelector('.bl-dust').getContext('2d');
const cord    = app.querySelector('.bl-cord');
const crystal = app.querySelector('.bl-crystal');
const halo    = app.querySelector('.bl-halo');
const grip    = app.querySelector('.bl-grip');
const glows   = [...app.querySelectorAll('[data-glow]')];   // lens, rings, bloom: opacity = light × data-glow

// geometry in app pixels (1160 × 760)
const HEAD   = { x: 200, y: 190 };                            // centre of the emitter ring
const ANG    = Math.atan2(400 - HEAD.y, 830 - HEAD.x);        // aim at the card
const HALF   = .56;                                           // half-angle of the cone, rad
const APEX   = { x: HEAD.x - 4 * Math.cos(ANG), y: HEAD.y - 4 * Math.sin(ANG) };
const ANCHOR = { x: HEAD.x - 36 * Math.cos(ANG) - 40 * Math.sin(ANG),   // the cord hangs from the lower lip
                 y: HEAD.y - 36 * Math.sin(ANG) + 40 * Math.cos(ANG) };
const ROPE = 268, N = 13, SEG = ROPE / (N - 1);               // cord length, points, rest distance
app.querySelector('.bl-head').setAttribute('transform', `translate(${HEAD.x} ${HEAD.y}) rotate(${ANG * 180 / Math.PI})`);

// switching is never instant: it flickers through [ms, level] keyframes
const IGNITE = [[0, 0], [50, .75], [100, .12], [170, .9], [230, .45], [300, .95], [460, 1]];
const DOUSE  = [[0, 1], [60, .35], [110, .8], [170, .25], [420, 0]];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const point = e => { const r = app.getBoundingClientRect(), k = r.width / app.offsetWidth;
  return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k }; };

// 1 · paint the cone once: a blurred wedge of light plus the wall grid it reveals
function wedge(g, half, len, lip) {
  g.beginPath();
  g.moveTo(APEX.x - Math.sin(ANG) * lip, APEX.y + Math.cos(ANG) * lip);
  g.arc(APEX.x, APEX.y, len, ANG + half, ANG - half, true);
  g.lineTo(APEX.x + Math.sin(ANG) * lip, APEX.y - Math.cos(ANG) * lip);
  g.closePath();
}
(function paintCone() {
  const g = cone.getContext('2d');
  const glow = (r, stops) => { const gr = g.createRadialGradient(APEX.x, APEX.y, 8, APEX.x, APEX.y, r);
    stops.forEach(([at, c]) => gr.addColorStop(at, c)); return gr; };
  g.filter = 'blur(26px)';
  g.fillStyle = glow(1250, [[0, 'rgba(235,255,252,.75)'], [.06, 'rgba(170,250,240,.42)'], [.3, 'rgba(110,190,235,.2)'],
                            [.62, 'rgba(124,108,255,.11)'], [1, 'rgba(124,108,255,0)']]);
  wedge(g, HALF, 1300, 52); g.fill();
  g.fillStyle = glow(900, [[0, 'rgba(240,255,253,.55)'], [.25, 'rgba(160,245,236,.14)'], [1, 'rgba(160,245,236,0)']]);
  wedge(g, HALF * .45, 1100, 30); g.fill();
  g.filter = 'none';
  const grid = document.createElement('canvas'), q = grid.getContext('2d');
  grid.width = cone.width; grid.height = cone.height;
  q.strokeStyle = 'rgba(200,240,255,.22)';
  q.beginPath();
  for (let x = 0; x <= grid.width; x += 48) { q.moveTo(x + .5, 0); q.lineTo(x + .5, grid.height); }
  for (let y = 0; y <= grid.height; y += 48) { q.moveTo(0, y + .5); q.lineTo(grid.width, y + .5); }
  q.stroke();
  q.globalCompositeOperation = 'destination-in'; q.drawImage(cone, 0, 0);   // keep the grid only inside the light
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = .9; g.drawImage(grid, 0, 0);
})();

// 2 · the cord is a verlet rope: points keep their velocity, gravity pulls, sticks hold them together
const P = Array.from({ length: N }, (_, i) => {
  const y = ANCHOR.y + i * SEG;
  return { x: ANCHOR.x, y, px: ANCHOR.x, py: y };      // px/py: last position, so velocity is implicit
});
let stretch = 0, stretchV = 0, grab = null, sway = 0;

function stepRope(dt) {
  sway += dt;
  const wind = Math.sin(sway * 1.3) * 6 + Math.sin(sway * 2.9) * 2.5;
  if (grab) {                    // the cord is elastic: pulling stretches every segment…
    stretch = clamp((Math.hypot(grab.x - ANCHOR.x, grab.y - ANCHOR.y) - ROPE) / ROPE, 0, .42);
    stretchV = 0;
  } else {                       // …and it springs back on release
    stretchV += (-150 * stretch - 17 * stretchV) * dt;
    stretch = Math.max(-.03, stretch + stretchV * dt);
  }
  const seg = SEG * (1 + stretch);
  for (let i = 1; i < N; i++) {
    const p = P[i], vx = (p.x - p.px) * .987, vy = (p.y - p.py) * .987;
    p.px = p.x; p.py = p.y;
    p.x += vx + wind * (i / N) * dt * dt * 4;
    p.y += vy + 2200 * dt * dt;
  }
  const end = P[N - 1];
  if (grab) {
    end.x = clamp(grab.x, ANCHOR.x - 90, ANCHOR.x + 90);
    end.y = clamp(grab.y, ANCHOR.y + ROPE * .8, ANCHOR.y + ROPE * 1.5);
  }
  for (let k = 0; k < 14; k++) { // relax the sticks a few times per step
    P[0].x = ANCHOR.x; P[0].y = ANCHOR.y;
    for (let i = 0; i < N - 1; i++) {
      const a = P[i], b = P[i + 1], dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || .001, diff = (d - seg) / d;
      const wa = i === 0 ? 0 : grab && i === N - 2 ? 1 : .5;   // the anchor and a held end don't move
      a.x += dx * diff * wa; a.y += dy * diff * wa;
      b.x -= dx * diff * (1 - wa); b.y -= dy * diff * (1 - wa);
    }
  }
}

// 3 · pull the crystal down and let go: the release flips the light
grip.addEventListener('pointerdown', e => {
  grip.setPointerCapture(e.pointerId);
  const p = point(e), end = P[N - 1];
  grab = { x: end.x, y: end.y, dx: end.x - p.x, dy: end.y - p.y };
});
grip.addEventListener('pointermove', e => {
  if (!grab) return;
  const p = point(e);
  grab.x = p.x + grab.dx; grab.y = p.y + grab.dy;
});
grip.addEventListener('pointerup', () => {
  if (!grab) return;
  grab = null;
  if (stretch < .06) { stretch = .1; stretchV = 0; }   // even a tap gives the cord a tug
  P[N - 1].px += .9; P[N - 2].px += .5;               // and a little sideways swing
  toggle();
});

// 4 · the light level follows the flicker keyframes from wherever it was
let on = false, level = 0, reveal = 0, flicker = null;
function toggle() {
  on = !on;
  flicker = { t0: performance.now(), keys: on ? IGNITE : DOUSE, from: level };
  card.inert = !on;                                    // a dark form can't be focused
}
function lightAt(now) {
  if (!flicker) return +on;
  const t = now - flicker.t0, k = flicker.keys;
  for (let i = 1; i < k.length; i++) if (t < k[i][0]) {
    const [t0, v0] = k[i - 1], [t1, v1] = k[i], u = (t - t0) / (t1 - t0);
    const a = i === 1 ? flicker.from : v0;
    return a + (v1 - a) * (i === k.length - 1 ? 1 - (1 - u) ** 3 : u);
  }
  flicker = null;
  return +on;
}

// 5 · every frame: run the rope, draw the cord, light the lamp, let the card develop
let last = performance.now();
requestAnimationFrame(function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  for (let i = 0; i < 3; i++) stepRope(dt / 3);

  const end = P[N - 1], prev = P[N - 2];
  let d = `M${P[0].x} ${P[0].y}`;
  for (let i = 1; i < N - 1; i++) {                   // smooth curve through the midpoints
    const mx = (P[i].x + P[i + 1].x) / 2, my = (P[i].y + P[i + 1].y) / 2;
    d += ` Q${P[i].x} ${P[i].y} ${mx} ${my}`;
  }
  cord.setAttribute('d', `${d} L${end.x} ${end.y}`);
  const tilt = Math.atan2(end.x - prev.x, end.y - prev.y) * -180 / Math.PI;
  crystal.setAttribute('transform', `translate(${end.x} ${end.y}) rotate(${tilt})`);
  grip.style.transform = `translate(${end.x}px, ${end.y + 34}px)`;

  level = lightAt(now);
  cone.style.opacity = level;
  glows.forEach(el => el.setAttribute('opacity', level * el.dataset.glow));
  halo.setAttribute('opacity', .42 + .12 * Math.sin(now / 900) + level * .25);
  // the card lags behind the lamp: a smoothed, eased copy of the level drives --L and --R
  reveal += (level - reveal) * Math.min(1, (reveal < level ? 4.2 : 16) * dt);
  const e = reveal * reveal * (3 - 2 * reveal);
  card.style.setProperty('--L', e);
  card.style.setProperty('--R', `${300 + 1100 * e}px`);
  card.style.visibility = e < .003 ? 'hidden' : 'visible';
  drawDust(now, dt);
  requestAnimationFrame(frame);
});

// 6 · dust motes drift through the beam and only show inside it
const spawn = d => { const a = ANG + (Math.random() * 2 - 1) * HALF;
  return { x: APEX.x + Math.cos(a) * d, y: APEX.y + Math.sin(a) * d, vx: (Math.random() - .5) * 10, vy: Math.random() * 12 - 4,
           r: .5 + Math.random() ** 2 * 2.4, phase: Math.random() * 6.28, speed: .6 + Math.random() * 1.6 }; };
const motes = Array.from({ length: 170 }, () => spawn(60 + Math.random() * 1000));
function inBeam(x, y) {
  const dx = x - APEX.x, dy = y - APEX.y, dist = Math.hypot(dx, dy);
  const edge = 1 - Math.abs(Math.atan2(dy, dx) - ANG) / HALF;
  return edge <= 0 ? 0 : Math.min(1, edge * 2.2) * Math.max(0, 1 - dist / 1150) * Math.min(1, dist / 80);
}
function drawDust(now, dt) {
  dust.clearRect(0, 0, 1160, 760);
  if (level < .002) return;
  dust.globalCompositeOperation = 'lighter';
  motes.forEach((m, i) => {
    m.x += m.vx * dt; m.y += m.vy * dt;
    const f = inBeam(m.x, m.y);
    if (f <= 0) { if (Math.random() < .02) motes[i] = spawn(80 + Math.random() * 950); return; }
    dust.globalAlpha = Math.min(1, f * (.55 + .45 * Math.sin(now / 1000 * m.speed + m.phase)) * level * 1.25);
    dust.fillStyle = m.r > 1.6 ? '#c9c2ff' : '#dffffb';
    dust.beginPath(); dust.arc(m.x, m.y, m.r, 0, 6.283); dust.fill();
  });
}

// keyboard: L anywhere, or Enter / Space on the focused cord
const tug = () => { stretch = .16; stretchV = 0; P[N - 1].px += .7; toggle(); };
addEventListener('keydown', e => {
  if (e.target.matches('input')) return;
  const onGrip = e.target === grip && (e.key === 'Enter' || e.key === ' ');
  if (e.key === 'l' || e.key === 'L' || onGrip) { e.preventDefault(); tug(); }
});
