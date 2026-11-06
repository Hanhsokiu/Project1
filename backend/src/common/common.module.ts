import { Global, Module } from "@nestjs/common";
import { AuditService } from "./audit/audit.service";
import { FileStorageService } from "./storage/file-storage.service";

@Global()
@Module({
  providers: [AuditService, FileStorageService],
  exports: [AuditService, FileStorageService],
})
export class CommonModule {}
