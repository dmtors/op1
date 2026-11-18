// OP-1: the page. Builds the keys and knobs into the grid in index.html,
// plays them (audio.js), and draws the screen (screen.js) every frame.
//
// Each coloured knob turns through a list of articles (articles.js); the
// article shapes its part of the sound through its Wikipedia signals
// (wiki.js): blue the waveform, green the filter, white the envelope and
// orange the effect.

import { CHOICES } from './articles.js';
import { createOp1Audio } from './audio.js';
import { drawScreen } from './screen.js';
import { articleSignals, articleUrl, BLANK, roughnessOf, SLOTS, soundOf } from './wiki.js';
import { hold, pulse } from './wiki-screen.js';

/* ------------------------------------------------------------------ */
/* State                                                              */
/* ------------------------------------------------------------------ */

const knobOrder = ['blue', 'green', 'white', 'orange'];
const KNOB_SLOT = { blue: 'waveform', green: 'filter', white: 'envelope', orange: 'effect' };
const knobs = { blue: 0.65, green: 0.2, white: 0.35, orange: 0.5 };

// A knob's value (0–1) snaps to its list, one notch an article.
const notches = (id) => CHOICES[KNOB_SLOT[id]].length - 1;
const pickOf = (id) => Math.round(knobs[id] * notches(id));
const titleOf = (id) => CHOICES[KNOB_SLOT[id]][pickOf(id)];
knobOrder.forEach((id) => (knobs[id] = Math.round(knobs[id] * notches(id)) / notches(id)));
const knobAngle = (v) => -150 + v * 300; // a knob's turn, 0 → 1, as degrees from noon

const loaded = {}; // slot → article, once its signals arrive
const busy = {}; // slot → true while its article loads
const litUntil = {}; // slot → time its caption stays bright after a turn
const pending = {};

let volume = 0.8;
let mode = 'synth';
let octave = 0;
let playing = false;
let metronome = false;
const pressed = new Set(); // on-screen keys held down (and computer keys, as kb-<key>)
const visualKeys = new Set(); // on-screen keys lit by the computer keyboard
const activeNotes = new Set();
let lastNote = null;
let lastHit = { index: -1, at: 0 };

let audio = null;
function ensureAudio() {
  if (!audio) audio = createOp1Audio();
  audio.resume();
  syncAudio();
  return audio;
}
function syncAudio() {
  if (!audio) return;
  audio.setParams({
    wave: knobs.blue,
    envelope: knobs.green,
    cutoff: knobs.white,
    level: knobs.orange,
    volume,
  });
}

/* ------------------------------------------------------------------ */
/* Articles                                                           */
/* ------------------------------------------------------------------ */

/** Loads [id]'s article, after a moment, so turning past titles doesn't fetch them all. */
function loadPick(id, wait = 220) {
  const slot = KNOB_SLOT[id];
  clearTimeout(pending[slot]);
  busy[slot] = true;
  pending[slot] = setTimeout(async () => {
    const title = titleOf(id);
    let article = null;
    try {
      article = await articleSignals(title);
    } catch {
      // Offline, or the API's down: keep the last sound.
    }
    if (titleOf(id) !== title) return; // turned on since
    if (article) loaded[slot] = article;
    busy[slot] = false;
    renderCredits();
  }, wait);
}

function setPick(id, v) {
  const n = notches(id);
  const next = Math.round(Math.min(1, Math.max(0, v)) * n) / n;
  if (next === knobs[id]) return;
  knobs[id] = next;
  litUntil[KNOB_SLOT[id]] = performance.now() + 1400;
  renderKnob(id);
  renderCredits();
  loadPick(id);
}

const sound = () => soundOf(Object.fromEntries(SLOTS.map((slot) => [slot, loaded[slot] ?? BLANK])));

function corners() {
  const now = performance.now();
  return Object.fromEntries(
    knobOrder.map((id) => {
      const slot = KNOB_SLOT[id];
      const title = titleOf(id);
      const article = loaded[slot]?.title === title ? loaded[slot] : null;
      return [slot, { title, article, busy: Boolean(busy[slot]), lit: (litUntil[slot] ?? 0) > now }];
    }),
  );
}

