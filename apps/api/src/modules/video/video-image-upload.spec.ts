import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { MediaStorageService } from './media-storage.service';
import { VideoService } from './video.service';

describe('VideoService cover image upload & resolution', () => {
  const tempRoot = path.join(os.tmpdir(), `bosla-img-test-${Date.now()}`);

  afterAll(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  });

  function createService() {
    process.env.MEDIA_ROOT = tempRoot;
    delete process.env.MEDIA_THUMBNAILS_DIR;
    const storage = new MediaStorageService();
    const auditMock = { log: async () => {} } as any;
    const service = new VideoService(
      {} as any,
      {} as any,
      storage,
      {} as any,
      auditMock,
      {} as any,
    );
    return { service, storage };
  }

  it('stores valid PNG image using UUID filename and resolves it safely', async () => {
    const { service } = createService();
    const pngBytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    ]);

    const uploaded = await service.uploadCoverImage({
      userId: 'admin-1',
      userRole: 'ADMIN',
      originalFilename: 'my-cover.png',
      buffer: pngBytes,
    });

    expect(uploaded.mimeType).toBe('image/png');
    expect(uploaded.filename).toMatch(/^cover-[a-f0-9-]+\.png$/i);
    expect(uploaded.url).toBe(`/api/v1/media/images/${uploaded.filename}`);

    const resolved = service.resolvePublicImage(uploaded.filename);
    expect(resolved.contentType).toBe('image/png');
    const diskBytes = await fs.readFile(resolved.absFile);
    expect(diskBytes.equals(pngBytes)).toBe(true);
  });

  it('rejects non-image payloads, oversized buffers, and invalid lookup filenames', async () => {
    const { service } = createService();

    await expect(
      service.uploadCoverImage({
        userId: 'admin-1',
        userRole: 'ADMIN',
        originalFilename: 'fake.png',
        buffer: Buffer.from('<script>alert(1)</script>'),
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.uploadCoverImage({
        userId: 'admin-1',
        userRole: 'ADMIN',
        originalFilename: 'empty.png',
        buffer: Buffer.alloc(0),
      }),
    ).rejects.toThrow(BadRequestException);

    expect(() => service.resolvePublicImage('../secret.jpg')).toThrow(NotFoundException);
    expect(() => service.resolvePublicImage('asset-thumb.jpg')).toThrow(NotFoundException);
  });
});
