const { test } = require('node:test');
const assert = require('node:assert/strict');
const { join } = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loadComponent } = require('./render-component');
const Tribune = loadComponent(join(__dirname,'../components/Tribune.tsx')).default;
function render(state, props = {}) {
  return renderToStaticMarkup(React.createElement(Tribune, { state, onPass() {}, ...props }));
}
test('host safely renders the finished tribune after the last speaker was skipped', () => {
  const state = { players: { p1: { id: 'p1', name: 'Speaker', lastAction: 'My decision' } }, tribune: { queue: ['p1'], index: 1 } };
  const html = render(state, { isHost: true });
  assert.ok(html.includes('Усі висловились.'));
  assert.ok(!html.includes('speaker-action'));
  assert.ok(!html.includes('ПРОПУСТИТИ СПІКЕРА'));
});
test('empty and missing-speaker queues are safe for a host without playerId', () => {
  for (const queue of [[], ['missing']]) {
    const html = render({ players: {}, tribune: { queue, index: 0 } }, { isHost: true });
    assert.ok(html.includes('Усі висловились.'));
    assert.ok(!html.includes('speaker-action'));
  }
});
test('only the actual current player receives their private action prompt', () => {
  const state = { players: { p1: { id: 'p1', name: 'Speaker', level: 'Менеджер', department: 'Форвард', lastAction: 'My private decision' } }, tribune: { queue: ['p1'], index: 0 } };
  assert.ok(render(state, { playerId: 'p1' }).includes('My private decision'));
  assert.ok(!render(state, { playerId: 'p2' }).includes('My private decision'));
  assert.ok(!render(state, { isHost: true }).includes('My private decision'));
});
