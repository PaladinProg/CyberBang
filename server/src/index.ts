import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server as SocketServer } from 'socket.io';
import { registerLobbyHandlers } from './rooms/handlers.js';
import { RoomStore } from './rooms/store.js';

const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_ORIGIN = process.env.CLIENT_URL ?? 'http://localhost:5173';

const store = new RoomStore();

async function main(): Promise<void> {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: CLIENT_ORIGIN,
  });

  app.get('/health', async () => ({ status: 'ok', rooms: store.rooms.size }));

  const io = new SocketServer(app.server, {
    cors: {
      origin: CLIENT_ORIGIN,
      methods: ['GET', 'POST'],
    },
  });

  registerLobbyHandlers(io, store);

  await app.listen({ port: PORT, host: '0.0.0.0' });
  app.log.info(`Cyber-Bang server: http://localhost:${PORT}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
