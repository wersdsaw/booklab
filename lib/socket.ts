'use client';
import { io, Socket } from 'socket.io-client';
let socket: Socket | null = null;
export function getSocket(): Socket {
  if (!socket) socket = io({autoConnect:false,reconnection:true,reconnectionAttempts:Infinity,reconnectionDelay:500,reconnectionDelayMax:5000,randomizationFactor:0.5,timeout:10000});
  return socket;
}
