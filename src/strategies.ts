import {
  EventDecisionContext,
  EventDecisionStrategy,
  SimulationEvent,
  SimulationEventOption,
  SimulationEventEffect,
} from "./types";

function scoreEffect(effect: SimulationEventEffect, context: EventDecisionContext): number {
  const severityMultiplier = effect.duration ? 1 + effect.duration * 0.2 : 1;
  const baseValue = effect.value * severityMultiplier;
  switch (effect.type) {
    case "stability":
      if (context.kpis?.stability.threatLevel === "critical") {
        return baseValue * 4;
      }
      if (context.kpis?.stability.threatLevel === "moderate") {
        return baseValue * 2.5;
      }
      return baseValue * 1.5;
    case "loyalty":
      return baseValue * 2.2;
    case "threat":
      return baseValue * -6;
    case "wealth":
      return baseValue * 1.8;
    case "treasury":
      return baseValue * 1.2;
    case "reputation":
      return baseValue * 0.9;
    case "infrastructure":
      return baseValue * 1.4;
    default:
      return baseValue;
  }
}

function scoreOption(
  event: SimulationEvent,
  option: SimulationEventOption,
  context: EventDecisionContext
): number {
  const trust = context.trust.advisor;
  const severityPenalty = event.severity === "major" ? 60 : event.severity === "moderate" ? 35 : 10;

  const totalEffects = option.effects.reduce(
    (acc, effect) => acc + scoreEffect(effect, context),
    0
  );

  const cost =
    (option.cost?.gold ?? 0) * 1.4 +
    (option.cost?.influence ?? 0) * 1.8 +
    (option.cost?.labor ?? 0) * 0.8;

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

  return totalEffects - cost + trustBonus + stabilityDebt + threatDebt - severityPenalty + followUpBonus;
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

