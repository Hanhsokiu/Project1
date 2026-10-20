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
}
