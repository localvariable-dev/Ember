/**
 * TopBar Component
 * Master Plan Part 1 §2.3
 * 56 dp top bar holding the StreakPill journey entry point.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { layout } from '../../design/tokens';
import { StreakPill } from './StreakPill';

export function TopBar() {
  return (
    <View style={styles.topBar}>
      <StreakPill />
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    height: layout.topBarHeight,
    justifyContent: 'center',
  },
});
