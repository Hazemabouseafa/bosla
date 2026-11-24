import { BadRequestException } from '@nestjs/common';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MediaStorageService } from './media-storage.service';

describe('MediaStorageService path safety & playback tokens', () => {
  it('allows safe nested subpaths and blocks traversal or null bytes', () => {
    const storage = new MediaStorageService();
    const resolved = storage.resolveSafeSubpath(storage.hlsDir, 'asset-1/720p/index.m3u8');
    expect(resolved).toBe(path.resolve(storage.hlsDir, 'asset-1/720p/index.m3u8'));

    expect(() => storage.resolveSafeSubpath(storage.hlsDir, '../sources/secret.mp4')).toThrow(
      BadRequestException,
    );
    expect(() => storage.resolveSafeSubpath(storage.hlsDir, 'bad\0file.m3u8')).toThrow(
      BadRequestException,
    );
  });

  it('signs and verifies HLS playback tokens and rejects tampered or expired tokens', () => {
    const storage = new MediaStorageService();
    const futureExp = Math.floor(Date.now() / 1000) + 600;
    const validToken = storage.signPlaybackToken({
      userId: 'user-1',
      videoAssetId: 'asset-1',
      lessonId: 'lesson-1',
      exp: futureExp,
    });

    const verified = storage.verifyPlaybackToken(validToken);
    expect(verified).toEqual({
      userId: 'user-1',
      videoAssetId: 'asset-1',
      lessonId: 'lesson-1',
      exp: futureExp,
    });

    const [data, sig] = validToken.split('.');
    expect(storage.verifyPlaybackToken(`${data}tampered.${sig}`)).toBeNull();
    expect(storage.verifyPlaybackToken('malformed-token')).toBeNull();

    const expiredToken = storage.signPlaybackToken({
      userId: 'user-1',
      videoAssetId: 'asset-1',
      lessonId: 'lesson-1',
      exp: Math.floor(Date.now() / 1000) - 10,
    });
    expect(storage.verifyPlaybackToken(expiredToken)).toBeNull();
  });

  it('preserves sessionId & playbackSessionId in signed playback tokens and enforces allowed stream origins', () => {
    const storage = new MediaStorageService();
    const exp = Math.floor(Date.now() / 1000) + 120;
    const token = storage.signPlaybackToken({
      userId: 'user-9',
      videoAssetId: 'asset-9',
      lessonId: 'lesson-9',
      sessionId: 'sess-live-1',
      playbackSessionId: 'pbs-1',
      exp,
    });

    const verified = storage.verifyPlaybackToken(token);
    expect(verified?.sessionId).toBe('sess-live-1');
    expect(verified?.playbackSessionId).toBe('pbs-1');

    expect(storage.resolveSafeSubpath(storage.captionsDir, 'asset-9/ar.vtt')).toBe(
      path.resolve(storage.captionsDir, 'asset-9/ar.vtt'),
    );

    expect(
      storage.isOriginOrRefererAllowed({
        originHeader: 'https://evil-scraper.example',
        refererHeader: undefined,
        allowedOrigins: ['https://boslaagri.com', 'http://localhost:3000'],
      }),
    ).toBe(false);

    expect(
      storage.isOriginOrRefererAllowed({
        originHeader: 'http://localhost:3000',
        refererHeader: 'http://localhost:3000/learn/biosecurity',
        allowedOrigins: ['https://boslaagri.com', 'http://localhost:3000'],
      }),
    ).toBe(true);
  });
});
