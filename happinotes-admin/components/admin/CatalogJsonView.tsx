"use client";

import { ModalBody, ModalContent, ModalHeader, Pagination, Tab, Tabs } from "@heroui/react";
import { mediaUrl } from "@/lib/api";
import Image from "next/image";
import { useMemo, useState } from "react";
import CatalogJsonData, { type CatalogLabel, type CatalogRecord } from "./CatalogJsonData";
import AdminModal from "@/components/admin/AdminModal";
import { AdminButton } from "@/components/admin/ui";



const actionPaths = {
  preview: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z M15 12a3 3 0 1 1-6 0 3 3 0 1 1 6 0Z",
  edit: "m15 5 4 4 M3 21l4.5-1 13-13a2.8 2.8 0 0 0-4-4l-13 13L3 21Z",
  delete: "M3 6h18 M9 6V3h6v3 M5 6l1 14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-14 M10 10v7 M14 10v7",
};

function ActionIcon({ name }: { name: keyof typeof actionPaths }) {
  return <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={actionPaths[name]} />
  </svg>;
}

type JsonViewProps<Item extends CatalogRecord> = {
  label: CatalogLabel;
  items: Item[];
  pageSize: number;
  busyId: string | null;
  onEdit: (item: Item) => void;
  onSaveValue: (id: string, field: string, value: unknown, revision: unknown) => Promise<void>;
  onDelete: (item: Item) => void;
};

function JsonCell({ field, value }: { field: string; value: unknown }) {
  if (field === "description" && typeof value === "string") {
    return <code title={value} className="block max-w-48 truncate sm:max-w-72">{JSON.stringify(value)}</code>;
  }
  if (value === undefined) return <span aria-label="Field absent" className="text-default-400">—</span>;
  if (typeof value === "object" && value !== null) {
    const summary = Array.isArray(value) ? `Array [${value.length}]` : `Object {${Object.keys(value).length}}`;
    return (
      <details>
        <summary className="cursor-pointer font-mono text-primary">{summary}</summary>
        <pre className="mt-2 max-h-64 min-w-48 overflow-auto rounded-lg bg-default-100 p-3">{JSON.stringify(value, null, 2)}</pre>
      </details>
    );
  }
  return <code className="block max-h-48 min-w-12 max-w-80 overflow-auto whitespace-pre-wrap break-words">{JSON.stringify(value)}</code>;
}

export default function CatalogJsonView<Item extends CatalogRecord>({ items, label, pageSize, busyId, onEdit, onDelete, onSaveValue }: JsonViewProps<Item>) {
  const [format, setFormat] = useState<"raw" | "table">("raw");
  const [preview, setPreview] = useState<{ src: string; title: string } | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pages);
  const start = (current - 1) * pageSize;
  const fields = useMemo(() => {
    const keys = new Set(items.flatMap(Object.keys));
    return ["title", "_id", ...Array.from(keys).filter(key => key !== "title" && key !== "_id")].filter(key => keys.has(key));
  }, [items]);

  return (
    <section aria-label={`${label}s JSON view`} className="min-w-0 overflow-hidden rounded-2xl border border-divider bg-content1">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-divider p-4">
        <Tabs aria-label="JSON format" size="sm" selectedKey={format} onSelectionChange={key => setFormat(key === "table" ? "table" : "raw")}>
          <Tab key="raw" title="JSON data" />
          <Tab key="table" title="JSON table" />
        </Tabs>
        <span className="text-sm text-default-500">{items.length} {label}{items.length === 1 ? "" : "s"}</span>
      </div>
      {format === "raw" ? (
        <CatalogJsonData label={label} items={items} onSave={onSaveValue} />
      ) : items.length === 0 ? (
        <p className="p-6 text-sm text-default-500">No {label}s to display.</p>
      ) : (
        <>
          <div tabIndex={0} role="region" aria-label="Scrollable JSON table" className="max-h-[65vh] overflow-auto">
            <table aria-label={`${label}s JSON fields`} className="w-full border-collapse text-left text-xs text-foreground">
              <thead className="sticky top-0 z-10 bg-default-100">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Actions</th>
                  {fields.map(field => <th scope="col" key={field} className="whitespace-nowrap px-4 py-3 font-mono font-medium">{field}</th>)}
                </tr>
              </thead>
              <tbody>
                {items.slice(start, start + pageSize).map(item => (
                  <tr key={item._id} className="border-t border-divider">
                    <td className="w-px px-4 py-3 align-top">
                      <div className="flex items-center gap-1">
                        <AdminButton isIconOnly variant="light" disabled={busyId !== null} aria-label={`Edit ${item.title}`} onPress={() => onEdit(item)}>
                          <ActionIcon name="edit" />
                        </AdminButton>
                        <AdminButton isIconOnly color="danger" variant="light" disabled={busyId !== null} isLoading={busyId === item._id} aria-label={`Delete ${item.title}`} onPress={() => onDelete(item)}>
                          <ActionIcon name="delete" />
                        </AdminButton>
                      </div>
                    </td>
                    {fields.map(field => {
                      const value = item[field];
                      const src = field === "thumbnailUrl" && typeof value === "string" ? mediaUrl(value) : undefined;
                      return <td key={field} className="px-4 py-3 align-top">
                        <JsonCell field={field} value={value} />
                        {src && /^https?:\/\//i.test(src) && <AdminButton isIconOnly variant="flat" color="primary" className="mt-2"
                          aria-label={`Preview thumbnail for ${item.title}`} onPress={() => {
                            setImageFailed(false);
                            setPreview({ src, title: item.title });
                          }}><ActionIcon name="preview" /></AdminButton>}
                      </td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider p-4">
            <span className="text-xs text-default-500">{label}s {start + 1}–{Math.min(start + pageSize, items.length)} of {items.length}</span>
            <Pagination aria-label="JSON table pagination" page={current} total={pages} onChange={setPage} showControls isCompact size="sm" siblings={0} boundaries={1} />
          </div>}
        </>
      )}
      {preview && <AdminModal isOpen onClose={() => setPreview(null)} size="lg" backdrop="blur">
        <ModalContent>
          <ModalHeader className="pr-12">Thumbnail preview · {preview.title}</ModalHeader>
          <ModalBody className="pb-6">
            {imageFailed ? <p role="status" className="py-8 text-center text-sm text-default-500">This thumbnail could not be loaded.</p> : (
              <div className="relative h-[min(60dvh,32rem)]">
                <Image fill unoptimized sizes="(max-width: 640px) 90vw, 480px" src={preview.src}
                  alt={`Thumbnail for ${preview.title}`} className="object-contain" onError={() => setImageFailed(true)} />
              </div>
            )}
          </ModalBody>
        </ModalContent>
      </AdminModal>}
    </section>
  );
}
