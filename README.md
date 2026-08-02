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

## Быстрый старт

```bash
# 1. Установка зависимостей (из корня монорепо)
npm install

# 2. Запуск обоих dev-серверов одной командой
npm run dev
```

Или в **двух терминалах**:

```bash
# Терминал 1 — backend (порт 3001)
npm run dev:server

# Терминал 2 — frontend (порт 5173)
npm run dev:client
```

Открой в браузере: **http://localhost:5173**

## Проверка Спринта 1

1. Статус подключения в шапке — «Подключено» (зелёная/neon точка).
2. Введи никнейм (мин. 2 символа).
3. Создай комнату — она появится в списке.
4. Открой вторую вкладку/браузер — войди в ту же комнату.
5. Счётчик игроков обновляется у всех без перезагрузки.
6. «Выйти» — комната исчезает, если пустая.

Health-check сервера: **http://localhost:3001/health**

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

## Полезные команды

```bash
npm run typecheck    # Проверка типов во всех пакетах
npm run build:shared # Сборка shared (нужна перед server)
npm run build        # Полная production-сборка
```
