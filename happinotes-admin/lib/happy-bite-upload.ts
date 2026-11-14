export type AudioUploadTicket = {
  cloudName: string;
  apiKey: string;
  signature: string;
  params: { timestamp: number; public_id: string; overwrite: boolean; allowed_formats: string };
};
type ChunkResponse = { done?: boolean; secure_url?: string; public_id?: string; duration?: number; format?: string; error?: { message?: string } };
const CHUNK_BYTES = 6 * 1024 * 1024;

export class AudioUploadError extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable = false) { super(message); this.name = 'AudioUploadError'; this.retryable = retryable; }
}
function providerError(status: number, detail = '') {
  if (status === 413 || /file size too large|maximum file size|file.*exceeds.*size/i.test(detail)) return new AudioUploadError('Cloudinary rejected this file because it exceeds your account’s per-file audio/video limit. Increase that allowance before retrying. Happy Bites has no audio duration or size cap.');
  if (/quota|credits.*exceed|storage.*limit|usage.*limit/i.test(detail)) return new AudioUploadError('Cloudinary storage or usage allowance has been reached. Check the storage account before retrying.');
  if (status === 401 || status === 403 || /signature|timestamp|expired/i.test(detail)) return new AudioUploadError('Upload authorization expired or was rejected. Press Retry upload to request fresh authorization.');
  if (status === 429) return new AudioUploadError('Storage is receiving too many requests. Wait a moment, then retry.', true);
  if (status === 408 || status === 504 || /timeout|timed out/i.test(detail)) return new AudioUploadError('Storage timed out receiving this audio. Retry on a stable connection.', true);
  if (status >= 500) return new AudioUploadError(`Storage is temporarily unavailable (HTTP ${status}). Retry the upload.`, true);
  return new AudioUploadError(`Storage rejected the audio (HTTP ${status}). Check that the file is a valid MP3 and your Cloudinary audio/video allowance supports its size.`);
}

/** Upload one bounded slice at a time; never buffer or proxy the whole MP3. */
export async function uploadHappyBiteChunks(file: File, ticket: AudioUploadTicket, onProgress: (percent: number) => void, signal?: AbortSignal) {
  if (!file.size) throw new AudioUploadError('This file is empty. Choose another MP3.');
  if (!/^[a-zA-Z0-9_-]+$/.test(ticket.cloudName) || !ticket.apiKey || !ticket.signature || !ticket.params?.public_id?.startsWith('happinotes/happy-bites/audio/')) throw new AudioUploadError('The server returned invalid upload authorization. Update the backend and retry.');
  const uploadId = crypto.randomUUID();
  const endpoint = `https://api.cloudinary.com/v1_1/${ticket.cloudName}/video/upload`;
  let result: ChunkResponse | undefined;
  for (let offset = 0; offset < file.size; offset += CHUNK_BYTES) {
    const end = Math.min(offset + CHUNK_BYTES, file.size);
    const send = () => new Promise<ChunkResponse>((resolve, reject) => {
      if (signal?.aborted) { reject(new DOMException('Upload cancelled', 'AbortError')); return; }
      const xhr = new XMLHttpRequest();
      let settled = false;
      const abort = () => xhr.abort();
      const finish = (error?: Error, response?: ChunkResponse) => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener('abort', abort);
        if (error) reject(error); else resolve(response!);
      };
      xhr.open('POST', endpoint, true);
      // No app bearer token is sent to the storage provider.
      xhr.setRequestHeader('X-Unique-Upload-Id', uploadId);
      xhr.setRequestHeader('Content-Range', `bytes ${offset}-${end - 1}/${file.size}`);
      xhr.timeout = 600_000; // Per request, not a total file/duration limit.
      xhr.upload.onprogress = event => {
        if (!event.lengthComputable || !event.total) return;
        const sent = offset + (end - offset) * Math.min(1, event.loaded / event.total);
        onProgress(Math.min(99, Math.floor(sent / file.size * 100)));
      };
      xhr.upload.onload = () => { if (end === file.size) onProgress(100); };
      xhr.onerror = () => finish(new AudioUploadError('Network interrupted while uploading. Your selected file is kept; retry when connected.', true));
      xhr.ontimeout = () => finish(new AudioUploadError('This upload chunk timed out. Retry on a stable connection.', true));
      xhr.onabort = () => finish(new DOMException('Upload cancelled', 'AbortError'));
      xhr.onload = () => {
        let data: ChunkResponse = {};
        try { data = JSON.parse(xhr.responseText) || {}; } catch { /* Map proxy/provider errors below. */ }
        if (xhr.status < 200 || xhr.status >= 300 || data.error) { finish(providerError(xhr.status, data.error?.message)); return; }
        finish(undefined, data);
      };
      signal?.addEventListener('abort', abort, { once: true });
      const body = new FormData();
      for (const [key, value] of Object.entries(ticket.params)) body.append(key, String(value));
      body.append('api_key', ticket.apiKey);
      body.append('signature', ticket.signature);
      body.append('file', file.slice(offset, end, 'audio/mpeg'), file.name);
      try { xhr.send(body); } catch { finish(new AudioUploadError('Could not start the upload. Retry on a stable connection.', true)); }
    });
    // Retry transient failures twice with the same upload ID and byte range.
    for (let attempt = 0; ; attempt += 1) {
      try { result = await send(); break; }
      catch (error) {
        if (!(error instanceof AudioUploadError) || !error.retryable || attempt >= 2 || signal?.aborted) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
    if (end < file.size && result?.done !== false) throw new AudioUploadError('Storage returned an incomplete chunk acknowledgement. Retry the upload.');
    onProgress(end === file.size ? 100 : Math.floor(end / file.size * 100));
  }
  if (!result?.secure_url || result.public_id !== ticket.params.public_id || result.done === false || result.format !== 'mp3') throw new AudioUploadError('Storage did not confirm a completed MP3 upload. Retry the upload.');
  const url = new URL(result.secure_url);
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') throw new AudioUploadError('Storage returned an invalid audio URL.');
  return { url: result.secure_url, durationSeconds: typeof result.duration === 'number' && Number.isFinite(result.duration) ? Math.round(result.duration) : 0 };
}
