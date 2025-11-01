import {
  CouncilMemberState,
  Department,
  EventDecisionContext,
  EventDecisionStrategy,
  ResponsePostureMode,
  SimulationEvent,
  SimulationEventOption,
  SimulationEventEffect,
} from "./types";

const AGENDA_PRIORITY_WEIGHTS = {
  neglect: 0.85,
  steady: 1,
  push: 1.2,
} as const;

interface CostProfile {
  gold: number;
  influence: number;
  labor: number;
  severity: number;
}

function postureCostProfile(posture: ResponsePostureMode): CostProfile {
  switch (posture) {
    case "forceful":
      return { gold: 1, influence: 1.15, labor: 0.9, severity: -8 };
    case "diplomatic":
      return { gold: 1.1, influence: 0.8, labor: 1, severity: -2 };
    case "covert":
      return { gold: 1.05, influence: 1, labor: 0.95, severity: -5 };
    case "balanced":
    default:
      return { gold: 1, influence: 1, labor: 1, severity: 0 };
  }
}

function inferDepartment(effect: SimulationEventEffect): Department | null {
  switch (effect.type) {
    case "treasury":
    case "wealth":
    case "infrastructure":
      return "economy";
    case "reputation":
    case "influence":
      return "diplomacy";
    case "loyalty":
    case "stability":
    case "unrest":
      return "internal";
    case "threat":
    case "securityPressure":
      return "military";
    case "science":
      return "science";
    default:
      return null;
  }
}

function agendaWeight(effect: SimulationEventEffect, context: EventDecisionContext): number {
  const department = inferDepartment(effect);
  if (!department) {
    return 1;
  }
  const priority = context.agenda.priorities[department];
  const weight = AGENDA_PRIORITY_WEIGHTS[priority] ?? 1;
  if (effect.value < 0 && weight > 1) {
    return 1 / weight;
  }
  if (effect.value > 0 && weight < 1) {
    return weight;
  }
  return weight;
}

function postureWeight(effect: SimulationEventEffect, posture: ResponsePostureMode): number {
  switch (posture) {
    case "forceful":
      if (effect.type === "threat" || effect.type === "securityPressure") {
        return effect.value < 0 ? 1.8 : 0.7;
      }
      if (effect.type === "loyalty" || effect.type === "stability") {
        return 1.2;
      }
      return 1;
    case "diplomatic":
      if (effect.type === "reputation" || effect.type === "influence") {
        return effect.value > 0 ? 1.4 : 0.6;
      }
      if (effect.type === "threat") {
        return effect.value < 0 ? 1.1 : 0.8;
      }
      return 1;
    case "covert":
      if (effect.type === "securityPressure" || effect.type === "threat") {
        return effect.value < 0 ? 1.5 : 0.8;
      }
      if (effect.type === "loyalty") {
        return 1.1;
      }
      return 1;
    case "balanced":
    default:
      return 1;
  }
}

function activeMandateWeight(effect: SimulationEventEffect, context: EventDecisionContext): number {
  const mandates = context.agenda.mandates;
  if (!mandates || mandates.length === 0) {
    return 1;
  }
  for (const mandate of mandates) {
    if (mandate.status === "completed" || mandate.status === "failed") {
      continue;
    }
    switch (mandate.goal) {
      case "stabilize_region":
        if (effect.type === "loyalty" && mandate.target.kind === "region" && effect.target === mandate.target.name) {
          return 1.5;
        }
        if (effect.type === "stability") {
          return 1.2;
        }
        break;
      case "fortify_border":
        if (effect.type === "threat" || effect.type === "securityPressure") {
          return effect.value < 0 ? 1.6 : 0.6;
        }
        break;
      case "boost_economy":
        if (effect.type === "treasury" || effect.type === "wealth" || effect.type === "infrastructure") {
          return effect.value > 0 ? 1.4 : 0.7;
        }
        break;
      case "advance_science":
        if (effect.type === "science" || effect.type === "treasury" && effect.target === "influence") {
          return 1.3;
        }
        break;
      case "improve_diplomacy":
        if (effect.type === "reputation" || effect.type === "influence") {
          return 1.4;
        }
        break;
      case "suppress_unrest":
        if (effect.type === "stability" || effect.type === "unrest") {
          return 1.5;
        }
        break;
      case "expand_influence":
        if (effect.type === "influence" || effect.type === "reputation") {
          return 1.35;
        }
        break;
      default:
        break;
    }
  }
  return 1;
}

function portfolioSupports(portfolio: CouncilMemberState["portfolio"], department: Department): boolean {
  switch (portfolio) {
    case "economy":
    case "diplomacy":
    case "internal":
    case "military":
    case "science":
      return portfolio === department;
    case "navy":
      return department === "military";
    case "intelligence":
      return department === "internal" || department === "military";
    case "logistics":
      return department === "economy" || department === "internal";
    default:
      return false;
  }
}

