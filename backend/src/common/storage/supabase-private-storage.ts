import { ConfigService } from "@nestjs/config";

// Used only behind FileStorageService. Never return a provider URL or a signed
// URL to callers: business services still authorize and verify each download.
export class SupabasePrivateStorage {
  private readonly origin: string;
  private readonly bucket: string;
  private readonly secret: string;

  constructor(config: ConfigService) {
    const endpoint = config.get<string>("STORAGE_SUPABASE_URL", "");
    let url: URL;
    try {
      url = new URL(endpoint);
    } catch {
      throw new Error("Private object storage configuration is invalid");
    }
    // Redirects are refused below as well, so credentials cannot follow them.
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== "/" && url.pathname !== "")
    )
      throw new Error("Private object storage configuration is invalid");
    this.origin = url.origin;
    this.bucket = config.get<string>("STORAGE_SUPABASE_BUCKET", "");
    this.secret = config.get<string>("STORAGE_SUPABASE_SERVICE_KEY", "");
    if (!/^[a-z0-9][a-z0-9_-]{0,62}$/.test(this.bucket) || !this.secret.trim())
      throw new Error("Private object storage configuration is incomplete");
  }

  private key(key: string) {
    if (
      !/^guidance\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
        key,
      )
    )
      throw new Error("Invalid private storage key");
    return key;
  }

  private async request(route: string, init: RequestInit = {}) {
    try {
      return await fetch(`${this.origin}/storage/v1/${route}`, {
        ...init,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        headers: {
          apikey: this.secret,
          Authorization: `Bearer ${this.secret}`,
          ...init.headers,
        },
      });
    } catch {
      // Do not expose provider errors, URLs, credentials or response bodies.
      throw new Error("Private object storage is unavailable");
    }
  }

  private async bounded(response: Response, maxBytes: number) {
    const length = response.headers.get("content-length");
    if (
      length !== null &&
      (!/^\d+$/.test(length) || Number(length) > maxBytes)
    ) {
      await response.body?.cancel();
      throw new Error("Invalid private file size");
    }
    if (!response.body) throw new Error("Invalid private file body");
    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) throw new Error("Invalid private file size");
        chunks.push(Buffer.from(value));
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Invalid private file size"
      )
        throw error;
      throw new Error("Private object could not be read");
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
    return Buffer.concat(chunks, total);
  }

  private async privateBucket() {
    // Fail closed if an operator accidentally made the selected bucket public.
    // Check on each operation, rather than caching an obsolete privacy setting.
    const response = await this.request(`bucket/${this.bucket}`);
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error("Private storage bucket is unavailable");
    }
    let bucket: { id?: unknown; public?: unknown };
    try {
      bucket = JSON.parse(
        (await this.bounded(response, 16_384)).toString("utf8"),
      );
    } catch {
      throw new Error("Private storage bucket metadata is invalid");
    }
    if (bucket.id !== this.bucket || bucket.public !== false)
      throw new Error("Private storage bucket must not be public");
  }

  async save(key: string, bytes: Buffer) {
    this.key(key);
    await this.privateBucket();
    const response = await this.request(`object/${this.bucket}/${key}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "x-upsert": "false",
      },
      body: new Uint8Array(bytes),
    });
    await response.body?.cancel();
    if (!response.ok)
      throw new Error("Private object could not be saved immutably");
  }

  async read(key: string, maxBytes: number) {
    this.key(key);
    if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0)
      throw new Error("Invalid private file size limit");
    await this.privateBucket();
    const response = await this.request(
      `object/authenticated/${this.bucket}/${key}`,
    );
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error("Private object is unavailable");
    }
    return this.bounded(response, maxBytes);
  }

  async delete(key: string) {
    this.key(key);
    await this.privateBucket();
    const response = await this.request(`object/${this.bucket}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: [key] }),
    });
    await response.body?.cancel();
    // The delete endpoint is idempotent for a missing object in an existing
    // bucket. Do not treat missing bucket/unauthorized as successful cleanup.
    if (!response.ok)
      throw new Error("Private object cleanup was not completed");
  }
}
