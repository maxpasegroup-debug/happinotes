"use client";

import type { LifebookItem } from "@/lib/content-api";

export type ContinueListeningItem = {
  id: string;
  title: string;
  thumbnailUrl?: string;
  progressPercent: number;
};

export type SeriesItem = {
  key: string;
  title: string;
  items: LifebookItem[];
};

export type LifebookActionHandlers = {
  onListen: (item: LifebookItem) => void;
  onToggleFavourite: (item: LifebookItem) => void;
  isFavourite: (itemId: string) => boolean;
};
