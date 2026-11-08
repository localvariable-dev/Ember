/**
 * PaywallSheet Component (Screen 6)
 * Master Plan Part 1 §2.8
 * 84% height bottom sheet with plan radio group (Lifetime preselected), value props, and mock purchase execution.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../../design/tokens';
import { hapticCardSelect, hapticPurchaseSuccess } from '../../design/haptics';
import { useDatabase } from '../../providers/DatabaseProvider';
import { useSheetStore } from '../../stores/useSheetStore';
import { generateUuid } from '../../data/uuid';

type PlanOption = 'lifetime' | 'monthly';

export function PaywallSheet() {
  const { entitlementRepo, refreshState } = useDatabase();
  const { closeSheet } = useSheetStore();

  const [selectedPlan, setSelectedPlan] = useState<PlanOption>('lifetime');
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  const handlePlanSelect = (plan: PlanOption) => {
    hapticCardSelect();
    setSelectedPlan(plan);
  };

  const handleUnlock = () => {
    setIsProcessing(true);

    // Simulate mock purchase execution
    setTimeout(() => {
      const nowMs = Date.now();
      if (selectedPlan === 'lifetime') {
        entitlementRepo.upsert({
          id: generateUuid(),
          kind: 'lifetime',
          source: 'mock',
          productId: 'ember_pro_lifetime',
          status: 'active',
          grantedAtMs: nowMs,
          expiresAtMs: null,
          consumedAtMs: null,
          consumedSessionId: null,
          orderId: `MOCK-LIFETIME-${Date.now()}`,
          purchaseToken: `tok-mock-${Date.now()}`,
          lastVerifiedAtMs: nowMs,
          metaJson: null,
        });
      } else {
        entitlementRepo.upsert({
          id: generateUuid(),
          kind: 'subscription',
          source: 'mock',
          productId: 'ember_pro_monthly',
          status: 'active',
          grantedAtMs: nowMs,
          expiresAtMs: nowMs + 30 * 86_400_000,
          consumedAtMs: null,
          consumedSessionId: null,
          orderId: `MOCK-SUB-${Date.now()}`,
          purchaseToken: `tok-mock-${Date.now()}`,
          lastVerifiedAtMs: nowMs,
          metaJson: null,
        });
      }

      refreshState();
      hapticPurchaseSuccess();
      setIsProcessing(false);
      setSuccess(true);

      setTimeout(() => {
        closeSheet();
      }, 700);
    }, 300);
  };

  const ctaText = success
    ? 'Unlocked'
    : isProcessing
      ? 'Unlocking...'
      : selectedPlan === 'lifetime'
        ? 'Unlock Deep Rest · ₹1,199 once'
        : 'Unlock Deep Rest · ₹79 / mo';

  return (
    <View style={styles.sheetContainer}>
      <View style={styles.grabber} />

      <View style={styles.header}>
        <Text style={styles.moonGlyph}>☾</Text>
        <Text style={styles.title}>Rest that reaches deeper.</Text>
        <Text style={styles.subtitle}>
          30 minutes of guided Yoga Nidra for the nights that need more.
        </Text>
      </View>

      {/* Value Props */}
      <View style={styles.valueProps}>
        <View style={styles.propRow}>
          <Text style={styles.checkMark}>✓</Text>
          <Text style={styles.propText}>30-min Deep Rest &amp; Yoga Nidra</Text>
        </View>
        <View style={styles.propRow}>
          <Text style={styles.checkMark}>✓</Text>
          <Text style={styles.propText}>Premium narrator voices &amp; ambient beds</Text>
        </View>
        <View style={styles.propRow}>
          <Text style={styles.checkMark}>✓</Text>
          <Text style={styles.propText}>Full history &amp; Calm Delta recovery insights</Text>
        </View>
        <View style={styles.propRow}>
          <Text style={styles.checkMark}>✓</Text>
          <Text style={styles.propText}>Restorative night rest in Sleep Mode</Text>
        </View>
      </View>

      {/* Plan Radio Cards */}
      <View style={styles.plansContainer} accessibilityRole="radiogroup">
        {/* Lifetime Card (Preselected, Best Value) */}
        <Pressable
          style={[styles.planCard, selectedPlan === 'lifetime' && styles.planCardSelected]}
          onPress={() => handlePlanSelect('lifetime')}
          accessibilityRole="radio"
          accessibilityState={{ selected: selectedPlan === 'lifetime' }}
        >
          <View style={styles.bestValueBadge}>
            <Text style={styles.bestValueText}>BEST VALUE</Text>
          </View>
          <View style={styles.planHeaderRow}>
            <Text style={styles.planName}>Lifetime</Text>
            <Text style={styles.planPrice}>₹1,199</Text>
          </View>
          <Text style={styles.planDescription}>Pay once, rest forever.</Text>
          <Text style={styles.planSubcaption}>Equal to about 15 months of Monthly.</Text>
        </Pressable>

        {/* Monthly Card */}
        <Pressable
          style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardSelected]}
          onPress={() => handlePlanSelect('monthly')}
          accessibilityRole="radio"
          accessibilityState={{ selected: selectedPlan === 'monthly' }}
        >
          <View style={styles.planHeaderRow}>
            <Text style={styles.planName}>Monthly</Text>
            <Text style={styles.planPrice}>₹79 / mo</Text>
          </View>
          <Text style={styles.planDescription}>About ₹2.60 a day. Cancel anytime.</Text>
        </Pressable>
      </View>

      {/* Main Unlock CTA */}
      <Pressable
        style={[styles.ctaButton, isProcessing && styles.ctaDisabled]}
        onPress={handleUnlock}
        disabled={isProcessing}
        accessibilityRole="button"
        accessibilityLabel={ctaText}
      >
        <Text style={styles.ctaButtonText}>{ctaText}</Text>
      </Pressable>

      {/* Secondary Text Links */}
      <View style={styles.linksRow}>
        <Pressable onPress={closeSheet}>
          <Text style={styles.linkText}>Not now</Text>
        </Pressable>
        <Text style={styles.linkDivider}>·</Text>
        <Pressable onPress={() => alert('Purchases restored.')}>
          <Text style={styles.linkText}>Restore purchases</Text>
        </Pressable>
      </View>

      {/* Test Mode Banner */}
      <View style={styles.testModeBanner}>
        <Text style={styles.testModeText}>⚠ TEST MODE — mock billing active</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    height: '84%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.sm,
    borderColor: colors.border,
    borderTopWidth: 1,
    justifyContent: 'space-between',
    paddingBottom: spacing.lg,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  header: {
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  moonGlyph: {
    fontSize: 32,
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.displaySm,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    fontSize: 14,
  },
  valueProps: {
    gap: spacing.xs,
    marginVertical: spacing.xs,
  },
  propRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkMark: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 14,
  },
  propText: {
    ...typography.body,
    color: colors.text,
    fontSize: 14,
  },
  plansContainer: {
    gap: spacing.sm,
  },
  planCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.md,
  },
  planCardSelected: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.accent,
    borderWidth: 1.5,
  },
  bestValueBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: radii.pill,
    marginBottom: 4,
  },
  bestValueText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.onAccent,
  },
  planHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planName: {
    ...typography.cardTitle,
    color: colors.text,
  },
  planPrice: {
    ...typography.title,
    color: colors.accent,
  },
  planDescription: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  planSubcaption: {
    ...typography.caption,
    color: colors.textFaint,
    fontSize: 11,
    marginTop: 2,
  },
  ctaButton: {
    height: 60,
    borderRadius: radii.button,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  ctaDisabled: {
    opacity: 0.7,
  },
  ctaButtonText: {
    ...typography.title,
    fontSize: 17,
    color: colors.onAccent,
    fontWeight: '700',
  },
  linksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  linkText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  linkDivider: {
    color: colors.border,
  },
  testModeBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingVertical: 4,
    alignItems: 'center',
  },
  testModeText: {
    fontSize: 11,
    color: colors.accent,
    fontWeight: '600',
  },
});
