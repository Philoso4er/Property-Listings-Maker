// Helpers for the real-time MediaRecorder export pipeline.

/** Load an image fully (onload + decode) so it can be drawn immediately. */
const loadOnce = (src: string, cors: boolean): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    if (cors && !src.startsWith('blob:') && !src.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = async () => {
      try {
        if (img.decode) await img.decode();
      } catch {
        /* onload already fired; decode() can reject on some browsers for cached images */
      }
      if (img.naturalWidth > 0 && img.naturalHeight > 0) resolve(img);
      else reject(new Error(`Image has no dimensions: ${src.slice(0, 80)}`));
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${src.slice(0, 80)}`));
    img.src = src;
  });

/**
 * Load an image that is safe to draw on a canvas we record from.
 * Falls back to fetching the bytes into a blob: URL if the CORS image load fails.
 */
export async function loadDecodedImage(src: string): Promise<HTMLImageElement> {
  try {
    return await loadOnce(src, true);
  } catch (err) {
    if (src.startsWith('blob:') || src.startsWith('data:')) throw err;
    const res = await fetch(src, { mode: 'cors' });
    if (!res.ok) throw new Error(`Failed to fetch image (${res.status}): ${src.slice(0, 80)}`);
    const blobUrl = URL.createObjectURL(await res.blob());
    return loadOnce(blobUrl, false);
  }
}

export type ExportFormat = 'webm' | 'mp4';

const MP4_TYPES = [
  'video/mp4;codecs=avc1.42E01F,mp4a.40.2',
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4;codecs=avc1,opus',
  'video/mp4',
];
const WEBM_TYPES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

const supported = (t: string) =>
  typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t);

/** Choose a recorder mime type. Returns '' to let the browser pick. */
export function pickRecorderMimeType(format: ExportFormat): string {
  const order = format === 'mp4' ? [...MP4_TYPES, ...WEBM_TYPES] : WEBM_TYPES;
  return order.find(supported) || '';
}

export const canRecordMp4Natively = () => MP4_TYPES.some(supported);

/** Convert a WebM blob to MP4 (H.264/AAC) client-side with a lazily loaded ffmpeg.wasm. */
export async function convertWebmToMp4(
  webm: Blob,
  onProgress?: (ratio: number) => void
): Promise<Blob> {
  const [{ FFmpeg }, { fetchFile, toBlobURL }] = await Promise.all([
    import('@ffmpeg/ffmpeg'),
    import('@ffmpeg/util'),
  ]);
  const ffmpeg = new FFmpeg();
  if (onProgress) ffmpeg.on('progress', ({ progress }) => onProgress(Math.max(0, Math.min(1, progress))));
  const base = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  await ffmpeg.writeFile('in.webm', await fetchFile(webm));
  await ffmpeg.exec([
    '-i', 'in.webm',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k',
    '-movflags', '+faststart',
    'out.mp4',
  ]);
  const data = (await ffmpeg.readFile('out.mp4')) as Uint8Array;
  ffmpeg.terminate();
  return new Blob([data], { type: 'video/mp4' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** MediaRecorder WebM files have no duration header; patch it so players can seek. */
export async function fixWebmDuration(blob: Blob, durationMs: number): Promise<Blob> {
  try {
    const mod: any = await import('fix-webm-duration');
    const fn = mod.default || mod;
    return await fn(blob, durationMs, { logger: false });
  } catch (err) {
    console.warn('Could not patch WebM duration:', err);
    return blob;
  }
}
