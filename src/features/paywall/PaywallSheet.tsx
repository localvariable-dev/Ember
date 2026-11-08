/**
 * PaywallSheet Component (Screen 6)
 * Master Plan Part 1 §2.8 & Part 3 §4.1–§4.5
 * 84% height bottom sheet with plan radio group (Lifetime preselected), dynamic pricing,
 * contextual copy deck, and decoupled billing controller.
 */

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radii, spacing, typography } from '../../design/tokens';
import { hapticCardSelect, hapticPurchaseSuccess } from '../../design/haptics';
import { usePaywall } from '../../billing/PaywallProvider';
import type { PaywallVariant } from '../../billing/entitlementTypes';
import type { BillingProduct, ProductId, PurchaseResult } from '../../billing/types';

type PlanOption = 'lifetime' | 'monthly';

interface ValuePropsProps {
  bullets: string[];
}

function ValueProps({ bullets }: ValuePropsProps) {
  return (
    <View style={styles.valuePropsList}>
      {bullets.map((bullet, idx) => (
        <View key={idx} style={styles.valuePropRow}>
          <Text style={styles.valuePropBullet}>✦</Text>
          <Text style={styles.valuePropText}>{bullet}</Text>
        </View>
      ))}
    </View>
  );
}

interface PlanCardProps {
  id: PlanOption;
  isSelected: boolean;
  onSelect: () => void;
  title: string;
  priceLabel: string;
  line1: string;
  line2?: string;
  ribbon?: string;
}

function PlanCard({
  isSelected,
  onSelect,
  title,
  priceLabel,
  line1,
  line2,
  ribbon,
}: PlanCardProps) {
  return (
    <Pressable
      style={[styles.planCard, isSelected && styles.planCardSelected]}
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`${title}, ${priceLabel}. ${line1} ${line2 ?? ''}`}
    >
      {Boolean(ribbon) && (
        <View style={styles.ribbon}>
          <Text style={styles.ribbonText}>{ribbon}</Text>
        </View>
      )}

      <View style={styles.planCardHeader}>
        <View style={styles.radioOuter}>{isSelected && <View style={styles.radioInner} />}</View>
        <Text style={styles.planTitle}>{title}</Text>
        <Text style={styles.planPrice}>{priceLabel}</Text>
      </View>

      <Text style={styles.planLine1}>{line1}</Text>
      {Boolean(line2) && <Text style={styles.planLine2}>{line2}</Text>}
    </Pressable>
  );
}

const COPY_DECK: Record<
  PaywallVariant,
  { headline: string; subheadline: string; defaultCta: string }
> = {
  default: {
    headline: 'Rest that reaches deeper.',
    subheadline: '30 minutes of guided Yoga Nidra for the nights that need more.',
    defaultCta: 'Unlock Deep Rest · ₹1,199 once',
  },
  post_taste: {
    headline: "You've felt Deep Rest. Keep it?",
    subheadline: 'Thirty minutes, whenever you need them.',
    defaultCta: 'Keep Deep Rest · ₹1,199 once',
  },
  pass_expired: {
    headline: 'Your free pass has ended.',
    subheadline: 'Keep Deep Rest for good.',
    defaultCta: 'Unlock Deep Rest · ₹1,199 once',
  },
  pro_expired: {
    headline: 'Welcome back.',
    subheadline: 'Pick up where you left off.',
    defaultCta: 'Restart Pro · ₹79 / month',
  },
  bed_locked: {
    headline: 'A softer night.',
    subheadline: 'Ocean Drift, Night Forest and Delta Waves are part of Pro.',
    defaultCta: 'Unlock Pro · ₹1,199 once',
  },
  voice_locked: {
    headline: 'A voice made for the night.',
    subheadline: 'Unlock every narrator voice, Deep Rest Yoga Nidra, and premium soundscapes.',
    defaultCta: 'Unlock Pro · ₹1,199 once',
  },
  insights: {
    headline: 'See what actually helps.',
    subheadline: 'Full history and your Calm Delta by session, mode and time of day.',
    defaultCta: 'Unlock Pro · ₹1,199 once',
  },
};

const VALUE_PROP_BULLETS = [
  '30-min Deep Rest & Yoga Nidra',
  'Premium narrator voices & soundscapes',
  'Full history & Calm Delta insights',
  'Full 30-min restorative night rest',
];

