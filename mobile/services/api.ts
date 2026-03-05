// Railway production backend; routes are mounted at root (no /api prefix)
// Must be HTTPS. Do not use localhost or process.env without fallback.
const BASE_URL = 'https://happinotes-production.up.railway.app';
const REQUEST_TIMEOUT_MS = 10000;

// ---------------------------------------------------------------------------
// Types (align with backend responses)
// ---------------------------------------------------------------------------

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  subscriptionActive: boolean;
  subscriptionExpiry: string | null;
}

export interface AuthResponse {
  success: true;
  token: string;
  user: ApiUser;
}

export interface ApiBook {
  _id: string;
  title: string;
  description: string;
  coverImage: string;
  audioUrl?: string;
  status: 'upcoming' | 'live';
  type: 'free' | 'premium';
  createdAt: string;
  updatedAt: string;
}

export interface ApiContent {
  _id: string;
  id?: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  language: string;
  type: 'free' | 'premium';
  status: 'draft' | 'coming_soon' | 'live';
  contentType: 'lifebook' | 'note' | 'silence';
  [key: string]: unknown;
}

export interface LifebookSection {
  title: string;
  description?: string;
  mediaUrl: string;
  mediaType: 'audio' | 'video';
}

export interface LifebookLesson extends LifebookSection {
  order: number;
}

export interface ContentDetail extends ApiContent {
  intro?: LifebookSection;
  lessons?: LifebookLesson[];
  conclusion?: LifebookSection;
}

export interface ContentByIdResponse {
  success: true;
  content: ContentDetail;
}

export interface ContentsResponse {
  success: true;
  contents: ApiContent[];
}

export interface BooksResponse {
  success: true;
  books: ApiBook[];
}

export interface MeResponse {
  success: true;
  user: ApiUser;
}

export interface CollectionResponse {
  success: true;
  collection: ApiBook[];
}

export interface ForgotPasswordResponse {
  message: string;
}

export interface VerifyOTPResponse {
  message: string;
}

export interface ResetPasswordResponse {
  message: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...init } = options;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  const data = await res.json().catch(() => ({}));
  const message = typeof data?.message === 'string' ? data.message : res.statusText;

  if (!res.ok) {
    throw new Error(message || `Request failed (${res.status})`);
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
}

export async function signup(
  name: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
    }),
  });
}

/** Public content API: Lifebooks — GET /contents?type=lifebook */
export async function getBooks(token?: string | null): Promise<ContentsResponse> {
  return request<ContentsResponse>('/contents?type=lifebook&status=live', {
    method: 'GET',
    token: token || undefined,
  });
}

/** Public content API: Notes — GET /contents?type=note */
export async function getNotes(token?: string | null): Promise<ContentsResponse> {
  return request<ContentsResponse>('/contents?type=note&status=live', {
    method: 'GET',
    token: token || undefined,
  });
}

/** Public content API: Silence — GET /contents?type=silence */
export async function getSilence(token?: string | null): Promise<ContentsResponse> {
  return request<ContentsResponse>('/contents?type=silence&status=live', {
    method: 'GET',
    token: token || undefined,
  });
}

/** GET /contents/:id — full content (lifebook intro/lessons/conclusion when allowed) */
export async function getContentById(
  id: string,
  token?: string | null
): Promise<ContentByIdResponse> {
  return request<ContentByIdResponse>(`/contents/${encodeURIComponent(id)}`, {
    method: 'GET',
    token: token || undefined,
  });
}

export interface AddToFavouritesResponse {
  success: true;
}

export interface FavouritesResponse {
  success: true;
  favourites: ApiContent[];
}

/** GET /favourites — list user's favourites (auth required) */
export async function getFavourites(token: string): Promise<FavouritesResponse> {
  return request<FavouritesResponse>('/favourites', {
    method: 'GET',
    token,
  });
}

/** POST /favourites/:contentId — add content to favourites (auth required) */
export async function addToFavourites(
  contentId: string,
  token: string
): Promise<AddToFavouritesResponse> {
  return request<AddToFavouritesResponse>(
    `/favourites/${encodeURIComponent(contentId)}`,
    {
      method: 'POST',
      token,
    }
  );
}

/** DELETE /favourites/:contentId — remove from favourites (auth required) */
export async function removeFromFavourites(
  contentId: string,
  token: string
): Promise<{ success: true }> {
  return request<{ success: true }>(
    `/favourites/${encodeURIComponent(contentId)}`,
    {
      method: 'DELETE',
      token,
    }
  );
}

export async function getMe(token: string): Promise<MeResponse> {
  return request<MeResponse>('/auth/me', {
    method: 'GET',
    token,
  });
}

export async function getCollection(token: string): Promise<CollectionResponse> {
  return request<CollectionResponse>('/collection', {
    method: 'GET',
    token,
  });
}

export async function forgotPassword(email: string): Promise<ForgotPasswordResponse> {
  const normalized = email.trim().toLowerCase();
  return request<ForgotPasswordResponse>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: normalized }),
  });
}

export async function verifyOTP(
  email: string,
  otp: string
): Promise<VerifyOTPResponse> {
  const normalized = email.trim().toLowerCase();
  return request<VerifyOTPResponse>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email: normalized, otp: otp.trim() }),
  });
}

export async function resetPassword(
  email: string,
  otp: string,
  newPassword: string
): Promise<ResetPasswordResponse> {
  const normalized = email.trim().toLowerCase();
  return request<ResetPasswordResponse>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({
      email: normalized,
      otp: otp.trim(),
      newPassword,
    }),
  });
}

export interface VerifyGoogleSubscriptionResponse {
  success: true;
  user: ApiUser;
}

export async function verifyGoogleSubscription(
  token: string,
  purchaseToken: string,
  productId: string
): Promise<VerifyGoogleSubscriptionResponse> {
  return request<VerifyGoogleSubscriptionResponse>('/payments/google/verify', {
    method: 'POST',
    token,
    body: JSON.stringify({ purchaseToken, productId }),
  });
}
