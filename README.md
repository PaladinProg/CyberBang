# Cyber-Bang

Браузерная версия настольной игры Bang! в стиле киберпанк.

## Стек

| Слой | Технологии |
|------|------------|
| Shared | TypeScript (strict), enums + локализация RU |
| Server | Node.js, Fastify, Socket.IO |
| Client | React, Vite, Tailwind CSS, shadcn/ui, Zustand, Framer Motion |

## Требования

- **Node.js** ≥ 20
- **npm** ≥ 10

## Структура монорепо

```
CyberBang/
├── shared/          # Общие типы и локализация (EN keys → RU strings)
│   ├── types/       # RoleType, CardType, GameState, …
│   └── localization.ts
├── server/          # Fastify + Socket.IO, комнаты в RAM
└── client/          # React SPA, экран Lobby
```

## Архитектура локализации (Bilingual)

- **Код / enums / сервер** — английские ключи: `CardType.PING`, `RoleType.ADMIN`
- **UI** — только через словарь: `LOC.CARD_NAMES[CardType.PING]`
- Никаких русских строк в JSX напрямую

## Socket-события (лобби)

| Событие | Направление | Описание |
|---------|-------------|----------|
| `createRoom` | Client → Server | Создать комнату |
| `joinRoom` | Client → Server | Войти в комнату |
| `leaveRoom` | Client → Server | Покинуть комнату |
| `roomUpdate` | Server → Client | Список комнат (+ `yourRoomId` для актора) |
| `socketError` | Server → Client | Ошибка с кодом `SocketErrorCode` |

## Переменные окружения

| Переменная | Где | По умолчанию |
|------------|-----|--------------|
| `PORT` | server | `3001` |
| `CLIENT_URL` | server (CORS) | `http://localhost:5173` |
| `VITE_SERVER_URL` | client | `http://localhost:3001` |

