import { useCallback, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  CreateRoomPayload,
  JoinRoomPayload,
  LeaveRoomPayload,
  RoomUpdatePayload,
  SOCKET_EVENTS,
  SocketErrorPayload,
  GAME_EVENTS,
  GameStartedPayload,
  GameState,
} from '@cyberbang/shared/types';
import { useLobbyStore } from '@/store/lobbyStore';
import { useGameStore } from '@/store/useGameStore';

const SERVER_URL = '/';

// Создаем сокет ОДИН РАЗ вне компонента, чтобы он не пересоздавался
const socket = io(SERVER_URL, {
  transports: ['websocket', 'polling'],
  autoConnect: true,
});

export interface UseSocketReturn {
  isConnected: boolean;
  createRoom: (payload: CreateRoomPayload) => void;
  joinRoom: (payload: JoinRoomPayload) => void;
  leaveRoom: (payload: LeaveRoomPayload) => void;
  startGame: (roomId: string) => void;
}

export function useSocket(): UseSocketReturn {
  const setRooms = useLobbyStore((s) => s.setRooms);
  const setCurrentRoomId = useLobbyStore((s) => s.setCurrentRoomId);
  const setConnectionStatus = useLobbyStore((s) => s.setConnectionStatus);
  const setError = useLobbyStore((s) => s.setError);
  const setSocketId = useLobbyStore((s) => s.setSocketId);
  const connectionStatus = useLobbyStore((s) => s.connectionStatus);

  const setGameState = useGameStore((s) => s.setGameState);

  // Эффект ТОЛЬКО для подписки на события, без создания сокета
  useEffect(() => {
    const handleConnect = () => {
      console.log('[Socket] CONNECTED! ID:', socket.id);
      setConnectionStatus('connected');
      setSocketId(socket.id);

      const lastRoomId = useLobbyStore.getState().currentRoomId;
      
      if (lastRoomId) {
        console.log('[Socket] Reconnected, requesting state for room:', lastRoomId);
        // Отправляем запрос на сервер
        socket.emit(GAME_EVENTS.REQUEST_STATE, { roomId: lastRoomId });
      }
    };

    const handleDisconnect = () => {
      setConnectionStatus('disconnected');
      setSocketId(null);
    };

    const handleError = (err: any) => {
      console.error('[Socket] CONNECTION ERROR:', err.message);
      setConnectionStatus('disconnected');
    };

    const handleRoomUpdate = (payload: RoomUpdatePayload) => {
      setRooms(payload.rooms);
      if (payload.yourRoomId !== undefined) {
        setCurrentRoomId(payload.yourRoomId);
      }
    };

    const handleSocketError = (payload: SocketErrorPayload) => {
      setError(payload.code);
    };

    const handleGameStarted = (payload: GameStartedPayload) => {
      console.log('[Socket] Игра началась:', payload.gameState.roomId);
      setGameState(payload.gameState);
    };

    const handleGameStateUpdate = (data: { gameState: GameState }) => {
      console.log('[Socket] State update received');
      setGameState(data.gameState);
    };


    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleError);
    socket.on(SOCKET_EVENTS.ROOM_UPDATE, handleRoomUpdate);
    socket.on(SOCKET_EVENTS.SOCKET_ERROR, handleSocketError);
    socket.on(GAME_EVENTS.GAME_STARTED, handleGameStarted);
    socket.on(GAME_EVENTS.GAME_STATE_UPDATE, handleGameStateUpdate);

    // Инициализация статуса при монтировании
    if (socket.connected) {
      handleConnect();
    } else {
      setConnectionStatus('connecting');
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleError);
      socket.off(SOCKET_EVENTS.ROOM_UPDATE, handleRoomUpdate);
      socket.off(SOCKET_EVENTS.SOCKET_ERROR, handleSocketError);
      socket.off(GAME_EVENTS.GAME_STARTED, handleGameStarted);
      socket.off(GAME_EVENTS.GAME_STATE_UPDATE, handleGameStateUpdate);
    };
  }, [setRooms, setCurrentRoomId, setConnectionStatus, setError, setSocketId, setGameState, setConnectionStatus, setSocketId]);

  const createRoom = useCallback((payload: CreateRoomPayload) => {
    setError(null);
    socket.emit(SOCKET_EVENTS.CREATE_ROOM, payload);
  }, [setError]);

  const joinRoom = useCallback((payload: JoinRoomPayload) => {
    setError(null);
    socket.emit(SOCKET_EVENTS.JOIN_ROOM, payload);
  }, [setError]);

  const leaveRoom = useCallback((payload: LeaveRoomPayload) => {
    setError(null);
    socket.emit(SOCKET_EVENTS.LEAVE_ROOM, payload);
  }, [setError]);

  const startGame = useCallback((roomId: string) => {
    setError(null);
    socket.emit(GAME_EVENTS.START_GAME, { roomId });
  }, [setError]);

  const endTurn = useCallback(() => {
    socket.emit('endTurn');
  }, []);

  const playCard = useCallback((cardId: string, targetId?: string) => {
    socket.emit('playCard', { cardId, targetId });
  }, []);

  return {
    isConnected: connectionStatus === 'connected',
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    endTurn, 
    playCard,
    socket,
  };
}