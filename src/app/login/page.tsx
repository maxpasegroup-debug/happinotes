\"use client\";

import { useState, FormEvent } from \"react\";
import { useRouter } from \"next/navigation\";
import { apiRequest } from \"@/lib/api\";

interface LoginResponse {
  token?: string;
  user?: {
    role?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(\"\");
  const [password, setPassword] = useState(\"\");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiRequest<LoginResponse>(\"/auth/login\", \"POST\", {
        email,
        password,
      });

      const token = res.token;
      const user = res.user;

      if (!user || user.role !== \"admin\") {
        setError(\"Access denied. Not an admin account.\");
        setLoading(false);
        return;
      }

      if (!token) {
        setError(\"Login response missing token.\");
        setLoading(false);
        return;
      }

      if (typeof window !== \"undefined\") {
        window.localStorage.setItem(\"admin_token\", token);
      }

      router.push(\"/dashboard\");
    } catch (err: any) {
      setError(err?.message || \"Failed to login.\");
      setLoading(false);
    }
  };

  return (
    <div className=\"min-h-screen flex items-center justify-center bg-gray-50 px-4\">
      <div className=\"w-full max-w-md bg-white shadow-sm rounded-lg border border-gray-200 p-8\">
        <h1 className=\"text-xl font-semibold text-gray-900 mb-2 text-center\">
          Admin Login
        </h1>
        <p className=\"text-sm text-gray-500 mb-6 text-center\">
          Sign in to manage Happinotes content.
        </p>

        <form onSubmit={handleSubmit} className=\"space-y-4\">
          <div>
            <label
              htmlFor=\"email\"
              className=\"block text-sm font-medium text-gray-700 mb-1\"
            >
              Email
            </label>
            <input
              id=\"email\"
              type=\"email\"
              autoComplete=\"email\"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className=\"block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none\"
            />
          </div>

          <div>
            <label
              htmlFor=\"password\"
              className=\"block text-sm font-medium text-gray-700 mb-1\"
            >
              Password
            </label>
            <input
              id=\"password\"
              type=\"password\"
              autoComplete=\"current-password\"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className=\"block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none\"
            />
          </div>

          {error && (
            <p className=\"text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2\">
              {error}
            </p>
          )}

          <button
            type=\"submit\"
            disabled={loading}
            className=\"w-full inline-flex justify-center items-center rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors\"
          >
            {loading ? \"Signing in...\" : \"Login\"}
          </button>
        </form>
      </div>
    </div>
  );
}

