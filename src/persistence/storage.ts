/**
 * Storage backends for saves and settings. Saves are whole JSON documents (tens of KB), so they
 * go to files in the app's document directory rather than a key-value store.
 */
export interface SaveStorage {
  read(name: string): Promise<string | null>;
  write(name: string, data: string): Promise<void>;
  /** Atomically replace `to` with `from` (from is removed). */
  replace(from: string, to: string): Promise<void>;
  remove(name: string): Promise<void>;
}

export class MemoryStorage implements SaveStorage {
  files = new Map<string, string>();
  async read(name: string) {
    return this.files.get(name) ?? null;
  }
  async write(name: string, data: string) {
    this.files.set(name, data);
  }
  async replace(from: string, to: string) {
    const v = this.files.get(from);
    if (v === undefined) throw new Error(`missing ${from}`);
    this.files.set(to, v);
    this.files.delete(from);
  }
  async remove(name: string) {
    this.files.delete(name);
  }
}

/**
 * expo-file-system backed storage (loaded lazily so tests and tools never touch native code).
 * Some native file calls are asynchronous on Android even where the typings say void, so every
 * call is awaited.
 */
export class FileStorage implements SaveStorage {
  private dirName = 'saves';

  private async api() {
    const fs = await import('expo-file-system');
    const dir = new fs.Directory(fs.Paths.document, this.dirName);
    if (!dir.exists) await Promise.resolve(dir.create({ intermediates: true, idempotent: true }));
    return { fs, dir };
  }

  async read(name: string) {
    const { fs, dir } = await this.api();
    const f = new fs.File(dir, name);
    if (!f.exists) return null;
    return f.text();
  }

  async write(name: string, data: string) {
    const { fs, dir } = await this.api();
    const f = new fs.File(dir, name);
    if (!f.exists) await Promise.resolve(f.create({ overwrite: true }));
    await Promise.resolve(f.write(data));
  }

  async replace(from: string, to: string) {
    const { fs, dir } = await this.api();
    const src = new fs.File(dir, from);
    const dst = new fs.File(dir, to);
    if (dst.exists) await Promise.resolve(dst.delete());
    await Promise.resolve(src.move(dst));
  }

  async remove(name: string) {
    const { fs, dir } = await this.api();
    const f = new fs.File(dir, name);
    if (f.exists) await Promise.resolve(f.delete());
  }
}
