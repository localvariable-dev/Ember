/**
 * Ephemeral Sheet Controller Store
 * Master Plan Part 6 §7.1 & Part 1 §2.2
 * Zustand store for sheet visibility. Persistent state lives in SQLite.
 */

import { create } from 'zustand';

export type SheetType = 'none' | 'journey' | 'paywall' | 'voice_picker' | 'dev' | 'morning_checkin';

export interface SheetPayload {
  paywallVariant?: 'card_tap' | 'post_taste' | 'settings' | 'general';
  voicePickerContext?: 'sanctuary' | 'player';
  [key: string]: unknown;
}

interface SheetState {
  activeSheet: SheetType;
  payload: SheetPayload;
  openSheet: (sheet: SheetType, payload?: SheetPayload) => void;
  closeSheet: () => void;
}

export const useSheetStore = create<SheetState>((set) => ({
  activeSheet: 'none',
  payload: {},
  openSheet: (sheet, payload = {}) =>
    set({
      activeSheet: sheet,
      payload,
    }),
  closeSheet: () =>
    set({
      activeSheet: 'none',
      payload: {},
    }),
}));
