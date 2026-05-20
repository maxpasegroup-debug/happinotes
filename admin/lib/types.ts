export type Book = {
  _id: string;
  title: string;
  description: string;
  language: 'english' | 'malayalam' | 'hindi';
  category: 'health' | 'wealth' | 'happiness' | 'mindfulness';
  coverImageUrl: string;
  coverPublicId: string;
  introAudioUrl: string;
  introAudioPublicId: string;
  totalDurationSeconds: number;
  accessType: 'free' | 'premium';
  status: 'draft' | 'upcoming' | 'live';
  isFeatured: boolean;
  isTrending: boolean;
  sortOrder: number;
  tags: string[];
  chaptersCount?: number;
};

export type Chapter = {
  _id: string;
  title: string;
  chapterNumber: number;
  description: string;
  audioUrl: string;
  audioPublicId: string;
  durationSeconds: number;
  isFreePreview: boolean;
};

export type User = {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  subscriptionStatus: 'free' | 'premium' | 'lifetime';
  subscriptionExpiry: string | null;
  createdAt: string;
};

export type Payment = {
  _id: string;
  planId: string;
  amountINR: number;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  createdAt: string;
  userId?: { name?: string; email?: string };
};

export type Offer = {
  _id: string;
  code?: string;
  discountPercent: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  appliesToPlan: 'monthly' | 'yearly' | 'lifetime' | 'all';
};
