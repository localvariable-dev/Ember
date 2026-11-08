/**
 * Developer Panel Component
 * Master Plan Part 3 §4.7
 * Interactive control panel for testing mock purchases, entitlement states, and outcomes.
 */

import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../../design/tokens';
import { useDatabase } from '../../providers/DatabaseProvider';
import { useSheetStore } from '../../stores/useSheetStore';
import type { MockBillingAdapter } from '../../billing/MockBillingAdapter';
import type { MockOutcome } from '../../billing/types';

export function DevPanel() {
  const { db, billingService, entitlementService, refreshState } = useDatabase();
  const closeSheet = useSheetStore((state) => state.closeSheet);

  const isMock = billingService.id === 'mock';
  const mockAdapter = isMock ? (billingService as MockBillingAdapter) : null;

  const [nextOutcome, setNextOutcome] = useState<MockOutcome>(
    mockAdapter?.cfg.nextOutcome ?? 'success',
  );
  const [statusMsg, setStatusMsg] = useState<string>('');

  const handleGrant = async (productId: 'ember_pro_monthly' | 'ember_pro_lifetime') => {
    if (!mockAdapter) return;
    const res = await mockAdapter.devGrant(productId);
    await entitlementService.applyPurchase(res);
    refreshState();
    setStatusMsg(`Granted: ${productId}`);
  };

  const handleRevokeAll = async () => {
    if (!mockAdapter) return;
    await mockAdapter.devRevokeAll();
    await entitlementService.applyOwned([]);
    refreshState();
    setStatusMsg('Revoked all billing purchases');
  };

  const handleExpireMonthly = async () => {
    const pastGrace = Date.now() - 4 * 86_400_000;
    db.run(
      `UPDATE user_entitlements
       SET expires_at_ms = ?
       WHERE kind = 'subscription' AND status = 'active';`,
      [pastGrace],
    );
    await entitlementService.expireStale();
    refreshState();
    setStatusMsg('Monthly subscription set to expired (past grace)');
  };

  const handleSetOutcome = (outcome: MockOutcome) => {
    if (!mockAdapter) return;
    mockAdapter.setNextOutcome(outcome);
    setNextOutcome(outcome);
    setStatusMsg(`Next purchase outcome: ${outcome}`);
  };

  const handleGrantPass = async () => {
    const granted = await entitlementService.grantFreePass();
    refreshState();
    setStatusMsg(granted ? 'Free pass granted (14 days)' : 'Free pass rejected (cap/pro)');
  };

  const handleResetPasses = () => {
    db.run(`DELETE FROM user_entitlements WHERE kind = 'free_pass';`);
    refreshState();
    setStatusMsg('Free passes deleted');
  };

  const handleResetAllData = () => {
    Alert.alert(
      'Reset All Data?',
      'This will drop all local session logs, streak, and reset user preferences.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset All',
          style: 'destructive',
          onPress: () => {
            db.tx(() => {
              db.run('DELETE FROM session_logs;');
              db.run('DELETE FROM day_ledger;');
              db.run('DELETE FROM user_entitlements;');
              db.run(
                'UPDATE streak_state SET current_streak = 0, longest_streak = 0, grace_banked = 0, grace_progress = 0, updated_at_ms = ? WHERE id = 1;',
                [Date.now()],
              );
              db.run(
                'UPDATE user_preferences SET first_launch_at_ms = NULL, notif_prompt_shown = 0, first_run_cue_shown = 0, updated_at_ms = ? WHERE id = 1;',
                [Date.now()],
              );
            });
            refreshState();
            setStatusMsg('Database reset to fresh state');
          },
        },
      ],
    );
  };

  return (
    <View style={styles.sheetContainer}>
      <View style={styles.grabber} />

      <View style={styles.headerRow}>
        <Text style={styles.title}>Developer Panel</Text>
        <Pressable
          onPress={closeSheet}
          accessibilityRole="button"
          accessibilityLabel="Close dev panel"
        >
          <Text style={styles.closeBtn}>✕</Text>
        </Pressable>
      </View>

      <Text style={styles.subtitle}>Simulate purchases, outcomes, and offline reconciliation.</Text>

      {Boolean(statusMsg) && (
        <View style={styles.statusBanner}>
          <Text style={styles.statusText}>{statusMsg}</Text>
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionHeader}>ENTITLEMENT OVERRIDES</Text>
        <View style={styles.buttonRow}>
          <Pressable style={styles.btn} onPress={() => handleGrant('ember_pro_monthly')}>
            <Text style={styles.btnText}>Grant Monthly</Text>
          </Pressable>
          <Pressable style={styles.btn} onPress={() => handleGrant('ember_pro_lifetime')}>
            <Text style={styles.btnText}>Grant Lifetime</Text>
          </Pressable>
        </View>

        <View style={styles.buttonRow}>
          <Pressable style={[styles.btn, styles.btnWarning]} onPress={handleExpireMonthly}>
            <Text style={styles.btnWarningText}>Expire Monthly Now</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnDanger]} onPress={handleRevokeAll}>
            <Text style={styles.btnDangerText}>Revoke All</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionHeader}>FREE PASS OVERRIDES</Text>
        <View style={styles.buttonRow}>
          <Pressable style={styles.btn} onPress={handleGrantPass}>
            <Text style={styles.btnText}>Grant Free Pass</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnWarning]} onPress={handleResetPasses}>
            <Text style={styles.btnWarningText}>Reset Passes</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionHeader}>NEXT PURCHASE OUTCOME</Text>
        <View style={styles.buttonRow}>
          {(['success', 'cancel', 'fail', 'pending'] as MockOutcome[]).map((outcome) => (
            <Pressable
              key={outcome}
              style={[styles.smallBtn, nextOutcome === outcome && styles.smallBtnSelected]}
              onPress={() => handleSetOutcome(outcome)}
            >
              <Text
                style={[
                  styles.smallBtnText,
                  nextOutcome === outcome && styles.smallBtnTextSelected,
                ]}
              >
                {outcome}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionHeader}>DANGER ZONE</Text>
        <Pressable style={[styles.btn, styles.btnDangerFull]} onPress={handleResetAllData}>
          <Text style={styles.btnDangerText}>Reset All Database Data</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingTop: spacing.sm,
    height: '75%',
    borderColor: colors.border,
    borderTopWidth: 1,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPaddingHorizontal,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  closeBtn: {
    ...typography.title,
    color: colors.textMuted,
    padding: spacing.xs,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    paddingHorizontal: spacing.screenPaddingHorizontal,
    marginBottom: spacing.sm,
  },
  statusBanner: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.accent,
    borderWidth: 1,
    marginHorizontal: spacing.screenPaddingHorizontal,
    padding: spacing.xs + 2,
    borderRadius: radii.sm,
    marginBottom: spacing.sm,
  },
  statusText: {
    ...typography.caption,
    color: colors.accent,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingBottom: spacing.xxl,
  },
  sectionHeader: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  btn: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.button,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text,
  },
  btnWarning: {
    borderColor: '#F59E0B',
  },
  btnWarningText: {
    ...typography.caption,
    fontWeight: '600',
    color: '#F59E0B',
  },
  btnDanger: {
    borderColor: '#EF4444',
  },
  btnDangerFull: {
    borderColor: '#EF4444',
    paddingVertical: spacing.sm + 2,
  },
  btnDangerText: {
    ...typography.caption,
    fontWeight: '600',
    color: '#EF4444',
  },
  smallBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingVertical: spacing.xs + 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  smallBtnSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceRaised,
  },
  smallBtnText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  smallBtnTextSelected: {
    color: colors.accent,
    fontWeight: '700',
  },
});
