export type Id = string;
export type LabelColor = 'coral' | 'amber' | 'olive' | 'teal' | 'blue' | 'purple' | 'pink' | 'gray';
export type Visibility = 'team' | 'private';
export type NotificationType = 'assigned' | 'mentioned' | 'due_soon' | 'comment_on_your_card';

export interface UserPublic { id: Id; name: string; email: string; avatarColor: string; isAdmin: boolean; deactivated: boolean; }
export interface Me extends UserPublic { emailNotifications: boolean; }
export interface BoardSummary { id: Id; name: string; accentColor: LabelColor; visibility: Visibility; starred: boolean; cardCount: number; memberCount: number; archivedAt: string | null; }
export interface Label { id: Id; boardId: Id; name: string; color: LabelColor; }
export interface ListDto { id: Id; boardId: Id; name: string; position: string; archivedAt: string | null; }
export interface ChecklistItemDto { id: Id; cardId: Id; text: string; done: boolean; position: string; }
export interface CardDto { id: Id; listId: Id; boardId: Id; title: string; description: string; dueDate: string | null; position: string; archivedAt: string | null; createdBy: Id; createdAt: string; updatedAt: string; assigneeIds: Id[]; labelIds: Id[]; checklist: ChecklistItemDto[]; attachmentCount: number; commentCount: number; }
export interface BoardDetail { board: BoardSummary & { members: UserPublic[] }; lists: ListDto[]; cards: CardDto[]; labels: Label[]; }
export interface CommentDto { id: Id; cardId: Id; authorId: Id; body: string; createdAt: string; }
export interface AttachmentDto { id: Id; cardId: Id; filename: string; sizeBytes: number; mime: string; uploadedBy: Id; createdAt: string; }
export interface ActivityDto { id: Id; boardId: Id; cardId: Id | null; actorId: Id; type: string; data: Record<string, unknown>; createdAt: string; }
export interface NotificationDto { id: Id; type: NotificationType; cardId: Id; cardTitle: string; boardId: Id; actorId: Id | null; actorName: string | null; readAt: string | null; createdAt: string; }
export interface SearchResult { cardId: Id; boardId: Id; title: string; boardName: string; listName: string; }
export interface BoardChangedEvent { boardId: Id; byUserId: Id; }
export interface PresenceEvent { boardId: Id; users: { id: Id; name: string; avatarColor: string }[]; }
export const LABEL_HEX: Record<LabelColor, string> = { coral: '#D85A30', amber: '#EF9F27', olive: '#639922', teal: '#1D9E75', blue: '#378ADD', purple: '#7F77DD', pink: '#D4537E', gray: '#888780' };
