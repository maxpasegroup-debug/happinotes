import { handleSecurityLookup } from '@/lib/user-security-lookup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleSecurityLookup(request, process.env.NEXT_PUBLIC_API_BASE_URL || 'https://happinotes-production-6b44.up.railway.app');
}
