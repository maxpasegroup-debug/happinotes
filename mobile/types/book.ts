export type BookLanguage = "english" | "malayalam" | "hindi";
export type BookCategory = "health" | "wealth" | "happiness" | "mindfulness";
export type BookAccessType = "free" | "premium";
export type BookStatus = "draft" | "upcoming" | "live";

export type Book = {
  _id: string;
  title: string;
  description: string;
  language: BookLanguage;
  category: BookCategory;
  coverImageUrl: string;
  coverPublicId?: string;
  introAudioUrl: string;
  introAudioPublicId?: string;
  introAudioFileName?: string;
  totalDurationSeconds: number;
  accessType: BookAccessType;
  status: BookStatus;
  isFeatured: boolean;
  isTrending: boolean;
  sortOrder: number;
  tags: string[];
};

export type Chapter = {
  _id: string;
  bookId: string;
  title: string;
  chapterNumber: number;
  description: string;
  audioUrl: string | null;
  durationSeconds: number;
  isFreePreview: boolean;
  locked?: boolean;
};
