import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Me,
  BoardSummary,
  BoardDetail,
  CardDto,
  CommentDto,
  AttachmentDto,
  ActivityDto,
  NotificationDto,
  SearchResult,
  Id,
  ListDto,
  UserPublic,
  Visibility,
  LabelColor,
} from '@shared/types';
import { api } from './client';

export type CardDetailDto = CardDto & {
  comments: CommentDto[];
  attachments: AttachmentDto[];
  activity: ActivityDto[];
};

export const qk = {
  me: ['me'] as const,
  boards: ['boards'] as const,
  board: (id: Id) => ['board', id] as const,
  card: (id: Id) => ['card', id] as const,
  notifications: ['notifications'] as const,
  search: (q: string) => ['search', q] as const,
};

export function useMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: () => api<Me>('/auth/me'),
    retry: false,
    staleTime: Infinity,
  });
}

export function useBoards() {
  return useQuery({
    queryKey: qk.boards,
    queryFn: () => api<BoardSummary[]>('/boards'),
  });
}

export function useBoard(boardId: Id) {
  return useQuery({
    queryKey: qk.board(boardId),
    queryFn: () => api<BoardDetail>(`/boards/${boardId}`),
  });
}

export function useCard(cardId: Id) {
  return useQuery({
    queryKey: qk.card(cardId),
    queryFn: () => api<CardDetailDto>(`/cards/${cardId}`),
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: qk.notifications,
    queryFn: () => api<NotificationDto[]>('/notifications'),
    refetchInterval: 60000,
  });
}

export function useSearch(q: string) {
  return useQuery({
    queryKey: qk.search(q),
    queryFn: () => api<SearchResult[]>(`/search?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length > 0,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      api<Me>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (me) => qc.setQueryData(qk.me, me),
  });
}

export function useAcceptInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { token: string; name: string; password: string }) =>
      api<Me>('/auth/accept-invite', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (me) => qc.setQueryData(qk.me, me),
  });
}

export function useResetPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { token: string; password: string }) =>
      api<Me>('/auth/reset-password', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (me) => qc.setQueryData(qk.me, me),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    onSuccess: () => qc.clear(),
  });
}

export function useCreateBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; visibility: Visibility; accentColor: LabelColor }) =>
      api<BoardDetail>('/boards', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['boards'] }),
  });
}

export function useToggleStar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { boardId: string; starred: boolean }) =>
      api<void>(`/boards/${input.boardId}/star`, {
        method: 'POST',
        body: JSON.stringify({ starred: input.starred }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['boards'] }),
  });
}

// ---- Section 10: board page queries & mutations ----

export interface ArchivedItems {
  lists: ListDto[];
  cards: CardDto[];
}

export function usePatchBoard(boardId: Id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string; visibility?: Visibility; accentColor?: LabelColor }) =>
      api<void>(`/boards/${boardId}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.board(boardId) });
      qc.invalidateQueries({ queryKey: qk.boards });
    },
  });
}

export function useSetBoardStar(boardId: Id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (starred: boolean) =>
      api<void>(`/boards/${boardId}/star`, { method: 'POST', body: JSON.stringify({ starred }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.board(boardId) });
      qc.invalidateQueries({ queryKey: qk.boards });
    },
  });
}

export function useArchiveBoard(boardId: Id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/boards/${boardId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.boards }),
  });
}

export function useAddBoardMember(boardId: Id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: Id) =>
      api<void>(`/boards/${boardId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.board(boardId) }),
  });
}

export function useRemoveBoardMember(boardId: Id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: Id) =>
      api<void>(`/boards/${boardId}/members/${userId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.board(boardId) }),
  });
}

export function useCreateList(boardId: Id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api<ListDto>(`/boards/${boardId}/lists`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.board(boardId) }),
  });
}

export function usePatchList(boardId: Id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { listId: Id; name?: string; position?: string }) =>
      api<void>(`/lists/${input.listId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: input.name, position: input.position }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.board(boardId) }),
  });
}

export function useArchiveList(boardId: Id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (listId: Id) => api<void>(`/lists/${listId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.board(boardId) }),
  });
}

export function useCreateCard(boardId: Id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { listId: Id; title: string }) =>
      api<CardDto>(`/lists/${input.listId}/cards`, {
        method: 'POST',
        body: JSON.stringify({ title: input.title }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.board(boardId) }),
  });
}

export function useMoveCard(boardId: Id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { cardId: Id; listId: Id; position: string }) =>
      api<void>(`/cards/${input.cardId}`, {
        method: 'PATCH',
        body: JSON.stringify({ listId: input.listId, position: input.position }),
      }),
    onError: () => qc.invalidateQueries({ queryKey: qk.board(boardId) }),
  });
}

