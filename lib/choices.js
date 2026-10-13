const { PROFILES } = require('./decision-profiles');
const { ALIBIS } = require('./alibis');
const stepFor = player => player.level === 'Керівник' ? 'head' : player.level === 'Тімлід' ? 'teamLead' : 'manager';
function crisisChoices(crisis, player) {
  const step = stepFor(player);
  if (!player.flaw) return crisis.steps[step].options.filter(o => o.type === 'constructive');
  const profile = PROFILES[step][player.flaw.id];
  if (!profile) throw new Error('Missing personalized decision profile');
  return ['light', 'medium', 'hard'].map((severity, i) => ({
    id: `toxic_${severity}`, severity, type: i === 2 ? 'sabotage' : 'flawed', isSabotage: i === 2,
    text: profile.actions[i],
    disabled: severity === 'light' && !!player.lightBurned,
    noDirective: step === 'head' && severity === 'light' && !!profile.silent,
    budgetImpact: [0.5, -2, -3][i],
  }));
}
// Only role, flaw and severity select an authored speech snippet; no scenario or budget metadata.
function privateAlibi(player, severity) {
  const index = ['light', 'medium', 'hard'].indexOf(severity);
  const alibi = ALIBIS[stepFor(player)]?.[player.flaw.id]?.[index];
  if (!alibi) throw new Error('Missing personalized private alibi');
  return alibi;
}
module.exports = { crisisChoices, privateAlibi };
