'use client';

import { Button, Progress } from '@heroui/react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import AudioPreview from './AudioPreview';
import { validateBiteFile, type UploadKind } from '@/lib/happy-bites-admin';

export type BiteUploadState = { name: string; percent: number; phase: 'selected' | 'uploading' | 'processing' | 'complete' | 'error'; error?: string };
type Props = {
  kind: UploadKind; url: string; title: string; durationSeconds?: number; disabled: boolean;
  state?: BiteUploadState;
  onSelect: (file?: File) => void;
  onUpload: (file: File) => Promise<boolean | void>;
};

export default function HappyBiteUpload({ kind, url, title, durationSeconds, disabled, state, onSelect, onUpload }: Props) {
  const [selection, setSelection] = useState<{ file: File; url: string } | null>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const localUrl = selection?.url;
  useEffect(() => () => { if (localUrl) URL.revokeObjectURL(localUrl); }, [localUrl]);
  const audio = kind === 'audio';
  const previewUrl = localUrl || url;
  const transferring = state?.phase === 'uploading' || state?.phase === 'processing';
  const select = (files: FileList | null) => {
    if (disabled || !files?.length) return;
    if (files.length !== 1) { setError('Choose one file at a time.'); return; }
    const file = files[0];
    const invalid = validateBiteFile(kind, file);
    if (invalid) { setError(invalid); return; }
    setError(''); setSelection({ file, url: URL.createObjectURL(file) }); onSelect(file);
  };
  const start = async () => {
    if (!selection || disabled) return;
    if (await onUpload(selection.file)) setSelection(null);
  };
  const message = state?.phase === 'error' ? state.error || 'Upload failed. Retry the selected file.'
    : state?.phase === 'processing' ? '100% transferred · finishing upload…'
      : state?.phase === 'complete' ? 'Upload complete · save your Happy Bite to keep the change.'
        : state?.phase === 'uploading' ? 'Uploading…' : '';
  return <div className={`min-w-0 border-2 border-dashed p-4 transition-colors sm:p-5 ${dragging ? 'border-primary bg-primary/10' : 'border-default-200 bg-transparent'}`}
    aria-label={`${audio ? 'Audio' : 'Thumbnail'} upload and preview`} aria-busy={transferring}
    onDragEnter={event => { event.preventDefault(); if (disabled) return; depth.current += 1; setDragging(true); }}
    onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = disabled ? 'none' : 'copy'; }}
    onDragLeave={event => { event.preventDefault(); depth.current = Math.max(0, depth.current - 1); if (!depth.current) setDragging(false); }}
    onDrop={event => { event.preventDefault(); depth.current = 0; setDragging(false); select(event.dataTransfer.files); }}>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="font-semibold">{audio ? 'Audio' : 'Thumbnail'} <span className="text-primary">*</span></h3><p className="mt-1 text-xs text-default-400">{audio ? 'MP3 · drag and drop or browse' : 'JPG, PNG or WebP · up to 5 MB'}</p></div>
      <Button size="sm" type="button" variant="flat" color="primary" isDisabled={disabled} onPress={() => input.current?.click()}>{previewUrl ? 'Replace file' : 'Browse files'}</Button>
    </div>
    <input ref={input} type="file" className="hidden" disabled={disabled} aria-label={audio ? 'Choose MP3 audio' : 'Choose thumbnail image'} accept={audio ? 'audio/mpeg,.mp3' : 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'} onChange={event => { select(event.target.files); event.currentTarget.value = ''; }} />
    {previewUrl ? audio ? <AudioPreview src={previewUrl} title={selection?.file.name || title || 'Attached audio'} durationSeconds={selection ? 0 : durationSeconds} />
      : <div className="relative aspect-square w-full overflow-hidden bg-content2"><Image unoptimized fill sizes="(max-width: 1024px) 100vw, 400px" src={previewUrl} alt="Happy Bite thumbnail preview" className="object-contain" /></div>
      : <button type="button" disabled={disabled} onClick={() => input.current?.click()} className="flex min-h-40 w-full flex-col items-center justify-center gap-3 px-4 py-8 text-center text-default-400 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed">
        <svg aria-hidden="true" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5" /></svg><span className="text-sm">Drop {audio ? 'an MP3' : 'an image'} here or choose a file</span><span className="text-xs">Preview it before uploading</span>
      </button>}
    {selection && <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="min-w-0 flex-1"><p className="truncate text-sm" title={selection.file.name}>{selection.file.name}</p><p className="mt-1 text-xs text-default-400">{(selection.file.size / 1024 / 1024).toFixed(1)} MB · {state?.phase === 'error' ? 'Selected file kept for retry' : 'Local preview · not saved yet'}</p></div><div className="flex gap-2"><Button size="sm" type="button" variant="light" isDisabled={disabled} onPress={() => { setSelection(null); setError(''); onSelect(); }}>Discard file</Button><Button size="sm" type="button" color="primary" isDisabled={disabled} isLoading={transferring} onPress={() => void start()}>{state?.phase === 'error' ? 'Retry upload' : transferring ? 'Uploading' : 'Upload file'}</Button></div></div>}
    {state && state.phase !== 'selected' && <div className="mt-4"><div className="flex items-center justify-between gap-3 text-xs"><span className="truncate text-default-400">{state.name}</span><span className="tabular-nums">{state.percent}%</span></div><Progress aria-label={`${audio ? 'Audio' : 'Image'} upload progress`} value={state.percent} size="sm" color={state.phase === 'error' ? 'danger' : state.phase === 'complete' ? 'success' : 'primary'} className="mt-2" /><p role={state.phase === 'error' ? 'alert' : 'status'} className={`mt-2 text-xs leading-5 ${state.phase === 'error' ? 'text-danger-300' : 'text-default-400'}`}>{message}</p></div>}
    {error && <p role="alert" className="mt-3 text-xs text-danger-300">{error}</p>}
    {selection && url && <p className="mt-3 text-xs text-default-400">The attached file remains unchanged until this upload succeeds and you save.</p>}
  </div>;
}
