/**
 * Offline Audio Manager
 * Master Plan Part 5 §6.7, §6.8, Part 4 §5.3
 * Manages downloading, retry logic, integrity verification, app-private storage,
 * and offline asset resolution for voice and ambient audio.
 */

import * as Crypto from 'expo-crypto';

export interface DownloadProgress {
  bytesDownloaded: number;
  totalBytes: number;
  fraction: number;
}

export type DownloadProgressCallback = (progress: DownloadProgress) => void;

export interface FileSystemDriver {
  exists(path: string): Promise<boolean>;
  readFileAsBase64(path: string): Promise<string>;
  writeFile(path: string, content: string | Uint8Array): Promise<void>;
  deleteFile(path: string): Promise<void>;
  rename(srcPath: string, destPath: string): Promise<void>;
  mkdir(dirPath: string): Promise<void>;
  downloadFile(url: string, destPath: string, onProgress?: DownloadProgressCallback): Promise<void>;
}

export interface OfflineManagerOptions {
  storageDir: string;
  fsDriver?: FileSystemDriver;
  maxRetries?: number;
  baseRetryDelayMs?: number;
}

export class ChecksumMismatchError extends Error {
  constructor(
    public readonly expected: string,
    public readonly actual: string,
    public readonly path: string,
  ) {
    super(`Checksum mismatch for ${path}: expected ${expected}, got ${actual}`);
    this.name = 'ChecksumMismatchError';
  }
}

export class StorageWriteError extends Error {
  constructor(
    public readonly path: string,
    public readonly cause: unknown,
  ) {
    super(`Storage write error for ${path}: ${String(cause)}`);
    this.name = 'StorageWriteError';
  }
}

/**
 * Default Node/Fetch FileSystem Driver for test and runtime execution
 */
export class NodeFetchFileSystemDriver implements FileSystemDriver {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  private fs = require('node:fs/promises');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  private path = require('node:path');

