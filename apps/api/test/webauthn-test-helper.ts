import crypto from 'node:crypto';
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';

function pad32(b64u: string): Buffer {
  const buf = Buffer.from(b64u, 'base64url');
  if (buf.length === 32) return buf;
  if (buf.length > 32) return buf.subarray(buf.length - 32);
  const out = Buffer.alloc(32);
  buf.copy(out, 32 - buf.length);
  return out;
}

function encodeCborBytesHeader(len: number): Buffer {
  if (len <= 23) return Buffer.from([0x40 + len]);
  if (len <= 0xff) return Buffer.from([0x58, len]);
  const hdr = Buffer.alloc(3);
  hdr[0] = 0x59;
  hdr.writeUInt16BE(len, 1);
  return hdr;
}

function encodeCborText(text: string): Buffer {
  const bytes = Buffer.from(text, 'utf8');
  if (bytes.length <= 23) {
    return Buffer.concat([Buffer.from([0x60 + bytes.length]), bytes]);
  }
  return Buffer.concat([Buffer.from([0x78, bytes.length]), bytes]);
}

function encodeCborBytes(buf: Buffer): Buffer {
  return Buffer.concat([encodeCborBytesHeader(buf.length), buf]);
}

/**
 * Software FIDO2/WebAuthn P-256 authenticator for server-side cryptographic integration tests.
 * Produces genuine COSE EC2 public keys, CBOR attestation objects, and DER ECDSA assertions
 * verified by @simplewebauthn/server.
 */
export class TestPasskeyAuthenticator {
  readonly credentialIdRaw: Buffer;
  readonly credentialId: string;
  readonly privateKey: crypto.KeyObject;
  readonly publicKeyCose: Buffer;
  counter = 0;

  constructor() {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
    });
    const jwk = publicKey.export({ format: 'jwk' }) as { x: string; y: string };
    const x = pad32(jwk.x);
    const y = pad32(jwk.y);

    // CBOR map { 1: 2 (EC2), 3: -7 (ES256), -1: 1 (P-256), -2: x, -3: y }
    this.publicKeyCose = Buffer.concat([
      Buffer.from([0xa5]),
      Buffer.from([0x01, 0x02]), // kty: 2
      Buffer.from([0x03, 0x26]), // alg: -7
      Buffer.from([0x20, 0x01]), // crv: 1
      Buffer.from([0x21]),
      encodeCborBytes(x),
      Buffer.from([0x22]),
      encodeCborBytes(y),
    ]);

    this.privateKey = privateKey;
    this.credentialIdRaw = crypto.randomBytes(32);
    this.credentialId = this.credentialIdRaw.toString('base64url');
  }

  createRegistrationResponse(
    options: PublicKeyCredentialCreationOptionsJSON,
    origin = 'http://localhost:3000',
  ): RegistrationResponseJSON {
    this.counter += 1;
    const rpIdHash = crypto.createHash('sha256').update(options.rp.id).digest();
    const flags = Buffer.from([0x45]); // UP (0x01) | UV (0x04) | AT (0x40)
    const signCount = Buffer.alloc(4);
    signCount.writeUInt32BE(this.counter, 0);

    const aaguid = Buffer.alloc(16, 0);
    const credIdLen = Buffer.alloc(2);
    credIdLen.writeUInt16BE(this.credentialIdRaw.length, 0);

    const authData = Buffer.concat([
      rpIdHash,
      flags,
      signCount,
      aaguid,
      credIdLen,
      this.credentialIdRaw,
      this.publicKeyCose,
    ]);

    // AttestationObject CBOR map { "fmt": "none", "attStmt": {}, "authData": bstr }
    const attestationObject = Buffer.concat([
      Buffer.from([0xa3]),
      encodeCborText('fmt'),
      encodeCborText('none'),
      encodeCborText('attStmt'),
      Buffer.from([0xa0]),
      encodeCborText('authData'),
      encodeCborBytes(authData),
    ]);

    const clientDataJSON = Buffer.from(
      JSON.stringify({
        type: 'webauthn.create',
        challenge: options.challenge,
        origin,
        crossOrigin: false,
      }),
      'utf8',
    );

    return {
      id: this.credentialId,
      rawId: this.credentialId,
      type: 'public-key',
      authenticatorAttachment: 'platform',
      clientExtensionResults: {},
      response: {
        clientDataJSON: clientDataJSON.toString('base64url'),
        attestationObject: attestationObject.toString('base64url'),
        transports: ['internal'],
      },
    };
  }

  createAuthenticationResponse(
    options: PublicKeyCredentialRequestOptionsJSON,
    origin = 'http://localhost:3000',
  ): AuthenticationResponseJSON {
    this.counter += 1;
    const rpIdHash = crypto
      .createHash('sha256')
      .update(options.rpId || 'localhost')
      .digest();
    const flags = Buffer.from([0x05]); // UP | UV
    const signCount = Buffer.alloc(4);
    signCount.writeUInt32BE(this.counter, 0);

    const authData = Buffer.concat([rpIdHash, flags, signCount]);

    const clientDataJSON = Buffer.from(
      JSON.stringify({
        type: 'webauthn.get',
        challenge: options.challenge,
        origin,
        crossOrigin: false,
      }),
      'utf8',
    );
    const clientDataHash = crypto.createHash('sha256').update(clientDataJSON).digest();

    const signer = crypto.createSign('SHA256');
    signer.update(Buffer.concat([authData, clientDataHash]));
    const signature = signer.sign(this.privateKey);

    return {
      id: this.credentialId,
      rawId: this.credentialId,
      type: 'public-key',
      authenticatorAttachment: 'platform',
      clientExtensionResults: {},
      response: {
        clientDataJSON: clientDataJSON.toString('base64url'),
        authenticatorData: authData.toString('base64url'),
        signature: signature.toString('base64url'),
      },
    };
  }
}
