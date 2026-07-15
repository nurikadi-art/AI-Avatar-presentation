import { useRef, useState, type ChangeEvent } from 'react';
import type { CommentDto, UserPublic } from '@shared/types';
import { Avatar } from '../ui/Avatar';
import { useAddComment } from '../../api/queries';
import { splitMentions, getActiveMention, applyMention } from '../../lib/mentions';

function MentionText({ body, nameById }: { body: string; nameById: Map<string, string> }) {
  return (
    <>
      {splitMentions(body).map((seg, i) =>
        seg.type === 'text' ? (
          <span key={i}>{seg.value}</span>
        ) : (
          <span key={i} className="rounded bg-sun/30 px-1 font-medium text-rust">
            @{nameById.get(seg.userId) ?? 'unknown'}
          </span>
        ),
      )}
    </>
  );
}

export function Comments({
  boardId,
  cardId,
  comments,
  members,
}: {
  boardId: string;
  cardId: string;
  comments: CommentDto[];
  members: UserPublic[];
}) {
  const addComment = useAddComment();
  const [body, setBody] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nameById = new Map(members.map((m) => [m.id, m.name]));

  function refreshMention(el: HTMLTextAreaElement) {
    const active = getActiveMention(el.value, el.selectionStart ?? el.value.length);
    setMentionQuery(active ? active.query : null);
  }
  function onChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setBody(e.target.value);
    refreshMention(e.target);
  }
  function pickMention(userId: string) {
    const el = textareaRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? body.length;
    const next = applyMention(body, caret, userId);
    setBody(next.text);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(next.caret, next.caret);
    });
  }
  function submit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    addComment.mutate(
      { cardId, boardId, body: trimmed },
      {
        onSuccess: () => {
          setBody('');
          setMentionQuery(null);
        },
      },
    );
  }

  const matches =
    mentionQuery === null
      ? []
      : members
          .filter((m) => m.name.toLowerCase().includes(mentionQuery.toLowerCase()))
          .slice(0, 6);

  return (
    <div>
      <ul className="mb-4 flex flex-col gap-3">
        {comments.map((c) => {
          const author = members.find((m) => m.id === c.authorId);
          return (
            <li key={c.id} className="flex gap-2">
              <Avatar name={author?.name ?? '?'} color={author?.avatarColor ?? 'gray'} size={28} />
              <div className="flex-1">
                <div className="text-sm">
                  <span className="font-medium text-ink">{author?.name ?? 'Unknown'}</span>{' '}
                  <span className="text-xs text-latte">{new Date(c.createdAt).toLocaleString()}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-ink">
                  <MentionText body={c.body} nameById={nameById} />
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="relative">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={onChange}
          onKeyUp={(e) => refreshMention(e.currentTarget)}
          onClick={(e) => refreshMention(e.currentTarget)}
          placeholder="Write a comment… use @ to mention"
          rows={3}
          className="w-full rounded-md border border-sand bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-coral"
        />
        {matches.length > 0 && (
          <ul className="absolute left-0 top-full z-10 mt-1 w-56 rounded-md border border-sand bg-paper py-1 shadow-sm">
            {matches.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => pickMention(m.id)}
                  className="flex w-full items-center gap-2 px-2 py-1 text-left text-sm hover:bg-sand/40"
                >
                  <Avatar name={m.name} color={m.avatarColor} size={20} />
                  <span className="text-ink">{m.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={!body.trim() || addComment.isPending}
        className="mt-2 rounded-md bg-coral px-4 py-1.5 text-sm font-medium text-paper hover:bg-rust disabled:opacity-50"
      >
        {addComment.isPending ? 'Posting…' : 'Comment'}
      </button>
    </div>
  );
}
