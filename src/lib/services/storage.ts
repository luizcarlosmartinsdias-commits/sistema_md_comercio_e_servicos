import path from 'path';
import { mkdir, writeFile } from 'fs/promises';

export class StorageService {
  static provider = process.env.STORAGE_PROVIDER ?? 'local';
  static basePath = process.env.STORAGE_LOCAL_PATH ?? './uploads';

  static async save(file: File, folder: string) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const cleanName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '-');
    const storageKey = `${folder}/${Date.now()}-${cleanName}`;
    if (this.provider !== 'local') throw new Error('Storage externo ainda nao configurado. Use STORAGE_PROVIDER=local no MVP.');
    const fullPath = this.resolveLocalPath(storageKey);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, bytes);
    return { storageKey, fileName: file.name, mimeType: file.type || 'application/octet-stream', sizeBytes: bytes.length };
  }

  static resolveLocalPath(storageKey: string) { return path.resolve(this.basePath, storageKey); }
}