export function PaywallSheet() {
  const { products, activeContext, isMock, purchase, restore, dismiss, chooseAlternative } =
    usePaywall();

  const [selectedPlan, setSelectedPlan] = useState<PlanOption>('lifetime');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [success, setSuccess] = useState(false);
  const [inlineMessage, setInlineMessage] = useState<{
    type: 'error' | 'pending' | 'info';
    text: string;
  } | null>(null);

  const variant = activeContext?.variant || 'default';
  const copy = COPY_DECK[variant] || COPY_DECK.default;

  // Resolve dynamic products from billing data
  const monthlyProduct: BillingProduct | undefined = products.find(
    (p) => p.id === 'ember_pro_monthly',
  );
  const lifetimeProduct: BillingProduct | undefined = products.find(
    (p) => p.id === 'ember_pro_lifetime',
  );

  // Runtime dynamic math for anchoring copy per Part 3 §4.2
  const monthlyPriceLabel = monthlyProduct?.localizedPrice
    ? `${monthlyProduct.localizedPrice} / month`
    : '₹79 / month';
  const lifetimePriceLabel = lifetimeProduct?.localizedPrice || '₹1,199';

  const monthlyMicros = monthlyProduct?.priceMicros ?? 79_000_000;
  const lifetimeMicros = lifetimeProduct?.priceMicros ?? 1_199_000_000;

  // Ratio math: ₹1,199 / ₹79 = ~15.2 months
  const monthsRatio = Math.round((lifetimeMicros / monthlyMicros) * 10) / 10;
  const lifetimeLine2 = `Equal to about ${Math.round(monthsRatio)} months of Monthly.`;

  // Daily math: ₹79 / 30 = ₹2.63
  const dailyPriceInRupees = (monthlyMicros / (30 * 1_000_000)).toFixed(2);
  const monthlyLine = `About ₹${dailyPriceInRupees} a day. ${isMock ? 'Test plan.' : 'Cancel anytime.'}`;

  const handlePlanSelect = (plan: PlanOption) => {
    hapticCardSelect();
    setSelectedPlan(plan);
    setInlineMessage(null);
  };

  const handlePurchase = async () => {
    setIsProcessing(true);
    setInlineMessage(null);

    const productId: ProductId =
      selectedPlan === 'lifetime' ? 'ember_pro_lifetime' : 'ember_pro_monthly';

    const result: PurchaseResult = await purchase(productId);

    if (result.status === 'purchased' || result.status === 'already_owned') {
      hapticPurchaseSuccess();
      setIsProcessing(false);
      setSuccess(true);
      setTimeout(() => {
        dismiss('purchased');
      }, 900);
      return;
    }

    setIsProcessing(false);

    if (result.status === 'cancelled') {
      // CTA returns to idle, no error message displayed per §4.5
      return;
    }

    if (result.status === 'pending') {
      setInlineMessage({
        type: 'pending',
        text: 'Your payment is pending. Pro will unlock automatically when it completes.',
      });
      return;
    }

    if (result.status === 'failed') {
      const code = result.error?.code;
      if (code === 'network') {
        setInlineMessage({
          type: 'error',
          text: "Can't reach Google Play right now. Try again in a moment.",
        });
      } else if (code === 'billing_unavailable') {
        setInlineMessage({
          type: 'error',
          text: "Purchases aren't available on this device right now.",
        });
      } else {
        setInlineMessage({
          type: 'error',
          text: "That didn't go through. You haven't been charged.",
        });
      }
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    setInlineMessage(null);

    const res = await restore();
    setIsRestoring(false);

    if (res.restored) {
      hapticPurchaseSuccess();
      setSuccess(true);
      setInlineMessage({
        type: 'info',
        text: 'You already have Pro — restored.',
      });
      setTimeout(() => {
        dismiss('restored');
      }, 900);
    } else {
      setInlineMessage({
        type: 'info',
        text: "We couldn't find a previous purchase on this account.",
      });
    }
  };

  const ctaText = useMemo(() => {
    if (success) return 'Unlocked';
    if (isProcessing) return 'Unlocking...';

    if (selectedPlan === 'lifetime') {
      if (variant === 'post_taste') {
        return `Keep Deep Rest · ${lifetimePriceLabel} once`;
      }
      if (variant === 'bed_locked' || variant === 'voice_locked' || variant === 'insights') {
        return `Unlock Pro · ${lifetimePriceLabel} once`;
      }
      return `Unlock Deep Rest · ${lifetimePriceLabel} once`;
    } else {
      if (variant === 'pro_expired') {
        return `Restart Pro · ${monthlyPriceLabel}`;
      }
      return `Start Pro · ${monthlyPriceLabel}`;
    }
  }, [success, isProcessing, selectedPlan, variant, lifetimePriceLabel, monthlyPriceLabel]);

  const showAlternative =
    activeContext?.source === 'begin_locked' && activeContext?.protocolId === 'deep_rest_30';

  return (
    <View style={styles.sheetContainer}>
      <View style={styles.grabber} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isMock && (
          <View style={styles.mockBanner}>
            <Text style={styles.mockBannerText}>⚠ TEST MODE — no real charge</Text>
          </View>
        )}

        <View style={styles.header}>
          <Text style={styles.moonGlyph}>☾</Text>
          <Text style={styles.title}>{copy.headline}</Text>
          <Text style={styles.subtitle}>{copy.subheadline}</Text>
        </View>

        <ValueProps bullets={VALUE_PROP_BULLETS} />

        <View style={styles.plansContainer}>
          <PlanCard
            id="lifetime"
            isSelected={selectedPlan === 'lifetime'}
            onSelect={() => handlePlanSelect('lifetime')}
            title="Lifetime"
            priceLabel={lifetimePriceLabel}
            line1="Pay once, rest forever."
            line2={lifetimeLine2}
            ribbon="BEST VALUE"
          />

          <PlanCard
            id="monthly"
            isSelected={selectedPlan === 'monthly'}
            onSelect={() => handlePlanSelect('monthly')}
            title="Monthly"
            priceLabel={monthlyPriceLabel}
            line1={monthlyLine}
          />
        </View>

        {Boolean(inlineMessage) && (
          <View
            style={[
              styles.inlineMessageContainer,
              inlineMessage?.type === 'error' && styles.inlineErrorContainer,
            ]}
          >
            <Text
              style={[
                styles.inlineMessageText,
                inlineMessage?.type === 'error' && styles.inlineErrorText,
              ]}
            >
              {inlineMessage?.text}
            </Text>
          </View>
        )}

        <Pressable
          style={[styles.primaryButton, (isProcessing || success) && styles.primaryButtonDisabled]}
          onPress={handlePurchase}
          disabled={isProcessing || success}
          accessibilityRole="button"
          accessibilityLabel={ctaText}
        >
          {isProcessing ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={styles.primaryButtonText}>{ctaText}</Text>
          )}
        </Pressable>

        {showAlternative && (
          <Pressable
            style={styles.alternativeButton}
            onPress={chooseAlternative}
            accessibilityRole="button"
            accessibilityLabel="Try the 10-minute recharge instead"
          >
            <Text style={styles.alternativeButtonText}>Try the 10-minute recharge instead</Text>
          </Pressable>
        )}

        <View style={styles.secondaryActionsRow}>
          <Pressable
            onPress={handleRestore}
            disabled={isRestoring || isProcessing}
            accessibilityRole="button"
            accessibilityLabel="Restore purchases"
          >
            <Text style={styles.secondaryActionText}>
              {isRestoring ? 'Restoring...' : 'Restore purchases'}
            </Text>
          </Pressable>

          <Text style={styles.secondaryActionDivider}>·</Text>

          <Pressable
            onPress={() => dismiss('dismissed')}
            accessibilityRole="button"
            accessibilityLabel="Not now"
          >
            <Text style={styles.secondaryActionText}>Not now</Text>
          </Pressable>
        </View>

        <View style={styles.footerLegal}>
          <Text style={styles.legalNotice}>
            Monthly renews automatically until you cancel in Google Play. Lifetime is a one-time
            purchase. Ember is a relaxation tool, not a medical device.
          </Text>
          <View style={styles.legalLinksRow}>
            <Pressable
              onPress={() => Linking.openURL('https://tryember.app/terms').catch(() => {})}
            >
              <Text style={styles.legalLink}>Terms</Text>
            </Pressable>
            <Text style={styles.legalLinkDivider}>·</Text>
            <Pressable
              onPress={() => Linking.openURL('https://tryember.app/privacy').catch(() => {})}
            >
              <Text style={styles.legalLink}>Privacy</Text>
            </Pressable>
          </View>
        </View>
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
    height: '84%',
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingBottom: spacing.xxl,
  },
  mockBanner: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  mockBannerText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  moonGlyph: {
    fontSize: 28,
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  valuePropsList: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderColor: colors.border,
    borderWidth: 1,
    gap: spacing.sm,
  },
  valuePropRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valuePropBullet: {
    color: colors.accent,
    fontSize: 12,
    marginRight: spacing.sm,
  },
  valuePropText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  plansContainer: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  planCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1.5,
    borderRadius: radii.card,
    padding: spacing.md,
    position: 'relative',
  },
  planCardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceRaised,
  },
  ribbon: {
    position: 'absolute',
    top: -10,
    right: spacing.md,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xs + 4,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  ribbonText: {
    ...typography.caption,
    color: colors.onAccent,
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  planCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  planTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  planPrice: {
    ...typography.body,
    fontWeight: '700',
    color: colors.accent,
  },
  planLine1: {
    ...typography.caption,
    color: colors.text,
    marginLeft: 28,
  },
  planLine2: {
    ...typography.caption,
    color: colors.textMuted,
    marginLeft: 28,
    marginTop: 2,
  },
  inlineMessageContainer: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inlineErrorContainer: {
    borderColor: colors.accent,
  },
  inlineMessageText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  inlineErrorText: {
    color: colors.accent,
    fontWeight: '500',
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.button,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  primaryButtonDisabled: {
    opacity: 0.85,
  },
  primaryButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.onAccent,
  },
  alternativeButton: {
    paddingVertical: spacing.xs + 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  alternativeButtonText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '500',
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  secondaryActionText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  secondaryActionDivider: {
    color: colors.textMuted,
  },
  footerLegal: {
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  legalNotice: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: spacing.xs,
  },
  legalLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legalLink: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    textDecorationLine: 'underline',
  },
  legalLinkDivider: {
    color: colors.textMuted,
    fontSize: 11,
  },
});
