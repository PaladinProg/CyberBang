import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RoomSummary, SocketErrorCode } from '@cyberbang/shared/types';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface LobbyState {
  rooms: RoomSummary[];
  currentRoomId: string | null;
  nickname: string;
  connectionStatus: ConnectionStatus;
  lastError: SocketErrorCode | null;
  socketId: string | null;

  setRooms: (rooms: RoomSummary[]) => void;
  setCurrentRoomId: (roomId: string | null) => void;
  setNickname: (nickname: string) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setError: (code: SocketErrorCode | null) => void;
  setSocketId: (id: string | null) => void;
}

export const useLobbyStore = create<LobbyState>()(
  persist(
    (set) => ({
      name: 'cyberbang-lobby',
      rooms: [],
      currentRoomId: null,
      nickname: '',
      connectionStatus: 'connecting',
      lastError: null,
      socketId: null,

      setRooms: (rooms) => set({ rooms }),
      setCurrentRoomId: (roomId) => set({ currentRoomId: roomId }),
      setNickname: (nickname) => set({ nickname }),
      setConnectionStatus: (status) => set({ connectionStatus: status }),
      setError: (code) => set({ lastError: code }),
      setSocketId: (id) => set({ socketId: id }),
    }),
    {
      name: 'cyberbang-lobby',
      partialize: (state) => ({ 
        nickname: state.nickname,
        currentRoomId: state.currentRoomId
      }),
    },
  ),
);
