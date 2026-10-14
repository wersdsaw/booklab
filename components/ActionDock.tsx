'use client';
import { ReactNode } from 'react';
import { GameState } from '../lib/types';

// Sticky controls reserve their own space and never relocate buttons via portals.
export function DockActions({children}:{children:ReactNode}) {
  return <div className="inline-actions">{children}</div>;
}
export default function ActionDock({children}:{state:GameState;children:ReactNode}) {
  return <div className="game-layout">{children}</div>;
}
