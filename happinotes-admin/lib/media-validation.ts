const MAX_FILE_SIZE = 50 * 1024 * 1024;

export async function validateCoverFile(file: File): Promise<string | null> {
  if (file.size > MAX_FILE_SIZE) return "Cover images must be 50 MB or smaller.";
  const ext = file.name.split(".").pop()?.toLowerCase();
  const mimeByExt: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
  if (!ext || !mimeByExt[ext]) return "Choose a JPG, PNG, or WebP cover image.";
  if (file.type.toLowerCase() !== mimeByExt[ext]) return "The cover file extension and type do not match.";
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const valid = ext === "jpg" || ext === "jpeg"
    ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : ext === "png"
      ? bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value)
      : bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return valid ? null : "The selected cover file is not a valid image.";
}

export async function validateLessonFile(file: File): Promise<string | null> {
  if (file.size > MAX_FILE_SIZE) return "MP3 files must be 50 MB or smaller.";
  if (!file.name.toLowerCase().endsWith(".mp3")) return "Lesson audio must be an MP3 file. Executable and other file types are not allowed.";
  if (!["audio/mpeg", "audio/mp3", "audio/x-mpeg"].includes(file.type.toLowerCase())) return "The selected file is not identified as MP3 audio.";
  const bytes = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  const hasId3 = bytes.length >= 3 && String.fromCharCode(...bytes.slice(0, 3)) === "ID3";
  const hasFrame = bytes.some((value, index) => value === 0xff && index + 1 < bytes.length && (bytes[index + 1] & 0xe0) === 0xe0);
  return hasId3 || hasFrame ? null : "The selected lesson file does not contain valid MP3 audio data.";
}

export { MAX_FILE_SIZE };
