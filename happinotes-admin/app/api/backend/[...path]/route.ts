import { forwardDevelopmentApi } from "@/lib/dev-api-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return forwardDevelopmentApi(
    request,
    path,
    process.env.NEXT_PUBLIC_API_BASE_URL || "https://happinotes-production-6b44.up.railway.app",
    process.env.NODE_ENV,
  );
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE, proxy as HEAD };
