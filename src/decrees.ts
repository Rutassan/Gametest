import { Department, InvestmentPriority, TaxPolicy } from "./types";

export function taxIncomeModifier(policy: TaxPolicy): number {
  switch (policy) {
    case "low":
      return 0.9;
    case "high":
      return 1.15;
    case "standard":
    default:
      return 1.0;
  }
}

export function taxSatisfactionDelta(policy: TaxPolicy, estate: string): number {
  switch (policy) {
    case "low":
      return estate === "крестьянство" || estate === "буржуазия" ? 3 : -1;
    case "high":
      if (estate === "дворянство" || estate === "духовенство") {
        return 2;
      }
      return -3;
    case "standard":
    default:
      return 0;
  }
}

export function taxLoyaltyModifier(policy: TaxPolicy): number {
  switch (policy) {
    case "low":
      return 1.02;
    case "high":
      return 0.97;
    case "standard":
    default:
      return 1;
  }
}

export function priorityBudgetBoost(priority: InvestmentPriority, department: Department): number {
  switch (priority) {
    case "infrastructure":
      if (department === "economy" || department === "internal") {
        return 1.2;
      }
      return 0.95;
    case "military":
      if (department === "military") {
        return 1.35;
      }
      if (department === "internal") {
        return 1.1;
      }
      return 0.85;
    case "innovation":
      if (department === "science") {
        return 1.4;
      }
      if (department === "economy") {
        return 1.1;
      }
      return 0.9;
    case "stability":
      if (department === "internal") {
        return 1.3;
      }
      if (department === "diplomacy") {
        return 1.1;
      }
      return 0.9;
    case "balanced":
    default:
      return 1;
  }
}

export function priorityDevelopmentMultiplier(
  priority: InvestmentPriority,
  specialization: string
): number {
  switch (priority) {
    case "infrastructure":
      return specialization === "industry" ? 1.3 : 1.15;
    case "innovation":
      return specialization === "trade" ? 1.2 : 1.1;
    case "military":
      return specialization === "agriculture" ? 1.05 : 1.0;
    case "stability":
      return 1.05;
    case "balanced":
    default:
      return 1;
  }
}
