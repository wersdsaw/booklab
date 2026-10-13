'use client';
import { GameState } from '../lib/types';
export default function TimedPhase({state}:{state:GameState}) {
  const discussion=state.phase==='OPEN_DISCUSSION';
  const seconds=state.timer.remainingSeconds;
  return <section className="glass-card timed-phase"><div className="eyebrow">{discussion?'ЗАГАЛЬНЕ ОБГОВОРЕННЯ / 2 ХВИЛИНИ':'ТАЄМНЕ ГОЛОСУВАННЯ / ДО 7 ХВИЛИН'}</div><div className="phase-countdown" role="timer">{String(Math.floor(seconds/60)).padStart(2,'0')}:{String(seconds%60).padStart(2,'0')}</div><p>{discussion?'Слово відкрите для всіх. Захистіть свою позицію, обговоріть дії колег або озвучте, кого підозрюєте. Бюлетені вже закрито; результат буде оголошено після завершення таймера.':'Оберіть відділ, співробітника й поясніть рішення. Коли всі доступні голоси подані або час вичерпано, почнеться відкрите обговорення.'}</p></section>;
}
