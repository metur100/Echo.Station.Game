/**
 * Synthesises every sound effect, the ambient ship hum and the music loop as 16-bit mono WAV
 * files. Everything is generated from oscillators and noise: original audio, no samples.
 *
 *   node scripts/generate-sounds.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const RATE = 22050;
const out = path.resolve(import.meta.dirname, '../assets/sounds');
fs.mkdirSync(out, { recursive: true });

let seed = 0x5eed;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

function wav(name, samples, peakTarget = 0.9) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const gain = peak > 0 ? peakTarget / peak : 1;
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i] * gain)) * 32767), 44 + i * 2);
  fs.writeFileSync(path.join(out, `${name}.wav`), buf);
  console.log(`  ${name}.wav  ${(buf.length / 1024).toFixed(1)} KB`);
}

const buffer = (sec) => new Float32Array(Math.round(sec * RATE));
const note = (n) => 440 * 2 ** ((n - 69) / 12);
const TAU = Math.PI * 2;

/** Attack/decay envelope */
const ad = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));

/** Adds a tone into `buf` starting at `start` seconds. */
function tone(buf, { start = 0, dur, freq, freqEnd = freq, type = 'sine', amp = 1, attack = 0.005, decay = 0.2, fm = 0, fmRatio = 2 }) {
  const s0 = Math.round(start * RATE);
  const len = Math.round(dur * RATE);
  let phase = 0;
  let mphase = 0;
  for (let i = 0; i < len && s0 + i < buf.length; i++) {
    const t = i / RATE;
    const f = freq + (freqEnd - freq) * (i / len);
    mphase += (TAU * f * fmRatio) / RATE;
    phase += (TAU * f) / RATE + fm * Math.sin(mphase) * (TAU / RATE) * f;
    let v;
    if (type === 'sine') v = Math.sin(phase);
    else if (type === 'tri') v = (2 / Math.PI) * Math.asin(Math.sin(phase));
    else if (type === 'saw') v = 2 * ((phase / TAU) % 1) - 1;
    else v = Math.sign(Math.sin(phase)) * 0.6;
    buf[s0 + i] += v * amp * ad(t, attack, decay);
  }
}

function noise(buf, { start = 0, dur, amp = 1, attack = 0.002, decay = 0.05, lowpass = 0.2 }) {
  const s0 = Math.round(start * RATE);
  const len = Math.round(dur * RATE);
  let y = 0;
  for (let i = 0; i < len && s0 + i < buf.length; i++) {
    y += lowpass * (rand() * 2 - 1 - y);
    buf[s0 + i] += y * amp * ad(i / RATE, attack, decay);
  }
}

/** Feedback delay (echo) in place */
function delay(buf, sec, feedback, mix) {
  const d = Math.round(sec * RATE);
  for (let i = d; i < buf.length; i++) buf[i] += buf[i - d] * feedback * mix;
}

/** One-pole low-pass in place */
function lowpass(buf, k) {
  let y = 0;
  for (let i = 0; i < buf.length; i++) {
    y += k * (buf[i] - y);
    buf[i] = y;
  }
}

function fadeOut(buf, sec) {
  const n = Math.round(sec * RATE);
  for (let i = 0; i < n; i++) buf[buf.length - 1 - i] *= i / n;
}