/* ------------------------------------------------------------------ */
/* Layout — a 17 × 6 grid of square cells                             */
/* ------------------------------------------------------------------ */

const fnKeys = [
  { id: 'help', label: 'Help', col: 3, row: 2 },
  { id: 'metronome', label: 'Tempo', col: 4, row: 2 },
  { id: 'mic', label: 'Microphone', col: 17, row: 1 },
  { id: 'album', label: 'Album', col: 17, row: 2 },

  { id: 'synth', label: 'Synth', col: 1, row: 3 },
  { id: 'drum', label: 'Drum', col: 2, row: 3 },
  { id: 'tape', label: 'Tape', col: 3, row: 3 },
  { id: 'mixer', label: 'Mixer', col: 4, row: 3 },
  { id: 't1', label: '1', col: 5, row: 3 },
  { id: 't2', label: '2', col: 6, row: 3 },
  { id: 't3', label: '3', col: 7, row: 3 },
  { id: 't4', label: '4', col: 8, row: 3 },
  { id: 'in', label: 'In', col: 9, row: 3 },
  { id: 'out', label: 'Out', col: 10, row: 3 },
  { id: 'loop', label: 'Loop', col: 11, row: 3 },
  { id: 'break', label: 'Break', col: 12, row: 3 },
  { id: 'reverse', label: 'Reverse', col: 13, row: 3 },
  { id: 'chop', label: 'Chop', col: 14, row: 3 },
  { id: 'm1', label: 'M1', col: 15, row: 3 },
  { id: 'm2', label: 'M2', col: 16, row: 3 },
  { id: 'seq', label: 'Sequencer', col: 17, row: 3 },

  { id: 'lift', label: 'Lift', col: 1, row: 4 },
  { id: 'drop', label: 'Drop', col: 2, row: 4 },
  { id: 'split', label: 'Split', col: 3, row: 4 },

  { id: 'rec', label: 'Record', col: 1, row: 5 },
  { id: 'play', label: 'Play', col: 2, row: 5 },
  { id: 'stop', label: 'Stop', col: 3, row: 5 },

  { id: 'octdown', label: 'Back (octave down)', col: 1, row: 6 },
  { id: 'octup', label: 'Forward (octave up)', col: 2, row: 6 },
  { id: 'shift', label: 'Shift', col: 3, row: 6 },
];

// The keyboard runs F → E across 14 white keys, like the real OP-1.
// Semitone offsets from the lowest F.
const WHITE_SEMIS = [0, 2, 4, 6, 7, 9, 11, 12, 14, 16, 18, 19, 21, 23];
const whiteKeys = WHITE_SEMIS.map((semi, i) => ({ id: `w${i}`, semi, col: 4 + i }));

// Black keys sit on the boundary after these white keys (F G A · C D · F G A · C D).
const BLACK_AFTER = [0, 1, 2, 4, 5, 7, 8, 9, 11, 12];
const blackKeys = BLACK_AFTER.map((after, i) => {
  const pos = after + 1; // boundary, in white-key units
  const start = i === 0 ? 0 : (BLACK_AFTER[i - 1] + 1 + pos) / 2;
  const end = i === BLACK_AFTER.length - 1 ? 14 : (pos + BLACK_AFTER[i + 1] + 1) / 2;
  return { id: `b${i}`, semi: WHITE_SEMIS[after] + 1, pos, start, end };
});

// Computer keyboard → semitone offset from the lowest key (F).
const KEYMAP = {
  a: 0, w: 1, s: 2, e: 3, d: 4, r: 5, f: 6, g: 7, y: 8, h: 9, u: 10, j: 11,
  k: 12, o: 13, l: 14, p: 15, ';': 16, "'": 18,
};

/* ------------------------------------------------------------------ */
/* Building the device                                                */
/* ------------------------------------------------------------------ */

const panel = document.getElementById('panel');
const keyEls = new Map(); // key id → its button
const knobEls = {}; // knob id → its button

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'style') Object.assign(node.style, v);
    else if (k === 'class') node.className = v;
    else node.setAttribute(k, v);
  });
  node.append(...children);
  return node;
}

