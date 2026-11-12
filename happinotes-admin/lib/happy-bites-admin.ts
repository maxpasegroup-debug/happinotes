export type HappyBite = {
  _id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  audioUrl: string;
  durationSeconds: number;
  category: string;
  accessType: "free" | "premium";
  published: boolean;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
};
export type HappyBiteDraft = Omit<HappyBite, '_id' | 'createdAt' | 'updatedAt'> & { _id?: string };
export type UploadKind = 'thumbnail' | 'audio';
export const EMPTY_BITE: HappyBiteDraft = {
  title: '', description: '', thumbnailUrl: '', audioUrl: '', durationSeconds: 0,
  category: 'Mindfulness', accessType: 'free', published: false, displayOrder: 0,
};
export const BITE_CATEGORIES = ['Mindfulness', 'Personal growth', 'Positivity', 'Wellbeing', 'Relationships'];

export function validateBiteFile(kind: UploadKind, file: Pick<File, 'name' | 'type' | 'size'>): string | null {
  const image = kind === 'thumbnail';
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const extensions = image ? ['jpg', 'jpeg', 'png', 'webp'] : ['mp3'];
  const types = image ? ['image/jpeg', 'image/png', 'image/webp'] : ['audio/mpeg', 'audio/mp3', 'audio/x-mpeg'];
  if (!extensions.includes(extension) || (file.type && !types.includes(file.type.toLowerCase()))) {
    return image ? 'Choose a JPG, PNG or WebP image.' : 'Choose an MP3 audio file.';
  }
  if (!file.size) return 'This file is empty. Choose another file.';
  const limit = image ? 5 : 50;
  if (file.size > limit * 1024 * 1024) return `Choose a file smaller than or equal to ${limit} MB.`;
  return null;
}

export function validateBiteDraft(draft: HappyBiteDraft): string | null {
  if (draft.accessType !== "free" && draft.accessType !== "premium") return "Choose Free or Premium access.";
  if (!draft.title.trim() || !draft.description.trim() || !draft.category.trim()) return 'Add a title, description and category.';
  if (!draft.thumbnailUrl || !draft.audioUrl) return 'Upload a thumbnail and one audio file before saving.';
  if (!Number.isFinite(draft.durationSeconds) || draft.durationSeconds < 0) return 'Duration must be zero or a positive number.';
  if (!Number.isSafeInteger(draft.displayOrder) || draft.displayOrder < 0) return 'Display order must be a whole number of zero or higher.';
  return null;
}

export function uploadedAudioDuration(serverDuration?: number, detectedDuration?: number): number {
  for (const value of [serverDuration, detectedDuration]) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.round(value);
  }
  // Never carry a previous audio file's duration into its replacement.
  return 0;
}

export function formatBiteDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'Duration pending';
  const value = Math.floor(seconds);
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

export function detectAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement('audio');
    const url = URL.createObjectURL(file);
    let done = false;
    const finish = (value: number) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      audio.onloadedmetadata = null;
      audio.onerror = null;
      audio.removeAttribute('src');
      audio.load();
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timeout = setTimeout(() => finish(0), 8000);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => finish(uploadedAudioDuration(audio.duration));
    audio.onerror = () => finish(0);
    audio.src = url;
  });
}
