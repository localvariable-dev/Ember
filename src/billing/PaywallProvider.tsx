/**
 * Paywall Provider & Controller
 * Master Plan Part 3 §4.1, §4.3, §4.4
 * Orchestrates paywall presentation, dynamic product retrieval, purchase execution, and outcome resolution.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ProtocolId } from '../domain/constants';
import { useSheetStore } from '../stores/useSheetStore';
import type { EntitlementService, PaywallVariant } from './entitlementTypes';
import type {
  BillingProduct,
  BillingService,
  OwnedPurchase,
  ProductId,
  PurchaseResult,
} from './types';

export type PaywallSource =
  'begin_locked' | 'bed_locked' | 'voice_locked' | 'insights_teaser' | 'membership';

export interface PaywallContext {
  source: PaywallSource;
  variant: PaywallVariant;
  protocolId?: ProtocolId | undefined;
}

export type PaywallOutcome = 'purchased' | 'restored' | 'dismissed' | 'alternative_chosen';

export interface PaywallContextValue {
  present: (ctx: PaywallContext) => Promise<PaywallOutcome>;
  dismiss: (outcome?: PaywallOutcome) => void;
  chooseAlternative: () => void;
  purchase: (productId: ProductId) => Promise<PurchaseResult>;
  restore: () => Promise<{ restored: boolean; count: number }>;
  products: BillingProduct[];
  activeContext: PaywallContext;
  isMock: boolean;
}

const defaultContext: PaywallContext = {
  source: 'membership',
  variant: 'default',
};

const PaywallReactContext = createContext<PaywallContextValue | null>(null);

export interface PaywallProviderProps {
  children: React.ReactNode;
  billingService: BillingService;
  entitlementService: EntitlementService;
}

export function PaywallProvider({
  children,
  billingService,
  entitlementService,
}: PaywallProviderProps) {
  const [products, setProducts] = useState<BillingProduct[]>([]);
  const resolverRef = useRef<((outcome: PaywallOutcome) => void) | null>(null);

  const { openSheet, closeSheet, activeSheet, payload } = useSheetStore();

  // Load products on mount
  useEffect(() => {
    let mounted = true;
    billingService
      .getProducts()
      .then((prods) => {
        if (mounted) setProducts(prods);
      })
      .catch((err) => {
        console.warn('Failed to load billing products:', err);
      });

    return () => {
      mounted = false;
    };
  }, [billingService]);

  // Derive activeContext from sheet state
  const activeContext = useMemo<PaywallContext>(() => {
    if (activeSheet === 'paywall') {
      const variant = (payload?.paywallVariant as PaywallVariant) || 'default';
      const source = (payload?.source as PaywallSource) || 'begin_locked';
      const rawProto = payload?.protocolId;
      const protocolId: ProtocolId | undefined =
        rawProto === 'rapid_reset_5' ||
        rawProto === 'afternoon_recharge_10' ||
        rawProto === 'deep_rest_30'
          ? rawProto
          : undefined;

      return { variant, source, protocolId };
    }
    return defaultContext;
  }, [activeSheet, payload]);

  const present = useCallback(
    (ctx: PaywallContext): Promise<PaywallOutcome> => {
      openSheet('paywall', {
        paywallVariant: ctx.variant,
        source: ctx.source,
        protocolId: ctx.protocolId,
      });

      return new Promise<PaywallOutcome>((resolve) => {
        resolverRef.current = resolve;
      });
    },
    [openSheet],
  );

  const dismiss = useCallback(
    (outcome: PaywallOutcome = 'dismissed') => {
      if (resolverRef.current) {
        resolverRef.current(outcome);
        resolverRef.current = null;
      }
      closeSheet();
    },
    [closeSheet],
  );

  const chooseAlternative = useCallback(() => {
    dismiss('alternative_chosen');
  }, [dismiss]);

  const purchase = useCallback(
    async (productId: ProductId): Promise<PurchaseResult> => {
      try {
        const result = await billingService.purchase(productId);
        if (result.status === 'purchased' || result.status === 'already_owned') {
          await entitlementService.applyPurchase(result);
        }
        return result;
      } catch (err) {
        return {
          status: 'failed',
          productId,
          error: {
            code: 'unknown',
            message: err instanceof Error ? err.message : 'Purchase failed',
          },
        };
      }
    },
    [billingService, entitlementService],
  );

  const restore = useCallback(async (): Promise<{ restored: boolean; count: number }> => {
    try {
      const owned: OwnedPurchase[] = await billingService.restore();
      if (owned.length > 0) {
        await entitlementService.applyOwned(owned);
        const snapshot = entitlementService.getSnapshot();
        const isPro = snapshot.level === 'pro';
        return { restored: isPro, count: owned.length };
      }
      return { restored: false, count: 0 };
    } catch {
      return { restored: false, count: 0 };
    }
  }, [billingService, entitlementService]);

  const isMock = billingService.id === 'mock';

  const value = useMemo<PaywallContextValue>(
    () => ({
      present,
      dismiss,
      chooseAlternative,
      purchase,
      restore,
      products,
      activeContext,
      isMock,
    }),
    [present, dismiss, chooseAlternative, purchase, restore, products, activeContext, isMock],
  );

  return <PaywallReactContext.Provider value={value}>{children}</PaywallReactContext.Provider>;
}

export function usePaywall(): PaywallContextValue {
  const context = useContext(PaywallReactContext);
  if (!context) {
    throw new Error('usePaywall must be used within a PaywallProvider');
  }
  return context;
}
