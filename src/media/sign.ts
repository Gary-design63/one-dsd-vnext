// =====================================================================
// One DSD vNext — media URL signer seam.
// Audio/object URLs are never exposed in pages. Instead pages link to an
// authenticated app route that, server-side, resolves the stored object URL
// and (when configured) mints a SHORT-LIVED signed URL before redirecting.
// Default is a Null signer (returns the stored URL unchanged) so there is no
// dependency until private storage + a signing key are configured. When the
// bucket is private, wire an Azure SAS / S3 presign here behind the same call.
// =====================================================================
export interface MediaSigner {
  sign(storageUrl: string, ttlSeconds: number): string;
}

const nullSigner: MediaSigner = { sign: (url) => url };
let signer: MediaSigner = nullSigner;

export function setMediaSigner(s: MediaSigner | null): void { signer = s ?? nullSigner; }

/** Resolve a deliverable URL for a stored object (short-lived when signed). */
export function signMediaUrl(storageUrl: string, ttlSeconds = 300): string {
  return signer.sign(storageUrl, ttlSeconds);
}