console.log('Sound effects');
{
  const b = buffer(0.06);
  tone(b, { dur: 0.06, freq: 2200, freqEnd: 1600, decay: 0.012 });
  noise(b, { dur: 0.02, amp: 0.25, decay: 0.006, lowpass: 0.5 });
  wav('tap', b, 0.5);
}
{
  const b = buffer(0.16);
  tone(b, { dur: 0.08, freq: 880, decay: 0.05, type: 'tri' });
  tone(b, { start: 0.06, dur: 0.1, freq: 1320, decay: 0.06, type: 'tri' });
  wav('select', b, 0.55);
}
{
  const b = buffer(0.7);
  noise(b, { dur: 0.2, amp: 1, decay: 0.07, lowpass: 0.05 });
  tone(b, { dur: 0.25, freq: 90, freqEnd: 55, decay: 0.08 });
  [72, 76, 79, 84].forEach((n, i) => tone(b, { start: 0.12 + i * 0.07, dur: 0.4, freq: note(n), decay: 0.18, amp: 0.4, fm: 0.6, fmRatio: 3 }));
  wav('build', b, 0.8);
}
{
  const b = buffer(0.25);
  noise(b, { dur: 0.15, amp: 1, decay: 0.04, lowpass: 0.08 });
  tone(b, { dur: 0.2, freq: 140, freqEnd: 80, decay: 0.06 });
  wav('place', b, 0.7);
}
{
  const b = buffer(0.9);
  for (const st of [0, 0.4]) {
    tone(b, { start: st, dur: 0.2, freq: 660, decay: 0.12, type: 'tri', amp: 0.8 });
    tone(b, { start: st + 0.16, dur: 0.24, freq: 495, decay: 0.14, type: 'tri', amp: 0.8 });
  }
  wav('warning', b, 0.75);
}
{
  const b = buffer(1.2);
  for (let k = 0; k < 3; k++) tone(b, { start: k * 0.38, dur: 0.34, freq: 330, freqEnd: 290, type: 'saw', attack: 0.02, decay: 0.3, amp: 0.6 });
  lowpass(b, 0.18);
  wav('alarm', b, 0.8);
}
{
  const b = buffer(1.4);
  [67, 71, 74, 79, 83].forEach((n, i) => tone(b, { start: i * 0.09, dur: 1, freq: note(n), decay: 0.45, amp: 0.5, fm: 1.2, fmRatio: 3.5 }));
  delay(b, 0.17, 0.4, 1);
  fadeOut(b, 0.3);
  wav('research', b, 0.75);
}
{
  const b = buffer(2.2);
  for (const n of [57, 64, 69, 73, 76]) tone(b, { dur: 2.2, freq: note(n), type: 'saw', attack: 0.4, decay: 0.9, amp: 0.25 });
  lowpass(b, 0.08);
  [81, 85, 88].forEach((n, i) => tone(b, { start: 0.3 + i * 0.12, dur: 1.2, freq: note(n), decay: 0.5, amp: 0.35, fm: 0.8, fmRatio: 2 }));
  fadeOut(b, 0.5);
  wav('mission', b, 0.8);
}
{
  const b = buffer(2.0);
  tone(b, { dur: 0.9, freq: 300, freqEnd: 620, attack: 0.6, decay: 0.25, amp: 0.7, fm: 0.4, fmRatio: 1.5 });
  tone(b, { start: 0.1, dur: 0.9, freq: 450, freqEnd: 930, attack: 0.6, decay: 0.25, amp: 0.35 });
  delay(b, 0.23, 0.55, 1);
  lowpass(b, 0.35);
  fadeOut(b, 0.6);
  wav('echo', b, 0.75);
}
{
  const b = buffer(0.32);
  tone(b, { dur: 0.3, freq: 220, freqEnd: 140, type: 'square', decay: 0.12, amp: 0.6 });
  lowpass(b, 0.25);
  wav('error', b, 0.6);
}
{
  const b = buffer(0.5);
  tone(b, { dur: 0.25, freq: note(76), decay: 0.12, amp: 0.6, type: 'tri' });
  tone(b, { start: 0.1, dur: 0.4, freq: note(83), decay: 0.2, amp: 0.6, type: 'tri' });
  wav('success', b, 0.6);
}

console.log('Ambient and music');
{
  // 8 s seamless ship hum: harmonics at whole-number periods of the loop length.
  const sec = 8;
  const b = buffer(sec);
  const n = b.length;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const wob = 1 + 0.15 * Math.sin((TAU * t) / sec);
    b[i] = 0.5 * Math.sin(TAU * 55 * t) + 0.25 * Math.sin(TAU * 110 * t) * wob + 0.12 * Math.sin(TAU * 165 * t + 1) + 0.06 * Math.sin(TAU * 440 * t) * (0.5 + 0.5 * Math.sin((TAU * 2 * t) / sec));
  }
  // Air-handling noise, crossfaded so the loop point is seamless.
  const air = buffer(sec);
  noise(air, { dur: sec, amp: 0.35, attack: 0, decay: 1e9, lowpass: 0.03 });
  const fade = Math.round(0.5 * RATE);
  for (let i = 0; i < fade; i++) {
    const w = i / fade;
    air[i] = air[i] * w + air[n - fade + i] * (1 - w);
  }
  for (let i = 0; i < n - fade; i++) b[i] += air[i];
  wav('ambient', b.subarray(0, n - fade), 0.5);
}
{
  // 32 s ambient pad: Am – Fmaj7 – C – G, slow attack saws through a low-pass, sparse bells.
  const bar = 8;
  const chords = [
    [45, 57, 60, 64, 69],
    [41, 53, 57, 60, 64],
    [48, 55, 60, 64, 67],
    [43, 55, 59, 62, 67],
  ];
  const total = bar * chords.length;
  const b = buffer(total + 2);
  chords.forEach((c, k) => {
    for (const nn of c) {
      for (const det of [-0.08, 0.08]) tone(b, { start: k * bar, dur: bar + 1.5, freq: note(nn + det), type: 'saw', attack: 2.2, decay: 4, amp: nn < 50 ? 0.22 : 0.12 });
    }
  });
  lowpass(b, 0.035);
  const bells = [[2, 76], [5, 79], [10.5, 72], [13, 76], [18, 79], [21.5, 84], [26, 74], [29, 79]];
  for (const [at, nn] of bells) tone(b, { start: at, dur: 3, freq: note(nn), decay: 1.1, amp: 0.12, fm: 0.9, fmRatio: 3.01 });
  delay(b, 0.375, 0.45, 1);
  // Fold the 2 s tail back onto the start so the loop is seamless.
  const loop = b.subarray(0, Math.round(total * RATE));
  const tail = Math.round(2 * RATE);
  for (let i = 0; i < tail; i++) loop[i] += b[loop.length + i];
  wav('music', loop, 0.6);
}
