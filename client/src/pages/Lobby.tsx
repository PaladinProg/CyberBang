// client/src/pages/Lobby.tsx
import { useEffect, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Users, Zap, LogOut, DoorOpen, Play } from 'lucide-react';
import { MAX_PLAYERS, MIN_PLAYERS, RoomStatus } from '@cyberbang/shared/types';
import { LOC } from '@cyberbang/shared/localization';
import { useSocket } from '@/hooks/useSocket';
import { useLobbyStore } from '@/store/lobbyStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function Lobby() {
  const { createRoom, joinRoom, leaveRoom, startGame, isConnected } = useSocket();

  // Состояние лобби
  const rooms = useLobbyStore((s) => s.rooms);
  const nickname = useLobbyStore((s) => s.nickname);
  const setNickname = useLobbyStore((s) => s.setNickname);
  const currentRoomId = useLobbyStore((s) => s.currentRoomId);
  const connectionStatus = useLobbyStore((s) => s.connectionStatus);
  const lastError = useLobbyStore((s) => s.lastError);
  const setError = useLobbyStore((s) => s.setError);
  const mySocketId = useLobbyStore((s) => s.socketId);

  // Локальное состояние форм
  const [roomName, setRoomName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(MAX_PLAYERS);

  // Автоочистка ошибки
  useEffect(() => {
    if (!lastError) return;
    const timer = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(timer);
  }, [lastError, setError]);

  const connectionLabel =
    connectionStatus === 'connecting'
      ? LOC.UI.CONNECTING
      : connectionStatus === 'connected'
        ? LOC.UI.CONNECTED
        : LOC.UI.DISCONNECTED;

  const currentRoom = rooms.find((r) => r.id === currentRoomId);
  
  // ▼▼▼ ПРОВЕРКА ХОСТА ДЛЯ КНОПКИ СТАРТА ▼▼▼
  const isHost = currentRoom?.hostId === mySocketId;

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    createRoom({ roomName, nickname, maxPlayers });
    setRoomName('');
  };

  const handleJoin = (roomId: string) => {
    joinRoom({ roomId, nickname });
  };

  const handleLeave = () => {
    if (currentRoomId) {
      leaveRoom({ roomId: currentRoomId });
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-4 md:p-8">
      {/* Шапка */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="font-display text-3xl font-bold tracking-widest text-cyber-purple md:text-4xl">
            {LOC.UI.APP_TITLE}
          </h1>
          <p className="text-cyber-muted">{LOC.UI.LOBBY_TITLE}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              isConnected ? 'animate-pulse-neon bg-cyber-purple' : 'bg-cyber-orange'
            }`}
          />
          <span className="text-sm text-cyber-muted">{connectionLabel}</span>
        </div>
      </motion.header>

      {/* Toast ошибки */}
      {lastError && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0 }}
          className="rounded-md border border-cyber-orange/60 bg-cyber-orange/10 px-4 py-3 text-sm text-cyber-orange"
        >
          {LOC.ERRORS[lastError]}
        </motion.div>
      )}

      {/* Никнейм */}
      <Card className="cyber-border">
        <CardHeader>
          <CardTitle>{LOC.UI.NICKNAME}</CardTitle>
          <CardDescription>{LOC.UI.NICKNAME}</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder={LOC.UI.NICKNAME}
            maxLength={20}
          />
        </CardContent>
      </Card>

      {/* Текущая комната + Кнопка старта */}
      {currentRoom && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="cyber-border-orange shadow-neon-orange">
            <CardHeader>
              <CardTitle className="text-cyber-orange">{LOC.UI.IN_ROOM}</CardTitle>
              <CardDescription>{currentRoom.name}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-cyber-orange" />
                  {currentRoom.playerCount}/{currentRoom.maxPlayers} {LOC.UI.PLAYERS}
                </span>
                <Button variant="orange" size="sm" onClick={handleLeave}>
                  <LogOut className="h-4 w-4" />
                  {LOC.UI.LEAVE_ROOM}
                </Button>
              </div>

              {/* ▼▼▼ ОТЛАДОЧНЫЙ БЛОК И КНОПКА СТАРТА ▼▼▼ */}
              <div className="mt-2 space-y-3 border-t border-cyber-orange/20 pt-4">
                {/* Диагностика (можно убрать после тестов) */}
                <div className="text-xs font-mono text-gray-500">
                  <p>My ID: {mySocketId?.slice(0, 8)}... | Host ID: {currentRoom.hostId.slice(0, 8)}...</p>
                  <p className={isHost ? 'text-green-500' : 'text-red-500'}>
                    Is Host: {isHost ? 'YES ✅' : 'NO ❌'}
                  </p>
                </div>

                {isHost ? (
                  <Button 
                    onClick={() => startGame(currentRoomId)}
                    className="w-full bg-green-600 hover:bg-green-500 text-white font-bold border border-green-400 shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                  >
                    <Play className="h-4 w-4 mr-2" /> НАЧАТЬ ИГРУ
                  </Button>
                ) : (
                  <div className="text-center text-sm italic text-gray-500">
                    Ожидание решения администратора...
                  </div>
                )}
              </div>
              {/* ▲▲▲ КОНЕЦ БЛОКА СТАРТА ▲▲▲ */}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Создание комнаты — скрыто, если уже в комнате */}
      {!currentRoomId && (
        <Card>
          <CardHeader>
            <CardTitle>{LOC.UI.CREATE_ROOM}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <Input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder={LOC.UI.ROOM_NAME}
                maxLength={32}
                required
              />
              <div className="flex items-center gap-3">
                <label className="text-sm text-cyber-muted">{LOC.UI.MAX_PLAYERS}</label>
                <Input
                  type="number"
                  min={MIN_PLAYERS}
                  max={MAX_PLAYERS}
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(Number(e.target.value))}
                  className="w-20"
                />
              </div>
              <Button type="submit" disabled={!isConnected || nickname.trim().length < 2}>
                <Zap className="h-4 w-4" />
                {LOC.UI.CREATE_ROOM}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Список комнат */}
      <section>
        <h2 className="mb-4 font-display text-lg tracking-wide text-cyber-text">
          {LOC.UI.LOBBY_TITLE}
        </h2>

        {rooms.length === 0 ? (
          <p className="text-center text-cyber-muted">{LOC.UI.NO_ROOMS}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rooms.map((room, index) => (
              <motion.li
                key={room.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  className={
                    room.id === currentRoomId
                      ? 'cyber-border-orange'
                      : 'hover:border-cyber-purple/70'
                  }
                >
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-display font-semibold text-cyber-text">{room.name}</p>
                      <div className="mt-1 flex flex-wrap gap-3 text-sm text-cyber-muted">
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {room.playerCount}/{room.maxPlayers}
                        </span>
                        <span>
                          {LOC.UI.STATUS}: {LOC.ROOM_STATUS_NAMES[room.status]}
                        </span>
                      </div>
                    </div>

                    {room.id !== currentRoomId &&
                      room.status === RoomStatus.WAITING &&
                      room.playerCount < room.maxPlayers && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!isConnected || nickname.trim().length < 2 || !!currentRoomId}
                          onClick={() => handleJoin(room.id)}
                        >
                          <DoorOpen className="h-4 w-4" />
                          {LOC.UI.JOIN_ROOM}
                        </Button>
                      )}
                  </CardContent>
                </Card>
              </motion.li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}