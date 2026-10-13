'use client';
export default function BudgetIndicator({value}:{value:number}) {
  const amount=Math.round(value*100)/100;
  return <div className={`budget-indicator ${amount < 25 ? 'budget-critical' : ''}`} role="status" aria-label={`Бюджет компанії: ${amount}%`}><span>БЮДЖЕТ КОМПАНІЇ</span><strong>{amount}%</strong></div>;
}
