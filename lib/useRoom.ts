'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { getSocket } from './socket';
import { GameState } from './types';
export interface Session { sessionToken:string; roomCode:string; playerId:string|null; isHost:boolean }
export function useRoom(isHost = false) {
  const [state, setState] = useState<GameState|null>(null);
  const [session, setSession] = useState<Session|null>(null);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const key = isHost ? 'bunker_host_v2' : 'bunker_player_v2';
  const current = useRef<Session|null>(null);
  useEffect(() => {
    const socket = getSocket();
    try { current.current = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { sessionStorage.removeItem(key); }
    const connect = () => { setConnected(true); if (current.current) socket.emit('join_room', current.current, (result:{ok:boolean;error?:string}) => { if (!result.ok) {setError(result.error || 'Сесію не відновлено.'); current.current=null; sessionStorage.removeItem(key); setSession(null); setState(null);} }); };
    const joined = (next:Session) => { current.current=next; setSession(next); sessionStorage.setItem(key,JSON.stringify(next)); setError(''); };
    const update = (next:GameState) => setState(next);
    const timer = (next:GameState['timer']) => setState(prev => prev ? {...prev,timer:{...prev.timer,...next}} : prev);
    const fail = (message:string) => setError(message);
    const disconnect = () => setConnected(false);
    const kicked = () => { current.current=null;sessionStorage.removeItem(key);setSession(null);setState(null);setError('Сесію завершено: вас від’єднано або цей термінал відкрито в іншій вкладці.'); };
    socket.on('connect',connect);socket.on('disconnect',disconnect);socket.on('session_joined',joined);socket.on('state_update',update);socket.on('timer_tick',timer);socket.on('error_message',fail);socket.on('kicked_from_room',kicked);socket.on('session_replaced',kicked);
    if (socket.connected) connect(); else socket.connect();
    return () => {socket.off('connect',connect);socket.off('disconnect',disconnect);socket.off('session_joined',joined);socket.off('state_update',update);socket.off('timer_tick',timer);socket.off('error_message',fail);socket.off('kicked_from_room',kicked);socket.off('session_replaced',kicked);socket.disconnect();};
  }, [key]);
  const send = useCallback((event:string,payload:Record<string,unknown> = {}) => {
    if (!getSocket().connected) {setError('Немає з’єднання. Дочекайтеся відновлення.');return;}
    getSocket().emit(event,payload);
  }, []);
  const leave = () => {send('leave_room');current.current=null;sessionStorage.removeItem(key);setSession(null);setState(null);getSocket().disconnect();getSocket().connect();};
  return {state,session,error,connected,send,leave,setError};
}
