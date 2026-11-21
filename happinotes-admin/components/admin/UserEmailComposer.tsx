'use client';

import { Button, Input, ModalBody, ModalContent, ModalFooter, ModalHeader, Tooltip, addToast } from '@heroui/react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import TextAlign from '@tiptap/extension-text-align';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { apiRequest, uploadMultipart } from '@/lib/api';
import type { SecurityUser } from '@/lib/user-security';
import AdminModal from './AdminModal';

const extensions = [
  StarterKit.configure({ codeBlock: false, heading: { levels: [2, 3] }, horizontalRule: false, link: false, trailingNode: false }),
  TextAlign.configure({ types: ['paragraph', 'heading'], alignments: ['left', 'center', 'right'] }),
];
const iconPaths = {
  paragraph: 'M13 20V4H9a5 5 0 0 0 0 10h4M18 20V4h2M12 4h6',
  heading: 'M3 5v14M12 5v14M3 12h9M16 12a2.5 2.5 0 1 1 4 2l-4 5h5',
  subheading: 'M3 5v14M12 5v14M3 12h9M16 10h5l-3 4c4-1 4 6-1 5l-1-.5',
  left: 'M3 5h18M3 10h11M3 15h18M3 20h11',
  center: 'M3 5h18M7 10h10M3 15h18M7 20h10',
  right: 'M3 5h18M10 10h11M3 15h18M10 20h11',
  bold: 'M7 4h6a4 4 0 0 1 0 8H7Zm0 8h7a4 4 0 0 1 0 8H7Z',
  italic: 'M11 4h8M5 20h8M15 4l-6 16',
  underline: 'M6 4v7a6 6 0 0 0 12 0V4M4 21h16',
  strike: 'M17 6c-3-4-11-3-11 2 0 2 2 3 5 4M14 13c3 1 4 2 4 4 0 4-8 5-12 1M3 12h18',
  code: 'm8 8-4 4 4 4m8-8 4 4-4 4M14 5l-4 14',
  blockquote: 'M3 6h7v6c0 4-2 6-6 7l2-6H3ZM14 6h7v6c0 4-2 6-6 7l2-6h-3Z',
  bulletList: 'M9 6h12M9 12h12M9 18h12M4 6h.5M4 12h.5M4 18h.5',
  orderedList: 'M10 6h11M10 12h11M10 18h11M3 5l2-1v6M3 10h4M3 15c0-3 5-3 4 0l-4 5h4',
  clear: 'm9 16-3-3 9-9a2 2 0 0 1 3 0l3 3a2 2 0 0 1 0 3l-9 9H8l-4-4a2 2 0 0 1 0-3l2-2M12 19h9',
  undo: 'M9 5 4 10l5 5M4 10h10a6 6 0 0 1 6 6v3',
  redo: 'm15 5 5 5-5 5m5-5H10a6 6 0 0 0-6 6v3',
};

type Format = {
  icon: keyof typeof iconPaths;
  name: string;
  run: (editor: Editor) => boolean;
  active?: (editor: Editor) => boolean;
  available?: (editor: Editor) => boolean;
};

const formats: Format[] = [
  { icon: 'paragraph', name: 'Paragraph', run: e => e.chain().focus().setParagraph().run(), active: e => e.isActive('paragraph') },
  { icon: 'heading', name: 'Heading', run: e => e.chain().focus().setHeading({ level: 2 }).run(), active: e => e.isActive('heading', { level: 2 }) },
  { icon: 'subheading', name: 'Subheading', run: e => e.chain().focus().setHeading({ level: 3 }).run(), active: e => e.isActive('heading', { level: 3 }) },
  ...(['left', 'center', 'right'] as const).map(icon => ({
    icon, name: `Align ${icon}`,
    run: (e: Editor) => e.chain().focus().setTextAlign(icon).run(),
    active: (e: Editor) => (e.getAttributes('heading').textAlign || e.getAttributes('paragraph').textAlign || 'left') === icon,
  })),
  { icon: 'bold', name: 'Bold', run: e => e.chain().focus().toggleBold().run(), active: e => e.isActive('bold') },
  { icon: 'italic', name: 'Italic', run: e => e.chain().focus().toggleItalic().run(), active: e => e.isActive('italic') },
  { icon: 'underline', name: 'Underline', run: e => e.chain().focus().toggleUnderline().run(), active: e => e.isActive('underline') },
  { icon: 'strike', name: 'Strikethrough', run: e => e.chain().focus().toggleStrike().run(), active: e => e.isActive('strike') },
  { icon: 'code', name: 'Inline code', run: e => e.chain().focus().toggleCode().run(), active: e => e.isActive('code') },
  { icon: 'blockquote', name: 'Block quote', run: e => e.chain().focus().toggleBlockquote().run(), active: e => e.isActive('blockquote') },
  { icon: 'bulletList', name: 'Bulleted list', run: e => e.chain().focus().toggleBulletList().run(), active: e => e.isActive('bulletList') },
  { icon: 'orderedList', name: 'Numbered list', run: e => e.chain().focus().toggleOrderedList().run(), active: e => e.isActive('orderedList') },
  { icon: 'clear', name: 'Clear formatting', run: e => e.chain().focus().clearNodes().unsetAllMarks().unsetTextAlign().run() },
  { icon: 'undo', name: 'Undo', run: e => e.chain().focus().undo().run(), available: e => e.can().undo() },
  { icon: 'redo', name: 'Redo', run: e => e.chain().focus().redo().run(), available: e => e.can().redo() },
];

