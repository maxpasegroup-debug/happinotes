import { BASE_URL } from '@/lib/api';
import { searchPlayStore } from '@/lib/play-store-search';

export function GET(request: Request) {
  return searchPlayStore(request, BASE_URL, process.env.SERPER_API_KEY);
}
