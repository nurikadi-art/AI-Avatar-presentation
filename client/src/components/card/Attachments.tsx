import { useRef, type ChangeEvent } from 'react';
import type { AttachmentDto } from '@shared/types';
import { useToast } from '../ui/Toast';
import { useUploadAttachment, useDeleteAttachment } from '../../api/queries';

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function Attachments({
  boardId,
  cardId,
  attachments,
}: {
  boardId: string;
  cardId: string;
  attachments: AttachmentDto[];
}) {
  const toast = useToast();
  const upload = useUploadAttachment();
  const remove = useDeleteAttachment();
  const inputRef = useRef<HTMLInputElement>(null);

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast('File is too large (max 20 MB).');
      return;
    }
    upload.mutate({ cardId, boardId, file }, { onError: () => toast('Upload failed. Try again.') });
  }

  return (
    <div>
      <ul className="flex flex-col gap-1">
        {attachments.map((a) => (
          <li
            key={a.id}
            className="flex items-center gap-2 rounded-md border border-sand bg-paper px-2 py-1"
          >
            <a
              href={`/api/attachments/${a.id}`}
              className="flex-1 truncate text-sm text-rust hover:underline"
            >
              {a.filename}
            </a>
            <span className="text-xs text-latte">{formatSize(a.sizeBytes)}</span>
            <button
              type="button"
              aria-label={`Delete ${a.filename}`}
              onClick={() => remove.mutate({ attachmentId: a.id, cardId, boardId })}
              className="text-xs text-latte hover:text-red-700"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <input ref={inputRef} type="file" onChange={onPick} className="hidden" />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={upload.isPending}
        className="mt-2 rounded-md border border-sand px-3 py-1 text-sm text-rust hover:border-coral disabled:opacity-50"
      >
        {upload.isPending ? 'Uploading…' : '+ Add attachment'}
      </button>
    </div>
  );
}
