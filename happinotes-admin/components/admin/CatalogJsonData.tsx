"use client";

import { Fragment, useMemo, useRef, useState, type ReactNode } from "react";
import { ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import AdminModal from "./AdminModal";
import { AdminButton } from "./ui";

export type CatalogLabel = "Life Book" | "Happy Bite";
export type CatalogRecord = { _id: string; title: string } & Record<string, unknown>;
type Path = (string | number)[];
type Selection = { item: CatalogRecord; path: Path; initial: string | number | boolean };
type Props = { label: CatalogLabel; items: CatalogRecord[]; onSave: (id: string, field: string, value: unknown, revision: unknown) => Promise<void> };

const bookFields = new Set(["title", "description", "thumbnailUrl", "language", "type", "priceInr", "status", "featured", "webDisplayOrder", "mobileDisplayOrder", "intro", "lessons", "conclusion"]);
const biteFields = new Set(["title", "description", "thumbnailUrl", "audioUrl", "durationSeconds", "category", "language", "accessType", "published", "displayOrder"]);
const sectionFields = new Set(["title", "description", "mediaUrl", "mediaType"]);
const lessonFields = new Set([...sectionFields, "accessType", "thumbnailUrl", "order"]);
const systemFields = new Set(["id", "_id", "_v", "__v", "createdAt", "updatedAt"]);

function canEdit(path: Path, label: CatalogLabel) {
  if (path.some(key => typeof key === "string" && systemFields.has(key))) return false;
  const field = String(path[0]);
  if (label === "Happy Bite") return path.length === 1 && biteFields.has(field);
  if (!bookFields.has(field)) return false;
  if (field === "lessons") return path.length === 3 && typeof path[1] === "number" && lessonFields.has(String(path[2]));
  if (field === "intro" || field === "conclusion") return path.length === 2 && sectionFields.has(String(path[1]));
  return path.length === 1;
}

function jsonNodes(value: unknown, path: Path, indent: number, label: CatalogLabel): ReactNode {
  if (value !== null && typeof value === "object") {
    const array = Array.isArray(value);
    const entries = Object.entries(value);
    const padding = " ".repeat(indent + 2);
    return <>{array ? "[" : "{"}{entries.map(([key, child], i) => (
      <Fragment key={key}>{i > 0 ? "," : ""}{"\n"}{padding}
        {!array && <><span className="text-sky-800 dark:text-sky-300">{JSON.stringify(key)}</span>{": "}</>}
        {jsonNodes(child, [...path, array ? Number(key) : key], indent + 2, label)}
      </Fragment>
    ))}{entries.length > 0 && "\n" + " ".repeat(indent)}{array ? "]" : "}"}</>;
  }
  const color = value === null ? "text-rose-800 dark:text-rose-300" : typeof value === "string"
    ? "text-emerald-800 dark:text-emerald-300" : typeof value === "boolean"
    ? "text-violet-800 dark:text-violet-300" : "text-amber-800 dark:text-amber-300";
  if (value === null || !canEdit(path, label)) return <span title="Read-only" className={color}>{JSON.stringify(value)}</span>;
  return <span role="button" tabIndex={0} data-path={JSON.stringify(path)} aria-label={`Edit ${path.join(".")}`}
    className={`${color} cursor-text rounded-sm hover:underline focus-visible:outline-primary`}>{JSON.stringify(value)}</span>;
}

function atPath(value: unknown, path: Path): unknown {
  return path.reduce<unknown>((current, key) => (current as Record<string, unknown>)[key], value);
}

export default function CatalogJsonData({ items, label, onSave }: Props) {
  const [edit, setEdit] = useState<Selection | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const lastTap = useRef<{ target: Element; time: number; x: number; y: number } | null>(null);
  const json = useMemo(() => items.map((item, i) => <Fragment key={item._id}>{i > 0 && ","}{"\n  "}
    <span data-item-id={item._id}>{jsonNodes(item, [], 2, label)}</span></Fragment>), [items, label]);

  function begin(target: EventTarget | null) {
    if (!(target instanceof Element)) return;
    const cell = target.closest<HTMLElement>("[data-path]");
    const id = cell?.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
    const item = items.find(item => item._id === id);
    if (!item || !cell?.dataset.path) return;
    const path: Path = JSON.parse(cell.dataset.path);
    if (!canEdit(path, label)) return;
    const initial = atPath(item, path);
    if (!(typeof initial === "string" || typeof initial === "number" || typeof initial === "boolean")) return;
    setEdit({ item, path, initial });
    setDraft(String(initial));
    setError("");
  }

  async function save() {
    if (!edit || saving) return;
    setError("");
    const field = String(edit.path[0]);
    const numeric = typeof edit.initial === "number";
    const flag = typeof edit.initial === "boolean";
    const value = numeric ? Number(draft) : flag ? draft === "true" : draft;
    if (numeric && (!draft.trim() || !Number.isFinite(value))) { setError("Enter a valid number."); return; }
    const key = edit.path[edit.path.length - 1];
    if (typeof value === "string" && ["title", "language", "mediaUrl", "category", "audioUrl"].includes(String(key)) && !value.trim()) {
      setError("Enter a value before saving."); return;
    }
    if (["mediaUrl", "thumbnailUrl", "audioUrl"].includes(String(key)) && typeof value === "string" &&
        (value || key === "mediaUrl" || edit.path.length === 1) && !/^(?:https?:\/\/[^\s/]+|\/?uploads\/[^\s]+)/i.test(value.trim())) {
      setError("Enter an HTTP(S) media URL or an uploads path."); return;
    }
    if (key === "mediaType" && value !== "audio" && value !== "video") { setError("Choose audio or video."); return; }
    if (label === "Happy Bite") {
      if ((field === "displayOrder" || field === "durationSeconds") && (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)) {
        setError("Enter a whole number of zero or higher."); return;
      }
      if (field === "accessType" && value !== "free" && value !== "premium") { setError("Enter free or premium."); return; }
      const limits: Record<string, number> = { title: 160, description: 2000, category: 80, language: 160, thumbnailUrl: 2048, audioUrl: 2048 };
      if (typeof value === "string" && limits[field] && (!value.trim() || value.trim().length > limits[field])) {
        setError(`Enter between 1 and ${limits[field]} characters.`); return;
      }
    }
    const current = items.find(item => item._id === edit.item._id);
    if (!current || JSON.stringify(current[field]) !== JSON.stringify(edit.item[field])) {
      setError("This field changed while you were editing. Cancel and reopen the current value."); return;
    }
    let update: unknown = value;
    if (edit.path.length > 1) {
      update = structuredClone(current[field]);
      const parent = atPath(update, edit.path.slice(1, -1)) as Record<string, unknown>;
      parent[edit.path[edit.path.length - 1]] = value;
    }
    setSaving(true);
    try {
      await onSave(current._id, field, update, current.updatedAt);
      setEdit(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this change. Try again.");
    } finally { setSaving(false); }
  }

  return <>
    {items.length > 0 && <p id="item-json-help" className="px-4 pt-3 text-xs text-default-500 sm:px-6">Double-click, double-tap, or press Enter on an editable value. IDs, version fields, and timestamps are read-only.</p>}
    <pre tabIndex={0} aria-label={`${label}s JSON data`} aria-describedby={items.length ? "item-json-help" : undefined}
      className="max-h-[68vh] touch-manipulation overflow-auto p-4 font-mono text-xs leading-6 text-foreground sm:p-6"
      onDoubleClick={e => begin(e.target)}
      onKeyDown={e => { if ((e.key === "Enter" || e.key === " ") && e.target instanceof Element && e.target.closest("[data-path]")) { e.preventDefault(); begin(e.target); } }}
      onPointerUp={e => {
        if (e.pointerType !== "touch" || !e.isPrimary || !(e.target instanceof Element)) return;
        const target = e.target.closest("[data-path]");
        const previous = lastTap.current;
        lastTap.current = null;
        if (!target) return;
        if (previous?.target === target && e.timeStamp - previous.time < 400 && Math.hypot(e.clientX - previous.x, e.clientY - previous.y) < 24) begin(target);
        else lastTap.current = { target, time: e.timeStamp, x: e.clientX, y: e.clientY };
      }} onPointerCancel={() => { lastTap.current = null; }}>
      <code>{"["}{json}{items.length ? "\n]" : "]"}</code>
    </pre>
    {edit && <AdminModal isOpen isDismissable={false} isKeyboardDismissDisabled={saving} hideCloseButton onClose={() => setEdit(null)}>
      <ModalContent>
        <ModalHeader>Edit JSON value</ModalHeader>
        <ModalBody>
          <label htmlFor="item-json-value" className="text-sm">{edit.item.title} · <code>{edit.path.join(".")}</code></label>
          {typeof edit.initial === "boolean" ? (
            <select id="item-json-value" autoFocus value={draft} disabled={saving} onChange={e => setDraft(e.target.value)} className="rounded-lg border border-divider bg-content1 p-3 font-mono"><option>true</option><option>false</option></select>
          ) : <textarea id="item-json-value" autoFocus value={draft} disabled={saving} rows={3} onChange={e => setDraft(e.target.value)}
            className="w-full rounded-lg border border-divider bg-content1 p-3 font-mono text-sm" />}
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        </ModalBody>
        <ModalFooter>
          <AdminButton disabled={saving} onPress={() => setEdit(null)}>Cancel</AdminButton>
          <AdminButton color="primary" disabled={saving || draft === String(edit.initial)} isLoading={saving} onPress={() => void save()}>Save</AdminButton>
        </ModalFooter>
      </ModalContent>
    </AdminModal>}
  </>;
}
