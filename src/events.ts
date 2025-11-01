import { Estate, Region, SimulationEvent, SimulationEventFailure, SimulationEventOption } from "./types";

export interface EventTemplateContext {
  region?: Region;
  estate?: Estate;
  milestone?: number;
  loyalty?: number;
  satisfaction?: number;
  treasury?: number;
}

interface EventTemplateDefinition {
  id: string;
  category: SimulationEvent["category"];
  severity: SimulationEvent["severity"];
  title: (context: EventTemplateContext) => string;
  description: (context: EventTemplateContext) => string;
  factions: (context: EventTemplateContext) => string[];
  triggers: (context: EventTemplateContext) => string[];
  conditions: (context: EventTemplateContext) => SimulationEvent["conditions"];
  options: (context: EventTemplateContext) => SimulationEventOption[];
  failure: (context: EventTemplateContext) => SimulationEventFailure;
  escalation?: (context: EventTemplateContext) => SimulationEvent["escalation"];
}

const EVENT_TEMPLATES: Record<string, EventTemplateDefinition> = {
  "region.infrastructure.milestone": {
    id: "region.infrastructure.milestone",
    category: "Технологические / магические открытия",
    severity: "minor",
    title: ({ region, milestone }) =>
      `Инфраструктура ${region?.name ?? "региона"} достигает нового рубежа`,
    description: ({ region, milestone }) =>
      `Обновления коммуникаций в регионе ${region?.name ?? ""} выводят инфраструктуру на уровень ${
        milestone?.toFixed(1) ?? ""
      }.`,
    factions: () => ["Корона / центральная власть", "Гильдии купцов"],
    triggers: ({ region }) => [
      `metric:regions.${region?.name ?? "unknown"}.infrastructure`,
      "flag:infrastructure_milestone",
    ],
    conditions: ({ region, milestone }) => ({
      metrics: {
        [`regions.${region?.name ?? "unknown"}.infrastructure`]: `>= ${
          milestone?.toFixed(0) ?? ""
        }`,
      },
    }),
    options: ({ region }) => [
      {
        id: "infrastructure_bonus",
        description: "Продолжить финансирование проектов и закрепить успех",
        cost: { gold: 45, influence: 5 },
        effects: [
          {
            type: "infrastructure",
            target: region?.name ?? "",
            value: 2,
            duration: 2,
          },
        ],
        followUps: ["region.infrastructure.audit"],
        cooldown: 2,
      },
      {
        id: "diversify_budget",
        description: "Перенаправить часть средств в другие провинции",
        cost: { influence: 4 },
        effects: [
          {
            type: "wealth",
            target: region?.name ?? "",
            value: -5,
          },
        ],
        followUps: ["region.infrastructure.stagnation"],
      },
    ],
    failure: ({ region }) => ({
      timeout: 2,
      description:
        "Проект растянется и часть подрядчиков начнёт экономить на материалах.",
      effects: [
        {
          type: "infrastructure",
          target: region?.name ?? "",
          value: -2,
        },
      ],
    }),
    escalation: ({ region }) => [
      {
        chance: 0.2,
        followUp: "region.infrastructure.overextension",
        description: `Если не обеспечить контроль, затраты в регионе ${
          region?.name ?? ""
        } выйдут из-под контроля.`,
      },
    ],
  },
  "region.loyalty.decline": {
    id: "region.loyalty.decline",
    category: "Социальные потрясения",
    severity: "moderate",
    title: ({ region, loyalty }) =>
      `Лояльность ${region?.name ?? "территории"} опускается до ${
        loyalty?.toFixed(1) ?? ""
      }%`,
    description: ({ region }) =>
      `Представители населения ${region?.name ?? ""} жалуются на произвол чиновников и падение качества жизни.`,
    factions: () => ["Крестьянство / горожане", "Корона / центральная власть"],
    triggers: ({ region }) => [
      `metric:regions.${region?.name ?? "unknown"}.loyalty`,
      "flag:loyalty_warning",
    ],
    conditions: ({ region, loyalty }) => ({
      metrics: {
        [`regions.${region?.name ?? "unknown"}.loyalty`]: `<= ${
          loyalty?.toFixed(0) ?? ""
        }`,
      },
      flags: ["loyalty_warning"],
    }),
    options: ({ region }) => [
      {
        id: "appease_population",
        description: "Отправить эмиссаров и пообещать реформы",
        cost: { influence: 12, gold: 25 },
        effects: [
          {
            type: "loyalty",
            target: region?.name ?? "",
            value: 6,
            duration: 3,
          },
        ],
        followUps: ["region.loyalty.reform_progress"],
      },
      {
        id: "deploy_garrison",
        description: "Усилить гарнизон и подавить очаги волнений",
        cost: { labor: 35 },
        effects: [
          {
            type: "loyalty",
            target: region?.name ?? "",
            value: 2,
          },
          {
            type: "influence",
            target: "Корона / центральная власть",
            value: -4,
          },
        ],
        followUps: ["region.loyalty.resistance"],
        cooldown: 1,
      },
    ],
    failure: ({ region }) => ({
      timeout: 1,
      description: "Волнения перерастают в стихийные протесты.",
      effects: [
        {
          type: "unrest",
          target: region?.name ?? "",
          value: 1,
        },
      ],
    }),
    escalation: ({ region }) => [
      {
        chance: 0.35,
        followUp: "region.loyalty.uprising",
        description: `Слухи о бунтах в регионе ${region?.name ?? ""} распространяются по соседним провинциям.`,
      },
    ],
  },
  "estate.dissatisfaction": {
    id: "estate.dissatisfaction",
    category: "Политические интриги",
    severity: "major",
    title: ({ estate }) =>
      `${estate?.name ?? "Влиятельная группа"} готовит политическое давление`,
    description: ({ estate }) =>
      `Лидеры сословия ${estate?.name ?? ""} требуют пересмотра текущей политики и угрожают саботажем решений совета.`,
    factions: ({ estate }) => [estate?.name ?? "влиятельное сословие", "Корона / центральная власть"],
    triggers: ({ estate }) => [
      `metric:estates.${estate?.name ?? "unknown"}.satisfaction`,
      "flag:estate_pressure",
    ],
    conditions: ({ estate, satisfaction }) => ({
      metrics: {
        [`estates.${estate?.name ?? "unknown"}.satisfaction`]: `<= ${
          satisfaction?.toFixed(0) ?? ""
        }`,
      },
      flags: ["estate_pressure"],
    }),
    options: ({ estate }) => [
      {
        id: "negotiate_concessions",
        description: "Предложить ограниченные уступки и инвестиции",
        cost: { gold: 30, influence: 10 },
        effects: [
          {
            type: "satisfaction",
            target: estate?.name ?? "",
            value: 8,
          },
        ],
        followUps: ["estate.monitoring"],
      },
      {
        id: "stand_firm",
        description: "Отказать в требованиях и собрать компромат",
        cost: { influence: 6 },
        effects: [
          {
            type: "influence",
            target: estate?.name ?? "",
            value: -3,
          },
          {
            type: "satisfaction",
            target: estate?.name ?? "",
            value: -2,
          },
        ],
        followUps: ["estate.retaliation"],
      },
    ],
    failure: ({ estate }) => ({
      timeout: 2,
      description: "Сословие собирает коалицию и блокирует инициативы совета.",
      effects: [
        {
          type: "influence",
          target: estate?.name ?? "",
          value: 5,
        },
        {
          type: "satisfaction",
          target: estate?.name ?? "",
          value: -4,
        },
      ],
    }),
    escalation: ({ estate }) => [
      {
        chance: 0.4,
        followUp: "estate.cabal",
        description: `Фракция ${estate?.name ?? ""} формирует подпольный союз и ищет внешнюю поддержку.`,
      },
    ],
  },
  "treasury.depletion": {
    id: "treasury.depletion",
    category: "Экономический кризис",
    severity: "moderate",
    title: ({ treasury }) =>
      `Казна иссякает: резервов остаётся ${treasury?.toFixed(1) ?? ""} золота`,
    description: () =>
      "Совет предупреждает о невозможности финансировать обязательства без срочных мер экономии.",
    factions: () => ["Корона / центральная власть", "Гильдии купцов"],
    triggers: () => ["metric:treasury", "flag:budget_alert"],
    conditions: () => ({
      metrics: {
        treasury: "<= 120",
      },
      flags: ["budget_alert"],
    }),
    options: () => [
      {
        id: "austerity_measure",
        description: "Ввести режим экономии и сократить финансирование ведомств",
        effects: [
          {
            type: "budget",
            target: "all",
            value: -15,
          },
        ],
        followUps: ["treasury.recovery_plan"],
      },
      {
        id: "emergency_loan",
        description: "Взять займ у гильдий под высокий процент",
        cost: { influence: 8 },
        effects: [
          {
            type: "treasury",
            target: "gold",
            value: 80,
          },
          {
            type: "reputation",
            target: "гильдии",
            value: -3,
          },
        ],
        followUps: ["treasury.debt_payments"],
      },
    ],
    failure: () => ({
      timeout: 1,
      description: "Поставщики прекращают поставки и требуют авансовых платежей.",
      effects: [
        {
          type: "treasury",
          target: "gold",
          value: -50,
        },
        {
          type: "stability",
          target: "империя",
          value: -1,
        },
      ],
    }),
    escalation: () => [
      {
        chance: 0.25,
        followUp: "treasury.default",
        description: "Гильдии угрожают объявить дефолт по государственным облигациям.",
      },
    ],
  },
};

