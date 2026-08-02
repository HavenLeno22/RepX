/**
 * Socket.IO connection singleton.
 *
 * One connection per signed-in session, shared across screens — matchmaking and
 * an in-progress match must not race each other for separate sockets.
 * Event catalog: docs/API_SPECIFICATION.md.
 */

import { io, type Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:4000';

let socket: Socket | null = null;

export function connectSocket(token: string): Socket {
  if (socket) {
    // Reuse the live connection and just refresh its credentials. Tearing the
    // socket down and rebuilding it on every token change would drop the player
    // out of a match they are in the middle of.
    socket.auth = { token };
    if (!socket.connected) socket.connect();
    return socket;
  }

  socket = io(WS_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 4000,
  });

  return socket;
}

/**
 * Points the existing socket at a newly refreshed access token.
 *
 * Without this, the socket kept the token it was created with. That token
 * expires mid-session, and the next automatic reconnect — a phone changing
 * network, a laptop waking up — was rejected as unauthorized and never retried
 * successfully, so the player silently stopped receiving match events.
 */
export function updateSocketToken(token: string): void {
  if (socket) socket.auth = { token };
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