  async exists(filePath: string): Promise<boolean> {
    try {
      await this.fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async readFileAsBase64(filePath: string): Promise<string> {
    const buf = await this.fs.readFile(filePath);
    return buf.toString('base64');
  }

  async writeFile(filePath: string, content: string | Uint8Array): Promise<void> {
    await this.fs.mkdir(this.path.dirname(filePath), { recursive: true });
    await this.fs.writeFile(filePath, content);
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      await this.fs.unlink(filePath);
    } catch {
      // Ignore if file already deleted
    }
  }

  async rename(srcPath: string, destPath: string): Promise<void> {
    await this.fs.mkdir(this.path.dirname(destPath), { recursive: true });
    await this.fs.rename(srcPath, destPath);
  }

  async mkdir(dirPath: string): Promise<void> {
    await this.fs.mkdir(dirPath, { recursive: true });
  }

  async downloadFile(
    url: string,
    destPath: string,
    onProgress?: DownloadProgressCallback,
  ): Promise<void> {
    await this.fs.mkdir(this.path.dirname(destPath), { recursive: true });

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Download failed with HTTP ${response.status}: ${response.statusText}`);
    }

    const totalBytes = Number(response.headers.get('content-length') || 0);
    const reader = response.body?.getReader();

    if (!reader) {
      const arrayBuffer = await response.arrayBuffer();
      await this.fs.writeFile(destPath, Buffer.from(arrayBuffer));
      if (onProgress) {
        onProgress({
          bytesDownloaded: arrayBuffer.byteLength,
          totalBytes: totalBytes || arrayBuffer.byteLength,
          fraction: 1.0,
        });
      }
      return;
    }

    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        receivedBytes += value.length;
        if (onProgress && totalBytes > 0) {
          onProgress({
            bytesDownloaded: receivedBytes,
            totalBytes,
            fraction: receivedBytes / totalBytes,
          });
        }
      }
    }

    const totalBuffer = Buffer.concat(chunks);
    await this.fs.writeFile(destPath, totalBuffer);
  }
}

export class OfflineAudioManager {
  private readonly storageDir: string;
  private readonly fs: FileSystemDriver;
  private readonly maxRetries: number;
  private readonly baseRetryDelayMs: number;

  constructor(options: OfflineManagerOptions) {
    this.storageDir = options.storageDir;
    this.fs = options.fsDriver ?? new NodeFetchFileSystemDriver();
    this.maxRetries = options.maxRetries ?? 3;
    this.baseRetryDelayMs = options.baseRetryDelayMs ?? 200;
  }

  /**
   * Resolves full local path for an asset in private storage.
   */
  resolveLocalPath(relPath: string): string {
    return `${this.storageDir}/${relPath}`.replace(/\/+/g, '/');
  }

  /**
   * Calculates SHA-256 for a local file in private storage.
   */
  async computeFileSha256(fullPath: string): Promise<string> {
    const base64 = await this.fs.readFileAsBase64(fullPath);
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodeCrypto = require('node:crypto');
      return nodeCrypto.createHash('sha256').update(Buffer.from(base64, 'base64')).digest('hex');
    } catch {
      return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base64);
    }
  }

  /**
   * Checks whether an asset is installed and optionally matches expected SHA-256.
   */
  async isAssetInstalled(relPath: string, expectedSha256?: string): Promise<boolean> {
    const fullPath = this.resolveLocalPath(relPath);
    const exists = await this.fs.exists(fullPath);
    if (!exists) return false;

    if (expectedSha256) {
      try {
        const actualHash = await this.computeFileSha256(fullPath);
        return actualHash.toLowerCase() === expectedSha256.toLowerCase();
      } catch {
        return false;
      }
    }

    return true;
  }

  /**
   * Downloads an asset with retry, staging, and atomic SHA-256 validation.
   */
  async downloadAsset(
    url: string,
    relPath: string,
    expectedSha256: string,
    onProgress?: DownloadProgressCallback,
  ): Promise<string> {
    const destPath = this.resolveLocalPath(relPath);
    const stagingPath = `${destPath}.tmp.${Date.now()}`;

    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.fs.downloadFile(url, stagingPath, onProgress);

        // Verify checksum of staging file
        const actualHash = await this.computeFileSha256(stagingPath);
        if (actualHash.toLowerCase() !== expectedSha256.toLowerCase()) {
          await this.fs.deleteFile(stagingPath);
          throw new ChecksumMismatchError(expectedSha256, actualHash, relPath);
        }

        // Atomic replacement
        await this.fs.rename(stagingPath, destPath);
        return destPath;
      } catch (err) {
        lastError = err;
        await this.fs.deleteFile(stagingPath);

        // If checksum mismatch, retrying may succeed if network was corrupted,
        // or fail if server corrupted. We apply exponential backoff.
        if (attempt < this.maxRetries) {
          const delay = this.baseRetryDelayMs * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `Failed to download ${relPath} after ${this.maxRetries} attempts: ${String(lastError)}`,
    );
  }

  /**
   * Deletes a downloaded asset from app-private storage.
   */
  async deleteAsset(relPath: string): Promise<void> {
    const destPath = this.resolveLocalPath(relPath);
    await this.fs.deleteFile(destPath);
  }

  /**
   * Audits all installed assets against a manifest, deleting any corrupted files.
   */
  async verifyAllInstalled(
    manifest: { relPath: string; expectedSha256: string }[],
  ): Promise<{ valid: string[]; corrupted: string[]; missing: string[] }> {
    const valid: string[] = [];
    const corrupted: string[] = [];
    const missing: string[] = [];

    for (const item of manifest) {
      const fullPath = this.resolveLocalPath(item.relPath);
      const exists = await this.fs.exists(fullPath);

      if (!exists) {
        missing.push(item.relPath);
        continue;
      }

      try {
        const hash = await this.computeFileSha256(fullPath);
        if (hash.toLowerCase() === item.expectedSha256.toLowerCase()) {
          valid.push(item.relPath);
        } else {
          corrupted.push(item.relPath);
          await this.fs.deleteFile(fullPath);
        }
      } catch {
        corrupted.push(item.relPath);
        await this.fs.deleteFile(fullPath);
      }
    }

    return { valid, corrupted, missing };
  }
}