function instantiateEvent(
  templateId: keyof typeof EVENT_TEMPLATES,
  context: EventTemplateContext
): SimulationEvent {
  const template = EVENT_TEMPLATES[templateId];
  const event: SimulationEvent = {
    id: template.id,
    category: template.category,
    severity: template.severity,
    title: template.title(context),
    description: template.description(context),
    factions: template.factions(context),
    triggers: template.triggers(context),
    conditions: template.conditions(context),
    options: template.options(context),
    failure: template.failure(context),
  };

  const escalation = template.escalation?.(context);
  if (escalation && escalation.length > 0) {
    event.escalation = escalation;
  }

  return event;
}

export function createInfrastructureMilestoneEvent(
  region: Region,
  milestone: number
): SimulationEvent {
  return instantiateEvent("region.infrastructure.milestone", { region, milestone });
}

export function createLoyaltyDeclineEvent(
  region: Region,
  loyalty: number
): SimulationEvent {
  return instantiateEvent("region.loyalty.decline", { region, loyalty });
}

export function createEstateDissatisfactionEvent(
  estate: Estate,
  satisfaction: number
): SimulationEvent {
  return instantiateEvent("estate.dissatisfaction", { estate, satisfaction });
}

export function createTreasuryDepletionEvent(treasury: number): SimulationEvent {
  return instantiateEvent("treasury.depletion", { treasury });
}

export const eventTemplates = EVENT_TEMPLATES;