export function useMoveList(boardId: Id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { listId: Id; position: string }) =>
      api<void>(`/lists/${input.listId}`, {
        method: 'PATCH',
        body: JSON.stringify({ position: input.position }),
      }),
    onError: () => qc.invalidateQueries({ queryKey: qk.board(boardId) }),
  });
}

export function useArchivedItems(boardId: Id, enabled: boolean) {
  return useQuery({
    queryKey: ['board', boardId, 'archived'] as const,
    queryFn: () => api<ArchivedItems>(`/boards/${boardId}/archived`),
    enabled,
  });
}

export function useRestoreArchived(boardId: Id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { entity: 'list' | 'card'; id: Id }) =>
      api<void>(`/boards/${boardId}/restore`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.board(boardId) });
      qc.invalidateQueries({ queryKey: ['board', boardId, 'archived'] });
    },
  });
}

export function useDirectory() {
  return useQuery({
    queryKey: ['directory'] as const,
    queryFn: async () => {
      const res = await api<{ members: UserPublic[] } | UserPublic[]>('/admin/members');
      return Array.isArray(res) ? res : res.members;
    },
  });
}

// ---- Section 11: card/label/notification mutation hooks ----

export function usePatchCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      cardId: string;
      boardId: string;
      patch: {
        title?: string;
        description?: string;
        dueDate?: string | null;
        listId?: string;
        position?: string;
      };
    }) => api<void>(`/cards/${input.cardId}`, { method: 'PATCH', body: JSON.stringify(input.patch) }),
    onSuccess: (_d, input) => {
      qc.invalidateQueries({ queryKey: qk.card(input.cardId) });
      qc.invalidateQueries({ queryKey: qk.board(input.boardId) });
    },
  });
}

export function useArchiveCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { cardId: string; boardId: string }) =>
      api<void>(`/cards/${input.cardId}`, { method: 'DELETE' }),
    onSuccess: (_d, input) => {
      qc.invalidateQueries({ queryKey: qk.board(input.boardId) });
    },
  });
}

export function useAddAssignee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { cardId: string; boardId: string; userId: string }) =>
      api<void>(`/cards/${input.cardId}/assignees`, {
        method: 'POST',
        body: JSON.stringify({ userId: input.userId }),
      }),
    onSuccess: (_d, input) => {
      qc.invalidateQueries({ queryKey: qk.card(input.cardId) });
      qc.invalidateQueries({ queryKey: qk.board(input.boardId) });
    },
  });
}

export function useRemoveAssignee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { cardId: string; boardId: string; userId: string }) =>
      api<void>(`/cards/${input.cardId}/assignees/${input.userId}`, { method: 'DELETE' }),
    onSuccess: (_d, input) => {
      qc.invalidateQueries({ queryKey: qk.card(input.cardId) });
      qc.invalidateQueries({ queryKey: qk.board(input.boardId) });
    },
  });
}

export function useAddCardLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { cardId: string; boardId: string; labelId: string }) =>
      api<void>(`/cards/${input.cardId}/labels`, {
        method: 'POST',
        body: JSON.stringify({ labelId: input.labelId }),
      }),
    onSuccess: (_d, input) => {
      qc.invalidateQueries({ queryKey: qk.card(input.cardId) });
      qc.invalidateQueries({ queryKey: qk.board(input.boardId) });
    },
  });
}

export function useRemoveCardLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { cardId: string; boardId: string; labelId: string }) =>
      api<void>(`/cards/${input.cardId}/labels/${input.labelId}`, { method: 'DELETE' }),
    onSuccess: (_d, input) => {
      qc.invalidateQueries({ queryKey: qk.card(input.cardId) });
      qc.invalidateQueries({ queryKey: qk.board(input.boardId) });
    },
  });
}

export function useCreateLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { boardId: string; name: string; color: string }) =>
      api<void>(`/boards/${input.boardId}/labels`, {
        method: 'POST',
        body: JSON.stringify({ name: input.name, color: input.color }),
      }),
    onSuccess: (_d, input) => qc.invalidateQueries({ queryKey: qk.board(input.boardId) }),
  });
}

export function usePatchLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      labelId: string;
      boardId: string;
      patch: { name?: string; color?: string };
    }) => api<void>(`/labels/${input.labelId}`, { method: 'PATCH', body: JSON.stringify(input.patch) }),
    onSuccess: (_d, input) => qc.invalidateQueries({ queryKey: qk.board(input.boardId) }),
  });
}

export function useDeleteLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { labelId: string; boardId: string }) =>
      api<void>(`/labels/${input.labelId}`, { method: 'DELETE' }),
    onSuccess: (_d, input) => qc.invalidateQueries({ queryKey: qk.board(input.boardId) }),
  });
}

