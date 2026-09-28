/**
 * Rewards Configuration
 * Configuration for customer loyalty, tokens, and tier settings.
 */

export interface RewardTier {
  id: string;
  name: string;
  minSpend: number;
  pointsMultiplier: number;
  badgeColor?: string;
  benefits: string[];
}

export interface RewardsConfig {
  enabled: boolean;
  currencyToPointsRatio: number; // e.g. 1 point per 100 PKR spent
  pointsToDiscountRatio: number; // e.g. 100 points = 50 PKR discount
  tiers: RewardTier[];
  referralBonusPoints: number;
  reviewBonusPoints: number;
}

export const REWARDS_CONFIG: RewardsConfig = {
  enabled: false,
  currencyToPointsRatio: 1,
  pointsToDiscountRatio: 0.5,
  tiers: [
    {
      id: "member",
      name: "Club Member",
      minSpend: 0,
      pointsMultiplier: 1.0,
      badgeColor: "var(--charcoal)",
      benefits: ["Earn points on every order", "Early access to drops"],
    },
    {
      id: "silver",
      name: "Silver Tier",
      minSpend: 15000,
      pointsMultiplier: 1.25,
      badgeColor: "#94a3b8",
      benefits: ["1.25x point booster", "Free shipping on all orders"],
    },
    {
      id: "gold",
      name: "Gold Tier",
      minSpend: 35000,
      pointsMultiplier: 1.5,
      badgeColor: "var(--lime)",
      benefits: ["1.5x point booster", "VIP drops", "Exclusive gifts"],
    },
  ],
  referralBonusPoints: 100,
  reviewBonusPoints: 50,
};
