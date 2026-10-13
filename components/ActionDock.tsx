'use client';
import { ReactNode } from 'react';
import { GameState } from '../lib/types';

// Keep each action beside its content; no viewport overlay or portal relocation.
export function DockActions({children}:{children:ReactNode}) {
  return <div className="inline-actions">{children}</div>;
}
export default function ActionDock({children}:{state:GameState;children:ReactNode}) {
  return <>{children}</>;
}
