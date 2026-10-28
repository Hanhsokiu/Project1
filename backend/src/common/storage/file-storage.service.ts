import { Injectable, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class FileStorageService {
  private readonly basePath: string;
  private readonly maxSizeMB: number;

  constructor(private readonly config: ConfigService) {
    this.basePath = config.get<string>("STORAGE_LOCAL_PATH", "./uploads");
    this.maxSizeMB = config.get<number>("STORAGE_MAX_SIZE_MB", 50);
  }

  async save(file: Express.Multer.File, subfolder = ""): Promise<string> {
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

  // Separate private namespace: existing Step 8 methods and keys are unchanged.
  private async finalReportRoot() {
    const root = path.resolve(this.basePath, '.private-final-reports');
    await fs.promises.mkdir(root, { recursive: true, mode: 0o700 });
    const stat = await fs.promises.lstat(root);
    const real = await fs.promises.realpath(root);
    const normalize = (value: string) => process.platform === 'win32' ? value.toLowerCase() : value;
    if (stat.isSymbolicLink() || !stat.isDirectory() || normalize(real) !== normalize(root))
      throw new Error('Invalid private final report root');
    return root;
  }
  private async finalReportPath(key: string) {
    if (!/^final-reports\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(key))
      throw new Error('Invalid private final report key');
    return path.join(await this.finalReportRoot(), key.slice('final-reports/'.length));
  }
  async savePrivateFinalReport(key: string, bytes: Buffer) {
    const target = await this.finalReportPath(key);
    const handle = await fs.promises.open(target, 'wx', 0o600);
    try { await handle.writeFile(bytes); await handle.sync(); }
    finally { await handle.close(); }
  }
  async readPrivateFinalReport(key: string, maxBytes: number) {
    const target = await this.finalReportPath(key);
    const stat = await fs.promises.lstat(target);
    if (stat.isSymbolicLink() || !stat.isFile() || stat.size > maxBytes) throw new Error('Invalid private PDF');
    const handle = await fs.promises.open(target, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    try {
      const opened = await handle.stat();
      if (!opened.isFile() || opened.size !== stat.size || opened.size > maxBytes) throw new Error('Invalid private PDF');
      // Bound memory even if a local file grows after stat/open.
      const bytes = Buffer.alloc(opened.size);
      let offset = 0;
      while (offset < bytes.length) {
        const read = await handle.read(bytes, offset, bytes.length - offset, offset);
        if (!read.bytesRead) throw new Error('Private PDF was truncated');
        offset += read.bytesRead;
      }
      const extra = await handle.read(Buffer.alloc(1), 0, 1, offset);
      if (extra.bytesRead) throw new Error('Private PDF grew during read');
      return bytes;
    } finally { await handle.close(); }
  }
  async deletePrivateFinalReport(key: string) {
    const target = await this.finalReportPath(key);
    try {
      const stat = await fs.promises.lstat(target);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Invalid private PDF');
      await fs.promises.unlink(target);
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  async listPrivateFinalReports(after = '', limit = 200) {
    const root = await this.finalReportRoot();
    const names = (await fs.promises.readdir(root)).filter((name) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(name),
    ).sort().filter((name) => name > after).slice(0, limit);
    const entries: Array<{ key: string; modifiedAt: Date }> = [];
    for (const name of names) {
      try {
        const stat = await fs.promises.lstat(path.join(root, name));
        if (stat.isFile() && !stat.isSymbolicLink()) entries.push({ key: `final-reports/${name}`, modifiedAt: stat.mtime });
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
    return { entries, cursor: names.length === limit ? names[names.length - 1] : '' };
  }
}
