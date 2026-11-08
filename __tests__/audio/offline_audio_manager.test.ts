/**
 * Offline Audio Manager Unit Tests
 * Master Plan Part 5 §6.7, §6.8, Part 4 §5.3
 */

import {
  OfflineAudioManager,
  type FileSystemDriver,
  type DownloadProgressCallback,
} from '../../src/audio/OfflineAudioManager';

class MockFileSystemDriver implements FileSystemDriver {
  public files = new Map<string, string>();
  public shouldFailDownload = false;
  public shouldCorruptDownload = false;
  public downloadAttempts = 0;
  public writeFailPath?: string;

  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  async readFileAsBase64(path: string): Promise<string> {
    const data = this.files.get(path);
    if (data === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return Buffer.from(data).toString('base64');
  }

  async writeFile(path: string, content: string | Uint8Array): Promise<void> {
    if (this.writeFailPath && path.includes(this.writeFailPath)) {
      throw new Error(`Disk I/O failure writing to ${path}`);
    }
    const str = typeof content === 'string' ? content : Buffer.from(content).toString('utf8');
    this.files.set(path, str);
  }

  async deleteFile(path: string): Promise<void> {
    this.files.delete(path);
  }

  async rename(srcPath: string, destPath: string): Promise<void> {
    const data = this.files.get(srcPath);
    if (data === undefined) {
      throw new Error(`Rename source not found: ${srcPath}`);
    }
    this.files.delete(srcPath);
    this.files.set(destPath, data);
  }

  async mkdir(_dirPath: string): Promise<void> {
    // In-memory directory creation
  }

  async downloadFile(
    _url: string,
    destPath: string,
    onProgress?: DownloadProgressCallback,
  ): Promise<void> {
    this.downloadAttempts++;

    if (this.shouldFailDownload) {
      throw new Error('Network timeout / connection aborted');
    }

    if (onProgress) {
      onProgress({ bytesDownloaded: 50, totalBytes: 100, fraction: 0.5 });
      onProgress({ bytesDownloaded: 100, totalBytes: 100, fraction: 1.0 });
    }

    const payload = this.shouldCorruptDownload ? 'corrupted-audio-content' : 'valid-audio-content';

    await this.writeFile(destPath, payload);
  }
}

describe('Offline Audio Manager', () => {
  let mockFs: MockFileSystemDriver;
  let manager: OfflineAudioManager;

  // Expected SHA-256 for base64 of 'valid-audio-content' (dmFsaWQtYXVkaW8tY29udGVudA==)
  // Crypto.digestStringAsync digests the base64 string
  let validExpectedHash: string;

  beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require('node:crypto');
    validExpectedHash = crypto.createHash('sha256').update('valid-audio-content').digest('hex');
  });

  beforeEach(() => {
    mockFs = new MockFileSystemDriver();
    manager = new OfflineAudioManager({
      storageDir: '/data/user/0/com.ember.app/files/audio',
      fsDriver: mockFs,
      maxRetries: 3,
      baseRetryDelayMs: 10,
    });
  });

  describe('Download & Atomic Installation', () => {
    it('downloads file, emits progress, verifies checksum, and installs atomically', async () => {
      const progressUpdates: number[] = [];
      const dest = await manager.downloadAsset(
        'https://assets.emberrest.app/voice/maya/test.ogg',
        'voice/maya/test.ogg',
        validExpectedHash,
        (p) => progressUpdates.push(p.fraction),
      );

      expect(dest).toBe('/data/user/0/com.ember.app/files/audio/voice/maya/test.ogg');
      expect(await manager.isAssetInstalled('voice/maya/test.ogg', validExpectedHash)).toBe(true);

      // Verify progress callbacks fired
      expect(progressUpdates).toContain(0.5);
      expect(progressUpdates).toContain(1.0);

      // Verify staging temp file was cleaned up
      const keys = Array.from(mockFs.files.keys());
      expect(keys.some((k) => k.includes('.tmp.'))).toBe(false);
    });

    it('rejects corrupted download and cleans up staging file without marking installed', async () => {
      mockFs.shouldCorruptDownload = true;

      await expect(
        manager.downloadAsset(
          'https://assets.emberrest.app/voice/maya/corrupted.ogg',
          'voice/maya/corrupted.ogg',
          validExpectedHash,
        ),
      ).rejects.toThrow(/Checksum mismatch/);

      // Incomplete/corrupted file must NEVER be marked as installed
      expect(await manager.isAssetInstalled('voice/maya/corrupted.ogg')).toBe(false);

      // Verify no staging files were left orphaned
      const keys = Array.from(mockFs.files.keys());
      expect(keys.some((k) => k.includes('.tmp.'))).toBe(false);
    });

    it('retries on network failure with exponential backoff up to maxRetries', async () => {
      mockFs.shouldFailDownload = true;

      await expect(
        manager.downloadAsset(
          'https://assets.emberrest.app/voice/maya/fail.ogg',
          'voice/maya/fail.ogg',
          validExpectedHash,
        ),
      ).rejects.toThrow(/after 3 attempts/);

      expect(mockFs.downloadAttempts).toBe(3);
    });
  });

  describe('Asset Management & Manifest Audit', () => {
    it('checks installation status accurately', async () => {
      expect(await manager.isAssetInstalled('voice/maya/rapid_reset_5.ogg')).toBe(false);

      mockFs.files.set(
        '/data/user/0/com.ember.app/files/audio/voice/maya/rapid_reset_5.ogg',
        'valid-audio-content',
      );

      expect(await manager.isAssetInstalled('voice/maya/rapid_reset_5.ogg')).toBe(true);
      expect(
        await manager.isAssetInstalled('voice/maya/rapid_reset_5.ogg', validExpectedHash),
      ).toBe(true);
      expect(await manager.isAssetInstalled('voice/maya/rapid_reset_5.ogg', 'wrong_hash')).toBe(
        false,
      );
    });

    it('deletes asset cleanly from app-private storage', async () => {
      const path = 'voice/maya/temp.ogg';
      mockFs.files.set('/data/user/0/com.ember.app/files/audio/voice/maya/temp.ogg', 'content');
      expect(await manager.isAssetInstalled(path)).toBe(true);

      await manager.deleteAsset(path);
      expect(await manager.isAssetInstalled(path)).toBe(false);
    });

    it('audits full manifest and removes corrupted files while preserving valid ones', async () => {
      // 1. Valid file
      mockFs.files.set('/data/user/0/com.ember.app/files/audio/valid.ogg', 'valid-audio-content');
      // 2. Corrupted file
      mockFs.files.set('/data/user/0/com.ember.app/files/audio/corrupted.ogg', 'tampered-bits');
      // 3. Missing file (not set)

      const manifest = [
        { relPath: 'valid.ogg', expectedSha256: validExpectedHash },
        { relPath: 'corrupted.ogg', expectedSha256: validExpectedHash },
        { relPath: 'missing.ogg', expectedSha256: validExpectedHash },
      ];

      const report = await manager.verifyAllInstalled(manifest);

      expect(report.valid).toEqual(['valid.ogg']);
      expect(report.corrupted).toEqual(['corrupted.ogg']);
      expect(report.missing).toEqual(['missing.ogg']);

      // Corrupted file was deleted
      expect(await manager.isAssetInstalled('corrupted.ogg')).toBe(false);
      // Valid file was preserved
      expect(await manager.isAssetInstalled('valid.ogg')).toBe(true);
    });
  });
});
