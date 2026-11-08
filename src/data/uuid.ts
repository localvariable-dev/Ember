/**
 * UUID v4 Generator
 * Master Plan Part 4 §5.1
 * Cross-platform UUID generation for Node (tests) and React Native / Expo.
 */

export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require('node:crypto');
    return nodeCrypto.randomUUID();
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ExpoCrypto = require('expo-crypto');
    return ExpoCrypto.randomUUID();
  }
}