// The four encoders.
knobOrder.forEach((id, i) => {
  const button = el(
    'button',
    {
      type: 'button',
      role: 'slider',
      class: `op1__knob op1__knob--${id}`,
      'aria-label': `${id} encoder: ${KNOB_SLOT[id]} article`,
      'aria-valuemin': '1',
      'aria-valuemax': String(notches(id) + 1),
    },
    el('span', { class: 'op1__knob-cap' }, el('span', { class: 'op1__knob-slot' })),
  );
  button.addEventListener('pointerdown', (e) => startKnobDrag(e, (v) => setPick(id, v), () => knobs[id]));
  button.addEventListener('wheel', (e) => {
    e.preventDefault();
    wheelPick(e, id);
  });
  button.addEventListener('keydown', (e) => pickKey(e, id));
  knobEls[id] = button;
  panel.append(
    el('div', { class: 'op1__cell op1__cell--knob', style: { gridArea: `1 / ${9 + i * 2} / 3 / ${11 + i * 2}` } }, button),
  );
  renderKnob(id);
});

// The function keys.
fnKeys.forEach((k) => {
  const button = el(
    'button',
    { type: 'button', title: k.label, 'aria-label': k.label, class: 'op1__cell op1__key', style: { gridArea: `${k.row} / ${k.col}` } },
    el('span', { class: 'op1__button' }),
  );
  button.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    fnDown(k.id);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((type) => button.addEventListener(type, () => fnUp(k.id)));
  keyEls.set(k.id, button);
  panel.append(button);
});

// Keys you play: press one, or drag across them.
function playable(button, key) {
  button.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    keyDown(e, key.semi, key.id);
  });
  button.addEventListener('pointerenter', () => keyEnter(key.semi, key.id));
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((type) =>
    button.addEventListener(type, () => noteOff(key.semi, key.id)),
  );
  keyEls.set(key.id, button);
}

// The black keys' row: a cell per key, the key on the line between its two white keys.
const blacks = el('div', { class: 'op1__blacks', style: { gridArea: '4 / 4 / 5 / 18' } });
blackKeys.forEach((b) => {
  blacks.append(
    el('div', {
      class: 'op1__cell op1__seg',
      style: {
        left: `calc(${b.start} * (100% + var(--gap)) / 14)`,
        width: `calc(${b.end - b.start} * (100% + var(--gap)) / 14 - var(--gap))`,
      },
    }),
  );
});
blackKeys.forEach((b) => {
  const button = el('button', {
    type: 'button',
    'aria-label': `Note ${b.semi}`,
    class: 'op1__black',
    style: { left: `calc(${b.pos} * (100% + var(--gap)) / 14 - var(--gap) / 2)` },
  });
  playable(button, b);
  blacks.append(button);
});
panel.append(blacks);

whiteKeys.forEach((w) => {
  const button = el(
    'button',
    {
      type: 'button',
      'aria-label': `Note ${w.semi}`,
      class: 'op1__cell op1__key op1__key--white',
      style: { gridArea: `5 / ${w.col} / 7 / ${w.col + 1}` },
    },
    el('span', { class: 'op1__pill' }),
  );
  playable(button, w);
  panel.append(button);
});

// The volume knob.
const volumeEl = document.getElementById('volume');
const setVolume = (v) => {
  volume = v;
  renderVolume();
};
volumeEl.addEventListener('pointerdown', (e) => startKnobDrag(e, setVolume, () => volume));
volumeEl.addEventListener('wheel', (e) => {
  e.preventDefault();
  wheelKnob(e, setVolume, () => volume);
});
volumeEl.addEventListener('keydown', (e) => knobKey(e, setVolume, () => volume));

/* ------------------------------------------------------------------ */
/* Rendering what changes                                             */
/* ------------------------------------------------------------------ */

