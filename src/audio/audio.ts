/**
 * Sound and music. All files are synthesised by scripts/generate-sounds.mjs (original audio).
 * Every call is wrapped so a missing or failing file can never crash the game.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

export type Sfx = 'tap' | 'select' | 'build' | 'place' | 'warning' | 'alarm' | 'research' | 'mission' | 'echo' | 'error' | 'success';

const SFX: Record<Sfx, number> = {
  tap: require('../../assets/sounds/tap.wav'),
  select: require('../../assets/sounds/select.wav'),
  build: require('../../assets/sounds/build.wav'),
  place: require('../../assets/sounds/place.wav'),
  warning: require('../../assets/sounds/warning.wav'),
  alarm: require('../../assets/sounds/alarm.wav'),
  research: require('../../assets/sounds/research.wav'),
  mission: require('../../assets/sounds/mission.wav'),
  echo: require('../../assets/sounds/echo.wav'),
  error: require('../../assets/sounds/error.wav'),
  success: require('../../assets/sounds/success.wav'),
};
const MUSIC = require('../../assets/sounds/music.wav');
const AMBIENT = require('../../assets/sounds/ambient.wav');

class AudioService {
  private players = new Map<Sfx, AudioPlayer>();
  private music: AudioPlayer | null = null;
  private ambient: AudioPlayer | null = null;
  private sfxVolume = 0.8;
  private musicVolume = 0.5;
  private started = false;
  private lastPlayed = new Map<Sfx, number>();

  async init() {
    try {
      await setAudioModeAsync({ playsInSilentMode: false, shouldPlayInBackground: false, interruptionMode: 'mixWithOthers' });
    } catch {
      // ignore: audio mode is best-effort
    }
  }

  setVolumes(music: number, sfx: number) {
    this.musicVolume = music;
    this.sfxVolume = sfx;
    try {
      if (this.music) this.music.volume = music * 0.55;
      if (this.ambient) this.ambient.volume = music * 0.35;
      if (music <= 0) this.stopMusic();
      else if (this.started) this.startMusic();
    } catch {
      // ignore
    }
  }

  play(name: Sfx) {
    if (this.sfxVolume <= 0) return;
    const now = Date.now();
    if (now - (this.lastPlayed.get(name) ?? 0) < 90) return;
    this.lastPlayed.set(name, now);
    try {
      let p = this.players.get(name);
      if (!p) {
        p = createAudioPlayer(SFX[name]);
        this.players.set(name, p);
      }
      p.volume = this.sfxVolume;
      p.seekTo(0).catch(() => undefined);
      p.play();
    } catch {
      // A missing sound is not worth a crash.
    }
  }

  startMusic() {
    this.started = true;
    if (this.musicVolume <= 0) return;
    try {
      if (!this.music) {
        this.music = createAudioPlayer(MUSIC);
        this.music.loop = true;
      }
      if (!this.ambient) {
        this.ambient = createAudioPlayer(AMBIENT);
        this.ambient.loop = true;
      }
      this.music.volume = this.musicVolume * 0.55;
      this.ambient.volume = this.musicVolume * 0.35;
      if (!this.music.playing) this.music.play();
      if (!this.ambient.playing) this.ambient.play();
    } catch {
      // ignore
    }
  }

  stopMusic() {
    try {
      this.music?.pause();
      this.ambient?.pause();
    } catch {
      // ignore
    }
  }

  /** App went to background */
  suspend() {
    this.stopMusic();
  }

  resume() {
    if (this.started) this.startMusic();
  }
}

export const audio = new AudioService();