export function useAddChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { cardId: string; boardId: string; text: string }) =>
      api<void>(`/cards/${input.cardId}/checklist`, {
        method: 'POST',
        body: JSON.stringify({ text: input.text }),
      }),
    onSuccess: (_d, input) => {
      qc.invalidateQueries({ queryKey: qk.card(input.cardId) });
      qc.invalidateQueries({ queryKey: qk.board(input.boardId) });
    },
  });
}

export function usePatchChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      itemId: string;
      cardId: string;
      boardId: string;
      patch: { text?: string; done?: boolean; position?: string };
    }) => api<void>(`/checklist/${input.itemId}`, { method: 'PATCH', body: JSON.stringify(input.patch) }),
    onSuccess: (_d, input) => {
      qc.invalidateQueries({ queryKey: qk.card(input.cardId) });
      qc.invalidateQueries({ queryKey: qk.board(input.boardId) });
    },
  });
}

export function useDeleteChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { itemId: string; cardId: string; boardId: string }) =>
      api<void>(`/checklist/${input.itemId}`, { method: 'DELETE' }),
    onSuccess: (_d, input) => {
      qc.invalidateQueries({ queryKey: qk.card(input.cardId) });
      qc.invalidateQueries({ queryKey: qk.board(input.boardId) });
    },
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { cardId: string; boardId: string; body: string }) =>
      api<void>(`/cards/${input.cardId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: input.body }),
      }),
    onSuccess: (_d, input) => {
      qc.invalidateQueries({ queryKey: qk.card(input.cardId) });
      qc.invalidateQueries({ queryKey: qk.board(input.boardId) });
    },
  });
}

export function useUploadAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { cardId: string; boardId: string; file: File }) => {
      const form = new FormData();
      form.append('file', input.file);
      return api<void>(`/cards/${input.cardId}/attachments`, { method: 'POST', body: form });
    },
    onSuccess: (_d, input) => {
      qc.invalidateQueries({ queryKey: qk.card(input.cardId) });
      qc.invalidateQueries({ queryKey: qk.board(input.boardId) });
    },
  });
}

export function useDeleteAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { attachmentId: string; cardId: string; boardId: string }) =>
      api<void>(`/attachments/${input.attachmentId}`, { method: 'DELETE' }),
    onSuccess: (_d, input) => {
      qc.invalidateQueries({ queryKey: qk.card(input.cardId) });
      qc.invalidateQueries({ queryKey: qk.board(input.boardId) });
    },
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) =>
      api<void>('/notifications/read', {
        method: 'POST',
        body: JSON.stringify(ids && ids.length ? { ids } : {}),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.notifications }),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: { name?: string; avatarColor?: string; emailNotifications?: boolean }) =>
      api<Me>('/users/me', { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: (me) => qc.setQueryData(qk.me, me),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      api<void>('/users/me/password', { method: 'POST', body: JSON.stringify(input) }),
  });
}

export interface AdminOverview {
  members: UserPublic[];
  diskUsageBytes: number;
  emailConfigured: boolean;
}

export function useAdminMembers() {
  return useQuery({
    queryKey: ['admin', 'members'],
    queryFn: () => api<AdminOverview>('/admin/members'),
  });
}

export function useArchivedBoards() {
  return useQuery({
    queryKey: ['admin', 'archived-boards'],
    queryFn: () => api<BoardSummary[]>('/admin/archived-boards'),
  });
}

export function useCreateInvite() {
  return useMutation({
    mutationFn: (email: string) =>
      api<{ link: string }>('/admin/invites', { method: 'POST', body: JSON.stringify({ email }) }),
  });
}

export function usePatchMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; patch: { deactivated?: boolean; isAdmin?: boolean } }) =>
      api<void>(`/admin/members/${input.userId}`, {
        method: 'PATCH',
        body: JSON.stringify(input.patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'members'] }),
  });
}

export function useResetMemberPassword() {
  return useMutation({
    mutationFn: (userId: string) =>
      api<{ link: string }>(`/admin/members/${userId}/reset-password`, { method: 'POST' }),
  });
}

export function useRestoreBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (boardId: string) =>
      api<void>('/admin/restore', {
        method: 'POST',
        body: JSON.stringify({ entity: 'board', id: boardId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'archived-boards'] });
      qc.invalidateQueries({ queryKey: qk.boards });
    },
  });
}

export function usePurgeBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (boardId: string) =>
      api<void>('/admin/purge', {
        method: 'POST',
        body: JSON.stringify({ entity: 'board', id: boardId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'archived-boards'] });
      qc.invalidateQueries({ queryKey: qk.boards });
    },
  });
}

