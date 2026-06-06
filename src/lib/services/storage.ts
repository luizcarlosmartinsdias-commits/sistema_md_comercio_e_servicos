import path from 'path';
import { mkdir, writeFile } from 'fs/promises';

export class StorageService {
  static provider = process.env.STORAGE_PROVIDER ?? 'local';
  static basePath = process.env.STORAGE_LOCAL_PATH ?? './uploads';

  static async save(file: File, folder: string) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const cleanName = this.cleanFileName(file.name);
    const storageKey = `${folder}/${Date.now()}-${cleanName}`;
    await this.writeLocal(storageKey, bytes);
    return { storageKey, fileName: file.name, mimeType: file.type || 'application/octet-stream', sizeBytes: bytes.length };
  }

  static async saveBytes(bytes: Uint8Array, folder: string, fileName: string, mimeType: string) {
    const cleanName = this.cleanFileName(fileName);
    const storageKey = `${folder}/${Date.now()}-${cleanName}`;
    const buffer = Buffer.from(bytes);
    await this.writeLocal(storageKey, buffer);
    return { storageKey, fileName, mimeType, sizeBytes: buffer.length };
  }

  static resolveLocalPath(storageKey: string) { return path.resolve(this.basePath, storageKey); }

  private static async writeLocal(storageKey: string, bytes: Buffer) {
    if (this.provider !== 'local') throw new Error('Storage externo ainda nao configurado. Use STORAGE_PROVIDER=local no MVP.');
    const fullPath = this.resolveLocalPath(storageKey);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, bytes);
  }

  private static cleanFileName(fileName: string) {
    return fileName.replace(/[^a-zA-Z0-9_.-]/g, '-');
  }
}
