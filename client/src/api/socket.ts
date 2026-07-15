import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import type { BoardChangedEvent, PresenceEvent, Id } from '@shared/types';
import { qk } from './queries';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({ withCredentials: true, autoConnect: true });
  }
  return socket;
}

export interface BoardChannel {
  connected: boolean;
  presence: PresenceEvent['users'];
}

export function useBoardChannel(boardId: Id): BoardChannel {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(() => getSocket().connected);
  const [presence, setPresence] = useState<PresenceEvent['users']>([]);

  useEffect(() => {
    const s = getSocket();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleInvalidate = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        qc.invalidateQueries({ queryKey: qk.board(boardId) });
      }, 150);
    };

    const onChanged = (evt: BoardChangedEvent) => {
      if (evt.boardId === boardId) scheduleInvalidate();
    };
    const onPresence = (evt: PresenceEvent) => {
      if (evt.boardId === boardId) setPresence(evt.users);
    };
    const onConnect = () => {
      setConnected(true);
      s.emit('board:join', { boardId });
      qc.invalidateQueries({ queryKey: qk.board(boardId) });
    };
    const onDisconnect = () => setConnected(false);

    s.on('board:changed', onChanged);
    s.on('board:presence', onPresence);
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);

    if (s.connected) {
      s.emit('board:join', { boardId });
    }

    return () => {
      s.emit('board:leave', { boardId });
      s.off('board:changed', onChanged);
      s.off('board:presence', onPresence);
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      if (timer) clearTimeout(timer);
      setPresence([]);
    };
  }, [boardId, qc]);

  return { connected, presence };
}
