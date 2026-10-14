// Alibis are authored beside their matching actions, never interpolated from metadata.
const { PROFILES } = require('./decision-profiles');
const ALIBIS = Object.fromEntries(Object.entries(PROFILES).map(([crisisId, roles]) => [crisisId,
  Object.fromEntries(Object.entries(roles).map(([role, flaws]) => [role,
    Object.fromEntries(Object.entries(flaws).map(([flaw, profile]) => [flaw, profile.alibis])),
  ])),
]));
module.exports = { ALIBIS };
