import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FileStorageService {
  private readonly basePath: string;
  private readonly maxSizeMB: number;

  constructor(private readonly config: ConfigService) {
    this.basePath = config.get<string>('STORAGE_LOCAL_PATH', './uploads');
    this.maxSizeMB = config.get<number>('STORAGE_MAX_SIZE_MB', 50);
  }

  async save(file: Express.Multer.File, subfolder = ''): Promise<string> {
    const maxBytes = this.maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new BadRequestException(`File vượt quá ${this.maxSizeMB}MB`);
    }

    const folder = path.join(this.basePath, subfolder);
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }

    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    const filePath = path.join(folder, filename);

    fs.writeFileSync(filePath, file.buffer);

    return filePath;
  }

  delete(filePath: string): void {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  // Guidance bytes never use save()'s legacy path or a user-supplied path.
  private async privateGuidancePath(key: string) {
    if (!/^guidance\/[0-9a-f-]{36}$/.test(key)) throw new Error('Invalid private storage key');
    const root = path.resolve(this.basePath, '.private-guidance');
    await fs.promises.mkdir(root, { recursive: true, mode: 0o700 });
    const stat = await fs.promises.lstat(root);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Invalid private storage root');
    const real = await fs.promises.realpath(root);
    if (real.toLowerCase() !== root.toLowerCase()) throw new Error('Private storage root must not traverse symlinks');
    return path.join(root, key.slice('guidance/'.length));
  }
  async savePrivateGuidance(key: string, bytes: Buffer) {
    const target = await this.privateGuidancePath(key);
    const handle = await fs.promises.open(target, 'wx', 0o600);
    try { await handle.writeFile(bytes); await handle.sync(); }
    finally { await handle.close(); }
  }
  async readPrivateGuidance(key: string, maxBytes: number) {
    const target = await this.privateGuidancePath(key);
    const stat = await fs.promises.lstat(target);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maxBytes) throw new Error('Invalid private file');
    return fs.promises.readFile(target);
  }
  async deletePrivateGuidance(key: string) {
    const target = await this.privateGuidancePath(key);
    try {
      const stat = await fs.promises.lstat(target);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Invalid private file');
      await fs.promises.unlink(target);
    } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
  }
}