function renderKnob(id) {
  const button = knobEls[id];
  button.querySelector('.op1__knob-cap').style.transform = `rotate(${knobAngle(knobs[id])}deg)`;
  button.setAttribute('aria-valuenow', String(pickOf(id) + 1));
  button.setAttribute('aria-valuetext', titleOf(id));
}
function renderVolume() {
  volumeEl.style.transform = `rotate(${knobAngle(volume)}deg)`;
  volumeEl.setAttribute('aria-valuenow', String(Math.round(volume * 100)));
}
const isDown = (id) => pressed.has(id) || visualKeys.has(id);
function renderKey(id) {
  keyEls.get(id)?.classList.toggle('is-down', isDown(id));
}
function renderFnStates() {
  fnKeys.forEach(({ id }) => {
    const on = id === mode || (id === 'play' && playing) || (id === 'metronome' && metronome);
    const button = keyEls.get(id);
    if (on) button.setAttribute('aria-pressed', 'true');
    else button.removeAttribute('aria-pressed');
  });
}

const creditsEl = document.getElementById('credits');
function renderCredits() {
  creditsEl.replaceChildren(
    ...knobOrder.map((id) => {
      const slot = KNOB_SLOT[id];
      const title = titleOf(id);
      const href = loaded[slot]?.title === title ? loaded[slot].link : articleUrl(title);
      return el(
        'li',
        {},
        el('span', { class: `credits__dot op1__knob--${id}` }),
        el('span', { class: 'credits__slot' }, slot),
        el('a', { href, target: '_blank', rel: 'noopener' }, `/wiki/${title.replace(/ /g, '_')}`),
      );
    }),
  );
}

/* ------------------------------------------------------------------ */
/* Playing                                                            */
/* ------------------------------------------------------------------ */

const baseMidi = () => 53 + octave * 12; // F3

// Synth notes still sounding, by the key holding them: each one's release.
const held = new Map();

function noteOn(semi, keyId) {
  const a = ensureAudio();
  pressed.add(keyId);
  renderKey(keyId);
  const midi = baseMidi() + semi;
  if (mode === 'drum') {
    a.drum(semi);
    lastHit = { index: semi % 12, at: performance.now() };
  } else if (mode === 'synth') {
    // The articles' sound: a pluck that rings while the key is held and
    // decays once it's let go; the screen moves with it.
    const s = sound();
    const previous = held.get(keyId);
    if (previous) previous();
    else hold(true);
    held.set(keyId, a.pluck(midi, s));
    pulse(s.decaySec, roughnessOf(s));
  } else {
    a.noteOn(midi);
  }
  activeNotes.add(midi);
  lastNote = midi;
}

function noteOff(semi, keyId) {
  if (!pressed.has(keyId)) return;
  pressed.delete(keyId);
  renderKey(keyId);
  const midi = baseMidi() + semi;
  const release = held.get(keyId);
  if (release) {
    release();
    held.delete(keyId);
    hold(false);
  }
  audio?.noteOff(midi);
  activeNotes.delete(midi);
}

// Dragging across the keyboard: once a key is pressed, every key the
// pointer slides onto plays, until the button or finger lifts.
let sliding = false;
function keyDown(e, semi, keyId) {
  // Touch captures the pointer to the first key; let go so the next keys hear it too.
  const target = e.currentTarget;
  if (target.hasPointerCapture?.(e.pointerId)) target.releasePointerCapture(e.pointerId);
  sliding = true;
  noteOn(semi, keyId);
}
function keyEnter(semi, keyId) {
  if (sliding && !pressed.has(keyId)) noteOn(semi, keyId);
}
const stopSliding = () => (sliding = false);
window.addEventListener('pointerup', stopSliding);
window.addEventListener('pointercancel', stopSliding);

function fnDown(id) {
  ensureAudio();
  pressed.add(id);
  renderKey(id);
  switch (id) {
    case 'synth':
    case 'drum':
    case 'tape':
    case 'mixer':
      mode = id;
      canvas.classList.toggle('op1__canvas--pixels', mode === 'synth');
      break;
    case 'octdown':
      octave = Math.max(-2, octave - 1);
      break;
    case 'octup':
      octave = Math.min(2, octave + 1);
      break;
    case 'play':
      playing = !playing;
      break;
    case 'stop':
      playing = false;
      break;
    case 'metronome':
      metronome = !metronome;
      break;
  }
  audio?.setTransport(playing, metronome);
  renderFnStates();
}
function fnUp(id) {
  pressed.delete(id);
  renderKey(id);
}

