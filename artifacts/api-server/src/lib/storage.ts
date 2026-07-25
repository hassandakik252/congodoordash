import { mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

/**
 * File storage, provider-agnostic. `local` (default) writes to a directory that
 * the API serves statically at /uploads — works out of the box for dev and
 * self-hosting. Swap for S3 / Cloudinary / R2 by implementing StorageDriver and
 * selecting it via STORAGE_DRIVER. Used for product/store images and KYC docs.
 */
export interface StorageDriver {
  save(buffer: Buffer, ext: string, contentType: string): Promise<{ url: string; key: string }>;
}

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

class LocalStorage implements StorageDriver {
  constructor(private dir: string, private publicUrl: string) {
    mkdirSync(dir, { recursive: true });
  }
  async save(buffer: Buffer, ext: string): Promise<{ url: string; key: string }> {
    const key = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${ext}`;
    await writeFile(path.join(this.dir, key), buffer);
    return { url: `${this.publicUrl}/uploads/${key}`, key };
  }
}

export const UPLOAD_DIR = process.env["UPLOAD_DIR"] ?? path.join(process.cwd(), "uploads");

let driver: StorageDriver | null = null;

export function getStorage(): StorageDriver {
  if (driver) return driver;
  const name = process.env["STORAGE_DRIVER"] ?? "local";
  const publicUrl = (process.env["PUBLIC_URL"] ?? `http://localhost:${process.env["PORT"] ?? "8080"}`).replace(/\/$/, "");
  switch (name) {
    case "local":
      driver = new LocalStorage(UPLOAD_DIR, publicUrl);
      break;
    // case "s3": driver = new S3Storage(...); break;   // add cloud adapters here
    // case "cloudinary": driver = new CloudinaryStorage(...); break;
    default:
      throw new Error(`Unknown STORAGE_DRIVER "${name}"`);
  }
  return driver;
}