function councilSupportBonus(council: CouncilMemberState[], department: Department): number {
  const supporters = council.filter((member) => portfolioSupports(member.portfolio, department));
  if (supporters.length === 0) {
    return 0;
  }
  const aggregate = supporters.reduce(
    (acc, member) => acc + member.motivation * 0.5 + member.loyalty * 0.3 - member.stress * 0.2,
    0
  );
  return aggregate * 5;
}

function scoreEffect(effect: SimulationEventEffect, context: EventDecisionContext): number {
  const severityMultiplier = effect.duration ? 1 + effect.duration * 0.2 : 1;
  let score = effect.value * severityMultiplier;
  let typeMultiplier = 1;
  switch (effect.type) {
    case "stability":
      if (context.kpis?.stability.threatLevel === "critical") {
        typeMultiplier = 4;
      }
      if (context.kpis?.stability.threatLevel === "moderate") {
        typeMultiplier = 2.5;
      }
      typeMultiplier = 1.5;
      break;
    case "loyalty":
      typeMultiplier = 2.2;
      break;
    case "threat":
      typeMultiplier = -6;
      break;
    case "wealth":
      typeMultiplier = 1.8;
      break;
    case "treasury":
      typeMultiplier = 1.2;
      break;
    case "reputation":
      typeMultiplier = 0.9;
      break;
    case "infrastructure":
      typeMultiplier = 1.4;
      break;
    default:
      typeMultiplier = 1;
      break;
  }
  score *= typeMultiplier;
  const agendaModifier = agendaWeight(effect, context);
  const postureModifier = postureWeight(effect, context.posture);
  const mandateModifier = activeMandateWeight(effect, context);
  return score * agendaModifier * postureModifier * mandateModifier;
}

function scoreOption(
  event: SimulationEvent,
  option: SimulationEventOption,
  context: EventDecisionContext
): number {
  const trust = context.trust.advisor;
  const costProfile = postureCostProfile(context.posture);
  const severityBase = event.severity === "major" ? 60 : event.severity === "moderate" ? 35 : 10;
  const severityPenalty = Math.max(0, severityBase + costProfile.severity);

  const totalEffects = option.effects.reduce(
    (acc, effect) => acc + scoreEffect(effect, context),
    0
  );

  const cost =
    (option.cost?.gold ?? 0) * 1.4 * costProfile.gold +
    (option.cost?.influence ?? 0) * 1.8 * costProfile.influence +
    (option.cost?.labor ?? 0) * 0.8 * costProfile.labor;

  const trustBonus = trust > 0.75 ? (trust - 0.75) * 40 : 0;
  const stabilityDebt =
    context.kpis && context.kpis.stability.threatLevel !== "low"
      ? 25
      : 0;
  const threatDebt =
    context.kpis && context.kpis.securityIndex.threatLevel !== "low"
      ? 35
      : 0;

  const followUpBonus = (option.followUps?.length ?? 0) * 5;
  const impactedDepartments = new Set<Department>();
  for (const effect of option.effects) {
    const department = inferDepartment(effect);
    if (department) {
      impactedDepartments.add(department);
    }
  }

  const councilBonus = Array.from(impactedDepartments).reduce(
    (acc, department) => acc + councilSupportBonus(context.council, department),
    0
  );

  return (
    totalEffects -
    cost +
    trustBonus +
    stabilityDebt +
    threatDebt -
    severityPenalty +
    followUpBonus +
    councilBonus
  );
}

export const pragmaticDecisionStrategy: EventDecisionStrategy = (event, context) => {
  const actionableOptions = event.options.filter(
    (option) => option.effects.length > 0 || option.followUps?.length
  );

  if (actionableOptions.length === 0) {
    return { optionId: null, defer: true, notes: "Нет полезных опций" };
  }

  const ranked = actionableOptions
    .map((option) => ({
      option,
      score: scoreOption(event, option, context),
    }))
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];
  if (!top || top.score < -40) {
    return { optionId: null, defer: true, notes: "Решение отложено: все варианты слишком рискованные" };
  }

  return { optionId: top.option.id };
};

export const manualControlDecisionStrategy: EventDecisionStrategy = (event, context) => {
  const base = pragmaticDecisionStrategy(event, context);
  if (base.optionId) {
    return {
      optionId: base.optionId,
      defer: true,
      notes: base.notes ?? "Ручной режим: совет предлагает вариант и ждёт подтверждения правителя",
    };
  }
  return {
    optionId: null,
    defer: true,
    notes: base.notes ?? "Ручной режим: требуется решение правителя",
  };
};

export const hybridControlDecisionStrategy: EventDecisionStrategy = (event, context) => {
  const base = pragmaticDecisionStrategy(event, context);
  const requiresManual =
    event.severity === "major" ||
    (context.trust.advisor < 0.6 && event.severity !== "minor") ||
    base.optionId === null;

  if (requiresManual) {
    return {
      optionId: base.optionId,
      defer: true,
      notes:
        base.notes ??
        "Гибридный режим: критичное событие передано правителю для утверждения",
    };
  }

  return base;
};
