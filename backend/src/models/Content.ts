import mongoose, { Document, Schema } from 'mongoose';

export type ContentStatus = 'draft' | 'coming_soon' | 'live';
export type ContentType = 'free' | 'premium';
// Use 'silence' going forward; 'mindspace' is kept only for legacy data.
export type ContentKind = 'lifebook' | 'note' | 'silence';
export type MediaType = 'audio' | 'video';

// --- Lifebook nested types ---
export interface ILifebookSection {
  title: string;
  description: string;
  mediaUrl: string;
  mediaType: MediaType;
}

export interface ILesson extends ILifebookSection {
  order: number;
}

// --- Content document ---
export interface IContent extends Document {
  title: string;
  description: string;
  thumbnailUrl: string;
  language: string;
  type: ContentType;
  status: ContentStatus;
  contentType: ContentKind;
  // Lifebook
  intro?: ILifebookSection;
  lessons?: ILesson[];
  conclusion?: ILifebookSection;
  // Note / Silence
  mediaUrl?: string;
  mediaType?: MediaType;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

const lifebookSectionSchema = new Schema<ILifebookSection>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    mediaUrl: { type: String, required: true, trim: true },
    mediaType: { type: String, enum: ['audio', 'video'], required: true },
  },
  { _id: false }
);

const lessonSchema = new Schema<ILesson>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    mediaUrl: { type: String, required: true, trim: true },
    mediaType: { type: String, enum: ['audio', 'video'], required: true },
    order: { type: Number, required: true },
  },
  { _id: false }
);

const contentSchema = new Schema<IContent>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    thumbnailUrl: { type: String, required: true, trim: true },
    language: { type: String, required: true, trim: true },
    type: { type: String, enum: ['free', 'premium'], required: true },
    status: { type: String, enum: ['draft', 'coming_soon', 'live'], default: 'draft' },
    // Allow 'mindspace' for backward compatibility, but prefer 'silence' going forward.
    contentType: { type: String, enum: ['lifebook', 'note', 'silence', 'mindspace'], required: true },
    intro: { type: lifebookSectionSchema, required: false },
    lessons: { type: [lessonSchema], default: undefined },
    conclusion: { type: lifebookSectionSchema, required: false },
    mediaUrl: { type: String, trim: true },
    mediaType: { type: String, enum: ['audio', 'video'] },
    category: { type: String, trim: true },
  },
  { timestamps: true }
);

// Conditional validation: lifebook → intro + lessons + conclusion; note → mediaUrl + mediaType; silence (legacy mindspace) → mediaUrl + mediaType + category
contentSchema.pre('validate', function (next) {
  let kind = this.contentType as string;
  // Treat legacy 'mindspace' as 'silence'
  if (kind === 'mindspace') {
    kind = 'silence';
    this.contentType = 'silence';
  }
  if (kind === 'lifebook') {
    if (this.intro == null || typeof this.intro !== 'object') {
      return next(new Error('intro is required for contentType lifebook'));
    }
    if (!Array.isArray(this.lessons)) {
      this.lessons = [];
    }
    if (this.conclusion == null || typeof this.conclusion !== 'object') {
      return next(new Error('conclusion is required for contentType lifebook'));
    }
  }
  if (kind === 'note') {
    if (typeof this.mediaUrl !== 'string' || !this.mediaUrl.trim()) {
      return next(new Error('mediaUrl is required for contentType note'));
    }
    if (this.mediaType !== 'audio' && this.mediaType !== 'video') {
      return next(new Error('mediaType (audio|video) is required for contentType note'));
    }
  }
  if (kind === 'silence') {
    if (typeof this.mediaUrl !== 'string' || !this.mediaUrl.trim()) {
      return next(new Error('mediaUrl is required for contentType silence'));
    }
    if (typeof this.category !== 'string' || !this.category.trim()) {
      return next(new Error('category is required for contentType silence'));
    }
    if (this.mediaType !== 'audio' && this.mediaType !== 'video') {
      return next(new Error('mediaType (audio|video) is required for contentType silence'));
    }
  }
  next();
});

// Ensure legacy documents with contentType 'mindspace' are surfaced as 'silence' in queries.
contentSchema.post('init', function (doc: IContent & { contentType: string }) {
  if (doc.contentType === ('mindspace' as any)) {
    doc.contentType = 'silence';
  }
});

export const Content = mongoose.model<IContent>('Content', contentSchema);
