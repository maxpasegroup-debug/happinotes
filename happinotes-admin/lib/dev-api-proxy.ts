/** Local development bridge; it never supplies credentials or bypasses API authorization. */
export async function forwardDevelopmentApi(
  request: Request,
  path: string[],
  backendUrl: string,
  nodeEnv: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  if (nodeEnv !== "development") return new Response(null, { status: 404 });
  if (!path.length || path.some((part) => !part || part === "." || part === ".." || /[/\\]/.test(part))) {
    return Response.json({ message: "Invalid API path." }, { status: 400 });
  }

  try {
    const target = new URL(`${backendUrl.replace(/\/+$/, "")}/${path.map(encodeURIComponent).join("/")}`);
    if (!["http:", "https:"].includes(target.protocol) || target.username || target.password) {
      throw new Error("Invalid backend configuration");
    }
    target.search = new URL(request.url).search;
    const headers = new Headers();
    // Do not forward the localhost Origin, Host, cookies, or spoofable forwarding
    // headers. The API continues to check the caller's bearer token as usual.
    for (const name of ["content-type", "authorization", "accept"]) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    const hasBody = request.method !== "GET" && request.method !== "HEAD";
    const options: RequestInit & { duplex: "half" } = {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      duplex: "half",
      cache: "no-store",
      redirect: "error",
      signal: path.join('/') === 'admin/contents/upload-happy-bite-audio'
        ? request.signal
        : AbortSignal.any([request.signal, AbortSignal.timeout(120_000)]),
    };
    const upstream = await fetcher(target, options);
    const responseHeaders = new Headers({ "Cache-Control": "no-store" });
    for (const name of ["content-type", "retry-after"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return Response.json(
      { message: "Cannot reach the backend. Check NEXT_PUBLIC_API_BASE_URL in .env.local and confirm the backend is running, then restart the admin dev server." },
      { status: 502 },
    );
  }
}