export default function UserEmailComposer({ user, onClose }: { user: Pick<SecurityUser, 'id' | 'name' | 'email'>; onClose: () => void }) {
  const [subject, setSubject] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);
  function chooseImage(file?: File) {
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type) || !file.size || file.size > 2 * 1024 * 1024) {
      setImage(null);
      setPreview('');
      setError('Choose a JPEG or PNG image up to 2 MB.');
      return;
    }
    setError('');
    setImage(file);
    setPreview(URL.createObjectURL(file));
  }
  const locked = useRef(false);
  const attempt = useRef<{ subject: string; message: string; html: string; requestId: string; image: File | null } | null>(null);

  const editor = useEditor({
    extensions,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: { role: 'textbox', 'aria-label': 'Message', 'aria-multiline': 'true',
        class: 'min-h-32 max-h-72 overflow-y-auto px-3 py-2 text-sm outline-none [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_p+p]:mt-2 [&_h2]:text-xl [&_h3]:text-lg [&_h2]:font-bold [&_h3]:font-semibold [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-content3 [&_code]:px-1 [&_code]:font-mono' },
    },
  });
  useEffect(() => { editor?.setEditable(!sending, false); }, [editor, sending]);
  const message = editor?.getText({ blockSeparator: '\n' }).trim() || '';
  const tooLong = message.length > 10000;

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = subject.trim();
    const body = message;
    if (locked.current || !editor || !title || (!body && !image) || tooLong) return;
    const html = editor.getHTML();
    locked.current = true;
    setSending(true);
    setError('');
    try {
      if (!attempt.current || attempt.current.subject !== title || attempt.current.message !== body || attempt.current.html !== html || attempt.current.image !== image) {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        const requestId = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
        attempt.current = { subject: title, message: body, html, requestId, image };
      }
      const { image: attachment, ...payload } = attempt.current;
      const endpoint = `/admin/user-security/${encodeURIComponent(user.id)}/email`;
      const token = localStorage.getItem('admin_token') || '';
      let result: { success: boolean };
      if (attachment) {
        const form = new FormData();
        for (const [key, value] of Object.entries(payload)) form.append(key, value);
        form.append('image', attachment);
        result = await uploadMultipart(endpoint, form, token);
      } else {
        result = await apiRequest(endpoint, 'POST', payload, token);
      }
      if (!result?.success) throw new Error('Email submission could not be confirmed.');
      addToast({ title: 'Email accepted for delivery', description: user.email, severity: 'success', timeout: 4000 });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Email could not be sent. Please try again.');
    } finally {
      locked.current = false;
      setSending(false);
    }
  }

  return <AdminModal isOpen size="lg" onClose={() => { if (!locked.current) onClose(); }} isDismissable={false}
    isKeyboardDismissDisabled={sending} hideCloseButton={sending} scrollBehavior="inside"
    classNames={{ base: 'admin-ui bg-content1 text-foreground' }}>
    <ModalContent>
      <ModalHeader>Send email</ModalHeader>
      <ModalBody>
        <form id="user-security-email" onSubmit={send} className="space-y-4">
          <p className="break-words text-sm text-default-600">To <strong>{user.name}</strong> &lt;{user.email}&gt;</p>
          <Input autoFocus label="Subject" value={subject} onValueChange={setSubject} maxLength={160} isRequired isDisabled={sending} />
          <div className="rounded-xl border border-divider bg-content2/50 focus-within:border-primary">
            <p className="px-3 pt-2 text-xs text-default-600">Message</p>
            <div role="group" aria-label="Message formatting" className="flex flex-wrap items-center gap-1 border-b border-divider px-2 py-1">
              {formats.map(format => {
                const active = editor ? format.active?.(editor) : undefined;
                return <Tooltip key={format.icon} content={format.name} delay={350} closeDelay={0}>
                  <Button data-own-tooltip isIconOnly size="sm" radius="sm" type="button"
                  variant={active ? 'flat' : 'light'} color={active ? 'primary' : 'default'}
                  aria-label={format.name} aria-pressed={active} className="size-10 min-w-10 sm:size-8 sm:min-w-8"
                  isDisabled={!editor || sending || (format.available && !format.available(editor))}
                  onMouseDown={event => event.preventDefault()} onPress={() => editor && format.run(editor)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                    <path d={iconPaths[format.icon]} />
                  </svg>
                  </Button>
                </Tooltip>;
              })}
            </div>
            <EditorContent editor={editor} />
          </div>
          <div className="space-y-2">
            <input ref={picker} type="file" aria-label="Email image" className="hidden" accept="image/jpeg,image/png" disabled={sending}
              onChange={event => { chooseImage(event.target.files?.[0]); event.target.value = ''; }} />
            {image && preview && <Image unoptimized src={preview} alt="Selected email image" width={480} height={240}
              className="max-h-40 w-full rounded-lg bg-content2 object-contain" />}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="flat" isDisabled={sending} onPress={() => picker.current?.click()}
                startContent={<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1.5" /><path d="m4 18 5-5 3 3 4-6 5 7" />
                </svg>}>{image ? 'Replace image' : 'Add image'}</Button>
              {image && <Button type="button" size="sm" variant="light" isDisabled={sending}
                onPress={() => { setImage(null); setPreview(''); setError(''); }}>Remove image</Button>}
              <span className="min-w-0 break-all text-xs text-default-600">{image ? image.name : 'JPEG or PNG · Up to 2 MB'}</span>
            </div>
          </div>
          {tooLong && <p role="alert" className="text-sm text-danger">Keep the message within 10,000 characters.</p>}
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        </form>
      </ModalBody>
      <ModalFooter>
        <Button variant="flat" isDisabled={sending} onPress={onClose}>Cancel</Button>
        <Button type="submit" form="user-security-email" color="primary" isLoading={sending}
          isDisabled={sending || !editor || !subject.trim() || (!message && !image) || tooLong}>Send email</Button>
      </ModalFooter>
    </ModalContent>
  </AdminModal>;
}
