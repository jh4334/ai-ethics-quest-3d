function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const TIMINGS = Object.freeze({ activeTicks: 20, recoveryTicks: 12, windupTicks: 24 });

export const ATTENDANCE_PROCTOR = deepFreeze({
  id: 'attendance-proctor',
  maxHp: 240,
  retryTicks: 90,
  signature: 'H-17',
  patchChoices: ['reflect-arc', 'trace-speed', 'chain-persistence'],
  consequenceCallouts: {
    purge: '지운 사본에도 승인 번호는 남아 있다.',
    secure: '네가 지킨 원본에 승인 번호가 선명하다.'
  },
  phases: [
    {
      id: 'reflect-scan',
      response: 'reflect',
      requiredSuccesses: 2,
      damagePerSuccess: 30,
      timing: { ...TIMINGS },
      patterns: [
        { id: 'scan-east', beamLane: 'east', safeLane: 'west' },
        { id: 'scan-west', beamLane: 'west', safeLane: 'east' }
      ]
    },
    {
      id: 'trace-roster',
      response: 'trace',
      requiredSuccesses: 2,
      damagePerSuccess: 30,
      timing: { activeTicks: 30, recoveryTicks: 10, windupTicks: 20 },
      patterns: [
        { id: 'roster-a', targetIds: ['clone-a', 'clone-b', 'approval-h17'], trueTargetId: 'approval-h17' },
        { id: 'roster-b', targetIds: ['clone-b', 'approval-h17', 'clone-a'], trueTargetId: 'approval-h17' }
      ]
    },
    {
      id: 'approval-core',
      response: 'attack',
      requiredSuccesses: 3,
      damagePerSuccess: 40,
      timing: { ...TIMINGS },
      patterns: [
        {
          id: 'erase-north-east',
          erasedSectors: ['north', 'east'],
          safeSectors: ['south', 'west'],
          collisionChanged: false
        },
        {
          id: 'erase-south-west',
          erasedSectors: ['south', 'west'],
          safeSectors: ['north', 'east'],
          collisionChanged: false
        }
      ]
    }
  ]
});
