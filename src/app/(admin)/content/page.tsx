"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

type ContentStatus = "draft" | "coming_soon" | "live";
type ContentType = "lifebook" | "note" | "silence";

interface ContentItem {
  _id: string;
  title: string;
  thumbnailUrl?: string;
  type: "free" | "premium";
  status: ContentStatus;
  contentType: ContentType;
}

interface GetContentsResponse {
  contents: ContentItem[];
}

const typeFilterOptions = [
  { value: "all", label: "All types" },
  { value: "lifebook", label: "Lifebook" },
  { value: "note", label: "Note" },
  { value: "silence", label: "Silence" },
] as const;

const statusFilterOptions = [
  { value: "all", label: "All statuses" },
  { value: "live", label: "Live" },
  { value: "coming_soon", label: "Coming soon" },
  { value: "draft", label: "Draft" },
] as const;

export default function AdminContentPage() {
  const router = useRouter();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<(typeof typeFilterOptions)[number]["value"]>(
    "all"
  );
  const [statusFilter, setStatusFilter] = useState<
    (typeof statusFilterOptions)[number]["value"]
  >("all");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchContents = async () => {
    try {
      setLoading(true);
      setError(null);

      const token =
        typeof window !== "undefined"
          ? window.localStorage.getItem("admin_token")
          : null;

      const res = await apiRequest<GetContentsResponse>(
        "/admin/contents?admin=true",
        "GET",
        undefined,
        token || undefined
      );

      setItems(res.contents || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load content.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (typeFilter !== "all" && item.contentType !== typeFilter) return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      return true;
    });
  }, [items, typeFilter, statusFilter]);

  const handleDelete = async (id: string) => {
    const confirmed = typeof window !== "undefined"
      ? window.confirm("Are you sure you want to delete this content?")
      : false;
    if (!confirmed) return;

    try {
      setActionLoadingId(id);
      const token =
        typeof window !== "undefined"
          ? window.localStorage.getItem("admin_token")
          : null;

      await apiRequest(`/admin/contents/${id}`, "DELETE", undefined, token || undefined);
      await fetchContents();
    } catch (err: any) {
      setError(err?.message || "Failed to delete content.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleTogglePublish = async (item: ContentItem) => {
    const newStatus: ContentStatus = item.status === "live" ? "draft" : "live";
    try {
      setActionLoadingId(item._id);
      const token =
        typeof window !== "undefined"
          ? window.localStorage.getItem("admin_token")
          : null;

      await apiRequest(
        `/admin/contents/${item._id}/status`,
        "PATCH",
        { status: newStatus },
        token || undefined
      );

      setItems((prev) =>
        prev.map((c) =>
          c._id === item._id
            ? {
                ...c,
                status: newStatus,
              }
            : c
        )
      );
    } catch (err: any) {
      setError(err?.message || "Failed to update status.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const statusBadgeClasses = (status: ContentStatus) => {
    if (status === "live") return "bg-green-100 text-green-800";
    if (status === "coming_soon") return "bg-yellow-100 text-yellow-800";
    return "bg-gray-100 text-gray-700";
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Content Management
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage lifebooks and other Happinotes content.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/(admin)/content/new")}
          className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          + Add Content
        </button>
      </header>

      <section className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(e.target.value as (typeof typeFilterOptions)[number]["value"])
              }
              className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              {typeFilterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as (typeof statusFilterOptions)[number]["value"]
                )
              }
              className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              {statusFilterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Content
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Premium
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-sm text-gray-500"
                  >
                    No content found.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {item.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.thumbnailUrl}
                            alt={item.title}
                            className="h-10 w-10 rounded-md object-cover bg-gray-100 flex-shrink-0"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                            N/A
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {item.title}
                          </div>
                          <div className="text-xs text-gray-500">
                            {item.contentType}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {item.type === "premium" ? "Premium" : "Free"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClasses(
                          item.status
                        )}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {item.type === "premium" ? (
                        <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
                          Premium
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                          Free
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/(admin)/content/${item._id}/edit`)
                          }
                          className="text-indigo-600 hover:text-indigo-800"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTogglePublish(item)}
                          disabled={actionLoadingId === item._id}
                          className="text-sm text-gray-700 hover:text-gray-900 disabled:opacity-60"
                        >
                          {item.status === "live" ? "Unpublish" : "Publish"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item._id)}
                          disabled={actionLoadingId === item._id}
                          className="text-sm text-red-600 hover:text-red-800 disabled:opacity-60"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