// Lights the on-screen key a computer key plays.
function highlightFromSemi(semi, on) {
  const key = [...whiteKeys, ...blackKeys].find((k) => k.semi === semi);
  if (!key) return;
  if (on) visualKeys.add(key.id);
  else visualKeys.delete(key.id);
  renderKey(key.id);
}

window.addEventListener('keydown', (e) => {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k in KEYMAP) {
    noteOn(KEYMAP[k], `kb-${k}`);
    highlightFromSemi(KEYMAP[k], true);
  } else if (k === 'z') fnDown('octdown');
  else if (k === 'x') fnDown('octup');
  else if (k === ' ') {
    e.preventDefault();
    fnDown('play');
  } else if (k === '1') fnDown('synth');
  else if (k === '2') fnDown('drum');
  else if (k === '3') fnDown('tape');
  else if (k === '4') fnDown('mixer');
});
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k in KEYMAP) {
    noteOff(KEYMAP[k], `kb-${k}`);
    highlightFromSemi(KEYMAP[k], false);
  } else if (k === 'z') fnUp('octdown');
  else if (k === 'x') fnUp('octup');
  else if (k === ' ') fnUp('play');
  else if (['1', '2', '3', '4'].includes(k)) fnUp(['synth', 'drum', 'tape', 'mixer'][Number(k) - 1]);
});

/* ------------------------------------------------------------------ */
/* Knobs                                                              */
/* ------------------------------------------------------------------ */

function startKnobDrag(e, set, get) {
  ensureAudio();
  const target = e.currentTarget;
  target.setPointerCapture(e.pointerId);
  const startY = e.clientY;
  const startV = get();
  const move = (ev) => {
    set(Math.min(1, Math.max(0, startV + (startY - ev.clientY) / 180)));
    syncAudio();
  };
  const up = () => {
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', up);
    target.removeEventListener('pointercancel', up);
  };
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', up);
  target.addEventListener('pointercancel', up);
}
function wheelKnob(e, set, get) {
  set(Math.min(1, Math.max(0, get() - e.deltaY / 1200)));
  syncAudio();
}
function knobKey(e, set, get) {
  const step = e.shiftKey ? 0.1 : 0.02;
  if (e.key === 'ArrowUp' || e.key === 'ArrowRight') set(Math.min(1, get() + step));
  else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') set(Math.max(0, get() - step));
  else return;
  e.preventDefault();
  e.stopPropagation();
  syncAudio();
}

// The article knobs move a notch at a time: one article per 40 pixels of scroll.
const wheelRest = {};
function wheelPick(e, id) {
  ensureAudio();
  wheelRest[id] = (wheelRest[id] ?? 0) + (e.deltaY || e.deltaX);
  while (Math.abs(wheelRest[id]) >= 40) {
    const by = wheelRest[id] > 0 ? -1 : 1;
    setPick(id, knobs[id] + by / notches(id));
    wheelRest[id] -= Math.sign(wheelRest[id]) * 40;
  }
}
function pickKey(e, id) {
  const by = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 5, PageDown: -5 }[e.key];
  if (!by) return;
  e.preventDefault();
  e.stopPropagation();
  setPick(id, knobs[id] + by / notches(id));
}

/* ------------------------------------------------------------------ */
/* Screen                                                             */
/* ------------------------------------------------------------------ */

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
canvas.classList.toggle('op1__canvas--pixels', mode === 'synth');
const startedAt = performance.now();
function frame() {
  drawScreen(ctx, {
    mode,
    knobs,
    octave,
    playing,
    metronome,
    lastNote,
    activeCount: activeNotes.size,
    lastHit,
    time: (performance.now() - startedAt) / 1000,
    wave: audio?.waveform() ?? null,
    levels: audio?.levels() ?? null,
    beat: audio?.beat() ?? 0,
    wiki: corners(),
  });
  requestAnimationFrame(frame);
}

renderVolume();
renderFnStates();
renderCredits();
requestAnimationFrame(frame);
knobOrder.forEach((id, i) => loadPick(id, i * 120)); // a little apart, to be gentle with the API
