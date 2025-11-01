import {
  AdvisorOutcomePreview,
  Estate,
  EventDecisionContext,
  EventInterventionOptionSummary,
  EventInterventionPanel,
  EventOrigin,
  Region,
  SimulationEvent,
  SimulationEventFailure,
  SimulationEventOption,
  ThreatLevel,
} from "./types";

export interface EventTemplateContext {
  region?: Region;
  estate?: Estate;
  milestone?: number;
  loyalty?: number;
  satisfaction?: number;
  treasury?: number;
  metric?: string;
  threatLevel?: ThreatLevel;
  source?: string;
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
  "region.infrastructure.audit": {
    id: "region.infrastructure.audit",
    category: "Технологические / магические открытия",
    severity: "minor",
    title: ({ region }) =>
      `Аудит инфраструктурных проектов в регионе ${region?.name ?? ""}`,
    description: ({ region }) =>
      `Контрольная комиссия проверяет, насколько эффективно используются инвестиции в ${
        region?.name ?? "регион"
      }.`,
    factions: () => ["Корона / центральная власть", "Гильдии купцов"],
    triggers: ({ region }) => [
      `followup:region.infrastructure.milestone`,
      `metric:regions.${region?.name ?? "unknown"}.infrastructure`,
    ],
    conditions: ({ region }) => ({
      metrics: {
        [`regions.${region?.name ?? "unknown"}.infrastructure`]: ">= 60",
      },
    }),
    options: ({ region }) => [
      {
        id: "reinforce_supervision",
        description: "Расширить надзор и привлечь независимых аудиторов",
        cost: { influence: 4, gold: 20 },
        effects: [
          {
            type: "infrastructure",
            target: region?.name ?? "",
            value: 1,
            duration: 2,
          },
          {
            type: "stability",
            target: region?.name ?? "",
            value: 1,
          },
        ],
      },
      {
        id: "accept_results",
        description: "Принять отчёт и перераспределить высвободившиеся средства",
        effects: [
          {
            type: "treasury",
            target: "gold",
            value: 30,
          },
          {
            type: "loyalty",
            target: region?.name ?? "",
            value: -1,
          },
        ],
        followUps: ["region.infrastructure.stagnation"],
      },
    ],
    failure: ({ region }) => ({
      timeout: 2,
      description: "Нарушения остаются без внимания, и подрядчики завышают счета.",
      effects: [
        {
          type: "treasury",
          target: "gold",
          value: -40,
        },
        {
          type: "infrastructure",
          target: region?.name ?? "",
          value: -2,
        },
      ],
    }),
  },
  "region.infrastructure.stagnation": {
    id: "region.infrastructure.stagnation",
    category: "Экономический кризис",
    severity: "moderate",
    title: ({ region }) =>
      `Темпы строительства в регионе ${region?.name ?? ""} замирают`,
    description: ({ region }) =>
      `Подрядчики сообщают о нехватке средств и рабочих рук, из-за чего объекты ${
        region?.name ?? "региона"
      } простаивают.`,
    factions: ({ region }) => ["Гильдии купцов", region?.name ?? "региональные элиты"],
    triggers: ({ region }) => [
      `followup:region.infrastructure.milestone`,
      `metric:regions.${region?.name ?? "unknown"}.infrastructure`,
    ],
    conditions: ({ region }) => ({
      metrics: {
        [`regions.${region?.name ?? "unknown"}.infrastructure`]: "<= 55",
      },
    }),
    options: ({ region }) => [
      {
        id: "restart_investments",
        description: "Срочно выделить дополнительные субсидии",
        cost: { gold: 60, labor: 20 },
        effects: [
          {
            type: "infrastructure",
            target: region?.name ?? "",
            value: 2,
            duration: 2,
          },
          {
            type: "loyalty",
            target: region?.name ?? "",
            value: 2,
          },
        ],
      },
      {
        id: "scale_back",
        description: "Законсервировать часть проектов до лучших времён",
        effects: [
          {
            type: "treasury",
            target: "gold",
            value: 20,
          },
          {
            type: "infrastructure",
            target: region?.name ?? "",
            value: -1,
          },
        ],
        followUps: ["region.infrastructure.overextension"],
      },
    ],
    failure: ({ region }) => ({
      timeout: 1,
      description: "Проекты простаивают, а коррупция поедает бюджет.",
      effects: [
        {
          type: "stability",
          target: region?.name ?? "",
          value: -1,
        },
        {
          type: "treasury",
          target: "gold",
          value: -35,
        },
      ],
    }),
    escalation: ({ region }) => [
      {
        chance: 0.3,
        followUp: "region.infrastructure.overextension",
        description: `Бюджетные дыры в регионе ${region?.name ?? ""} грозят перерасти в полномасштабный кризис.`,
      },
    ],
  },
  "region.infrastructure.overextension": {
    id: "region.infrastructure.overextension",
    category: "Экономический кризис",
    severity: "major",
    title: ({ region }) =>
      `Перерасход бюджета в ${region?.name ?? "регионе"} достигает критической точки`,
    description: ({ region }) =>
      `Накопленные долги и неоконченные проекты в ${region?.name ?? ""} вызывают тревогу у инвесторов и населения.`,
    factions: () => ["Корона / центральная власть", "Гильдии купцов"],
    triggers: ({ region }) => [
      `followup:region.infrastructure.stagnation`,
      `metric:regions.${region?.name ?? "unknown"}.infrastructure`,
      "flag:infrastructure_overextension",
    ],
    conditions: ({ region }) => ({
      metrics: {
        [`regions.${region?.name ?? "unknown"}.infrastructure`]: "<= 50",
      },
      flags: ["infrastructure_overextension"],
    }),
    options: ({ region }) => [
      {
        id: "emergency_oversight",
        description: "Ввести внешнее управление и сократить расходы",
        cost: { influence: 8 },
        effects: [
          {
            type: "treasury",
            target: "gold",
            value: 50,
          },
          {
            type: "loyalty",
            target: region?.name ?? "",
            value: -3,
          },
        ],
      },
      {
        id: "double_down",
        description: "Удвоить инвестиции, чтобы завершить ключевые объекты",
        cost: { gold: 110, labor: 30 },
        effects: [
          {
            type: "infrastructure",
            target: region?.name ?? "",
            value: 4,
            duration: 3,
          },
          {
            type: "stability",
            target: region?.name ?? "",
            value: 1,
          },
        ],
      },
    ],
    failure: ({ region }) => ({
      timeout: 1,
      description: "Проекты срываются, репутация властей подорвана.",
      effects: [
        {
          type: "stability",
          target: region?.name ?? "",
          value: -2,
        },
        {
          type: "treasury",
          target: "gold",
          value: -80,
        },
      ],
    }),
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
  "region.loyalty.reform_progress": {
    id: "region.loyalty.reform_progress",
    category: "Социальные потрясения",
    severity: "minor",
    title: ({ region }) =>
      `Реформы начинают менять настроение в ${region?.name ?? "регионе"}`,
    description: ({ region }) =>
      `Команды реформаторов собирают отзывы жителей ${region?.name ?? ""} и предлагают пилотные проекты по улучшению жизни.`,
    factions: () => ["Крестьянство / горожане", "Реформисты"],
    triggers: ({ region }) => [
      `followup:region.loyalty.decline`,
      `metric:regions.${region?.name ?? "unknown"}.loyalty`,
    ],
    conditions: ({ region }) => ({
      metrics: {
        [`regions.${region?.name ?? "unknown"}.loyalty`]: ">= 55",
      },
    }),
    options: ({ region }) => [
      {
        id: "fund_pilots",
        description: "Запустить пилотные проекты по запросам жителей",
        cost: { gold: 35, influence: 6 },
        effects: [
          {
            type: "loyalty",
            target: region?.name ?? "",
            value: 4,
            duration: 2,
          },
          {
            type: "stability",
            target: region?.name ?? "",
            value: 1,
          },
        ],
      },
      {
        id: "publicize_success",
        description: "Развернуть пропаганду о будущих переменах",
        cost: { influence: 4 },
        effects: [
          {
            type: "reputation",
            target: "Корона / центральная власть",
            value: 2,
          },
        ],
        followUps: ["region.loyalty.resistance"],
      },
    ],
    failure: ({ region }) => ({
      timeout: 2,
      description: "Обещания остаются на бумаге, а скепсис растёт.",
      effects: [
        {
          type: "loyalty",
          target: region?.name ?? "",
          value: -4,
        },
        {
          type: "unrest",
          target: region?.name ?? "",
          value: 1,
        },
      ],
    }),
  },
  "region.loyalty.resistance": {
    id: "region.loyalty.resistance",
    category: "Социальные потрясения",
    severity: "moderate",
    title: ({ region }) =>
      `Оппозиционные лидеры ${region?.name ?? "региона"} формируют сопротивление`,
    description: ({ region }) =>
      `Часть влиятельных семей ${region?.name ?? ""} саботирует реформы, распространяя слухи о слабости центральной власти.`,
    factions: () => ["Корона / центральная власть", "Региональные элиты"],
    triggers: ({ region }) => [
      `followup:region.loyalty.decline`,
      `metric:regions.${region?.name ?? "unknown"}.loyalty`,
    ],
    conditions: ({ region }) => ({
      metrics: {
        [`regions.${region?.name ?? "unknown"}.loyalty`]: "<= 50",
      },
    }),
    options: ({ region }) => [
      {
        id: "target_leaders",
        description: "Убрать зачинщиков из управления регионом",
        cost: { influence: 10 },
        effects: [
          {
            type: "loyalty",
            target: region?.name ?? "",
            value: 3,
          },
          {
            type: "reputation",
            target: "Региональные элиты",
            value: -2,
          },
        ],
      },
      {
        id: "broaden_dialogue",
        description: "Расширить совет с местными лидерами и предложить компромиссы",
        cost: { gold: 20, influence: 5 },
        effects: [
          {
            type: "loyalty",
            target: region?.name ?? "",
            value: 2,
          },
          {
            type: "stability",
            target: region?.name ?? "",
            value: 1,
          },
        ],
        followUps: ["region.loyalty.reform_progress"],
      },
    ],
    failure: ({ region }) => ({
      timeout: 1,
      description: "Сопротивление набирает силу и переходит к уличным выступлениям.",
      effects: [
        {
          type: "unrest",
          target: region?.name ?? "",
          value: 2,
        },
      ],
    }),
    escalation: ({ region }) => [
      {
        chance: 0.45,
        followUp: "region.loyalty.uprising",
        description: `Протесты в ${region?.name ?? ""} перерастают в вооружённые столкновения.`,
      },
    ],
  },
  "region.loyalty.uprising": {
    id: "region.loyalty.uprising",
    category: "Социальные потрясения",
    severity: "major",
    title: ({ region }) =>
      `Открытое восстание в ${region?.name ?? "регионе"}`,
    description: ({ region }) =>
      `Протестующие берут под контроль ключевые кварталы ${region?.name ?? ""} и требуют смены наместника.`,
    factions: () => ["Корона / центральная власть", "Крестьянство / горожане", "Региональные элиты"],
    triggers: ({ region }) => [
      `escalation:region.loyalty.decline`,
      `metric:regions.${region?.name ?? "unknown"}.loyalty`,
    ],
    conditions: ({ region }) => ({
      metrics: {
        [`regions.${region?.name ?? "unknown"}.loyalty`]: "<= 40",
      },
      flags: ["loyalty_uprising"],
    }),
    options: ({ region }) => [
      {
        id: "negotiate_truce",
        description: "Объявить амнистию и начать переговоры под гарантии церкви",
        cost: { influence: 12, gold: 40 },
        effects: [
          {
            type: "loyalty",
            target: region?.name ?? "",
            value: 5,
          },
          {
            type: "stability",
            target: region?.name ?? "",
            value: 2,
          },
        ],
      },
      {
        id: "military_crackdown",
        description: "Ввести войска и подавить восстание силой",
        cost: { labor: 60 },
        effects: [
          {
            type: "loyalty",
            target: region?.name ?? "",
            value: -2,
          },
          {
            type: "stability",
            target: region?.name ?? "",
            value: 3,
          },
          {
            type: "reputation",
            target: "Корона / центральная власть",
            value: -3,
          },
        ],
      },
    ],
    failure: ({ region }) => ({
      timeout: 1,
      description: "Восставшие укрепляют позиции и провозглашают автономию.",
      effects: [
        {
          type: "stability",
          target: region?.name ?? "",
          value: -3,
        },
        {
          type: "treasury",
          target: "gold",
          value: -60,
        },
      ],
    }),
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
  "estate.monitoring": {
    id: "estate.monitoring",
    category: "Политические интриги",
    severity: "minor",
    title: ({ estate }) =>
      `Компромисс с ${estate?.name ?? "сословием"}: создан наблюдательный совет`,
    description: ({ estate }) =>
      `Стороны договариваются о совместном контроле реформ, чтобы удовлетворить притязания ${estate?.name ?? "сословия"}.`,
    factions: ({ estate }) => [estate?.name ?? "сословие", "Корона / центральная власть"],
    triggers: ({ estate }) => [
      `followup:estate.dissatisfaction`,
      `metric:estates.${estate?.name ?? "unknown"}.satisfaction`,
    ],
    conditions: ({ estate }) => ({
      metrics: {
        [`estates.${estate?.name ?? "unknown"}.satisfaction`]: ">= 55",
      },
    }),
    options: ({ estate }) => [
      {
        id: "empower_board",
        description: "Дать совету реальные полномочия и финансирование",
        cost: { gold: 25, influence: 6 },
        effects: [
          {
            type: "satisfaction",
            target: estate?.name ?? "",
            value: 4,
          },
          {
            type: "stability",
            target: estate?.name ?? "",
            value: 1,
          },
        ],
      },
      {
        id: "symbolic_role",
        description: "Ограничить совет консультативными функциями",
        effects: [
          {
            type: "influence",
            target: estate?.name ?? "",
            value: -2,
          },
          {
            type: "satisfaction",
            target: estate?.name ?? "",
            value: -1,
          },
        ],
        followUps: ["estate.retaliation"],
      },
    ],
    failure: ({ estate }) => ({
      timeout: 2,
      description: "Наблюдательный совет разваливается, и радикалы возвращаются к давлению.",
      effects: [
        {
          type: "satisfaction",
          target: estate?.name ?? "",
          value: -5,
        },
      ],
    }),
  },
  "estate.retaliation": {
    id: "estate.retaliation",
    category: "Политические интриги",
    severity: "major",
    title: ({ estate }) =>
      `${estate?.name ?? "Сословие"} разворачивает кампанию возмездия`,
    description: ({ estate }) =>
      `Несмотря на уступки, влиятельные семьи ${estate?.name ?? ""} саботируют решения совета и финансируют оппозицию.`,
    factions: ({ estate }) => [estate?.name ?? "сословие", "Тайная канцелярия / шпионы"],
    triggers: ({ estate }) => [
      `followup:estate.dissatisfaction`,
      `metric:estates.${estate?.name ?? "unknown"}.satisfaction`,
    ],
    conditions: ({ estate }) => ({
      metrics: {
        [`estates.${estate?.name ?? "unknown"}.satisfaction`]: "<= 45",
      },
    }),
    options: ({ estate }) => [
      {
        id: "expose_plot",
        description: "Раскрыть публично заговор и конфисковать активы",
        cost: { influence: 12 },
        effects: [
          {
            type: "influence",
            target: estate?.name ?? "",
            value: -4,
          },
          {
            type: "stability",
            target: "империя",
            value: 1,
          },
        ],
      },
      {
        id: "secret_deal",
        description: "Заключить тайное соглашение, обещая привилегии",
        cost: { gold: 40 },
        effects: [
          {
            type: "satisfaction",
            target: estate?.name ?? "",
            value: 3,
          },
          {
            type: "reputation",
            target: "Корона / центральная власть",
            value: -2,
          },
        ],
        followUps: ["estate.cabal"],
      },
    ],
    failure: ({ estate }) => ({
      timeout: 1,
      description: "Заговорщики добиваются отставки верных вам чиновников.",
      effects: [
        {
          type: "stability",
          target: "империя",
          value: -1,
        },
        {
          type: "influence",
          target: estate?.name ?? "",
          value: 3,
        },
      ],
    }),
    escalation: ({ estate }) => [
      {
        chance: 0.3,
        followUp: "estate.cabal",
        description: `Радикальное крыло ${estate?.name ?? ""} готовит тайный союз с иностранцами.`,
      },
    ],
  },
  "estate.cabal": {
    id: "estate.cabal",
    category: "Политические интриги",
    severity: "major",
    title: ({ estate }) =>
      `Подпольный союз ${estate?.name ?? "сословия"} выходит из тени`,
    description: ({ estate }) =>
      `Раскрываются доказательства, что ${estate?.name ?? ""} создало подпольную сеть, опираясь на зарубежных спонсоров.`,
    factions: ({ estate }) => [estate?.name ?? "сословие", "Тайная канцелярия / шпионы", "Корона / центральная власть"],
    triggers: ({ estate }) => [
      `escalation:estate.dissatisfaction`,
      `metric:estates.${estate?.name ?? "unknown"}.satisfaction`,
    ],
    conditions: ({ estate }) => ({
      metrics: {
        [`estates.${estate?.name ?? "unknown"}.satisfaction`]: "<= 40",
      },
      flags: ["estate_cabal"],
    }),
    options: ({ estate }) => [
      {
        id: "dismantle_network",
        description: "Поручить тайной канцелярии разоблачить и арестовать лидеров",
        cost: { influence: 15 },
        effects: [
          {
            type: "influence",
            target: estate?.name ?? "",
            value: -5,
          },
          {
            type: "stability",
            target: "империя",
            value: 2,
          },
        ],
      },
      {
        id: "offer_amnesty",
        description: "Предложить амнистию в обмен на признание и штрафы",
        cost: { gold: 50 },
        effects: [
          {
            type: "satisfaction",
            target: estate?.name ?? "",
            value: 4,
          },
          {
            type: "reputation",
            target: "Корона / центральная власть",
            value: -3,
          },
        ],
      },
    ],
    failure: ({ estate }) => ({
      timeout: 1,
      description: "Заговорщики получают поддержку соседних держав и готовят мятеж.",
      effects: [
        {
          type: "stability",
          target: "империя",
          value: -2,
        },
        {
          type: "threat",
          target: "border",
          value: 1,
        },
      ],
    }),
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
  "treasury.recovery_plan": {
    id: "treasury.recovery_plan",
    category: "Экономический кризис",
    severity: "minor",
    title: () => "План восстановления бюджета",
    description: () =>
      "Министерства предлагают поэтапный план оптимизации расходов и стимулирования торговли для пополнения казны.",
    factions: () => ["Корона / центральная власть", "Гильдии купцов"],
    triggers: () => ["followup:treasury.depletion", "metric:treasury"],
    conditions: () => ({
      metrics: {
        treasury: ">= 120",
      },
    }),
    options: () => [
      {
        id: "enforce_plan",
        description: "Следовать плану и удерживать расходы под контролем",
        cost: { influence: 5 },
        effects: [
          {
            type: "stability",
            target: "империя",
            value: 1,
          },
          {
            type: "treasury",
            target: "gold",
            value: 40,
          },
        ],
      },
      {
        id: "accelerate_growth",
        description: "Инвестировать в торговые привилегии ради ускоренного роста",
        cost: { gold: 50 },
        effects: [
          {
            type: "wealth",
            target: "торговые провинции",
            value: 3,
            duration: 2,
          },
        ],
      },
    ],
    failure: () => ({
      timeout: 2,
      description: "План буксует, а расходы вновь превышают доходы.",
      effects: [
        {
          type: "treasury",
          target: "gold",
          value: -30,
        },
        {
          type: "stability",
          target: "империя",
          value: -1,
        },
      ],
    }),
  },
  "kpi.stability.crisis": {
    id: "kpi.stability.crisis",
    category: "Социальные потрясения",
    severity: "moderate",
    title: ({ region }) =>
      region
        ? `Население ${region.name} требует гарантий и защиты`
        : "Лояльность населения по всей империи снижается",
    description: ({ region }) =>
      region
        ? `Слухи о беспорядках в ${region.name} распространяются по всей стране. Люди ожидают вмешательства власти.`
        : "Советники предупреждают о росте недовольства в низших сословиях и готовности к протестам.",
    factions: ({ region }) =>
      region ? ["Корона / центральная власть", region.name] : ["Корона / центральная власть", "крестьянство"],
    triggers: ({ region }) => [
      "metric:stability",
      region ? `metric:regions.${region.name}.loyalty` : "metric:loyalty",
    ],
    conditions: ({ region }) => ({
      metrics: {
        stability: "<= 55",
        ...(region ? { [`regions.${region.name}.loyalty`]: "<= 45" } : {}),
      },
    }),
    options: ({ region }) => [
      {
        id: "deploy_mediators",
        description: "Отправить внутренних инспекторов и выделить средства на местные проекты",
        cost: { influence: 4, gold: 35 },
        effects: region
          ? [
              { type: "loyalty", target: region.name, value: 4 },
              { type: "stability", target: "империя", value: 1, duration: 2 },
            ]
          : [
              { type: "stability", target: "империя", value: 2, duration: 2 },
            ],
      },
      {
        id: "promise_reforms",
        description: "Пообещать реформы и снизить налоговое давление",
        cost: { influence: 3 },
        effects: region
          ? [
              { type: "loyalty", target: region.name, value: 2 },
              { type: "treasury", target: "gold", value: -25 },
            ]
          : [
              { type: "treasury", target: "gold", value: -35 },
              { type: "stability", target: "империя", value: 1 },
            ],
        followUps: ["estate.dissatisfaction"],
      },
    ],
    failure: ({ region }) => ({
      timeout: 1,
      description: "Протесты перерастают в очаги неповиновения и подрывают легитимность власти.",
      effects: region
        ? [
            { type: "loyalty", target: region.name, value: -5 },
            { type: "stability", target: "империя", value: -2 },
          ]
        : [
            { type: "stability", target: "империя", value: -3 },
          ],
    }),
    escalation: ({ region }) =>
      region
        ? [
            {
              chance: 0.2,
              followUp: "region.loyalty.decline",
              description: `Неспособность урегулировать кризис в ${region.name} может привести к открытому бунту.`,
            },
          ]
        : undefined,
  },
  "kpi.economy.recession": {
    id: "kpi.economy.recession",
    category: "Экономический кризис",
    severity: "moderate",
    title: () => "Замедление экономики вызывает тревогу",
    description: () =>
      "Министры сообщают о первых признаках рецессии: доходы падают, а торговля замедляется.",
    factions: () => ["Гильдии купцов", "Корона / центральная власть"],
    triggers: () => ["metric:economicGrowth"],
    conditions: () => ({
      metrics: {
        economicGrowth: "<= 0",
      },
    }),
    options: () => [
      {
        id: "stimulus_package",
        description: "Запустить программу стимулирования торговли и инфраструктуры",
        cost: { gold: 70, influence: 3 },
        effects: [
          { type: "treasury", target: "gold", value: -30 },
          { type: "wealth", target: "торговые провинции", value: 4, duration: 2 },
        ],
      },
      {
        id: "austerity",
        description: "Сократить расходы и выровнять бюджет до улучшения показателей",
        effects: [
          { type: "budget", target: "all", value: -10 },
          { type: "stability", target: "империя", value: -1 },
        ],
        followUps: ["treasury.recovery_plan"],
      },
    ],
    failure: () => ({
      timeout: 1,
      description: "Продуктивные силы деградируют, торговля стагнирует.",
      effects: [
        { type: "wealth", target: "торговые провинции", value: -3 },
        { type: "stability", target: "империя", value: -1 },
      ],
    }),
  },
  "kpi.security.alert": {
    id: "kpi.security.alert",
    category: "Военные угрозы",
    severity: "moderate",
    title: ({ region }) =>
      region
        ? `Пограничные дозоры ${region.name} сообщают о росте угроз`
        : "Совет безопасности предупреждает об уязвимости границ",
    description: ({ region }) =>
      region
        ? `Недофинансирование гарнизонов ${region.name} оставляет границы без защиты.`
        : "Низкие военные расходы и слухи о бунтах ставят безопасность империи под угрозу.",
    factions: ({ region }) =>
      region ? ["Военное сословие / гарнизоны", region.name] : ["Военное сословие / гарнизоны"],
    triggers: ({ region }) => [
      "metric:securityIndex",
      region ? `metric:regions.${region.name}.loyalty` : "metric:loyalty",
    ],
    conditions: () => ({
      metrics: {
        securityIndex: "<= 35",
      },
    }),
    options: ({ region }) => [
      {
        id: "mobilize_reserves",
        description: "Увеличить военные ассигнования и усилить гарнизоны",
        cost: { gold: 60, labor: 20 },
        effects: [
          { type: "treasury", target: "gold", value: -40 },
          { type: "loyalty", target: region?.name ?? "", value: 3 },
          { type: "threat", target: "border", value: -1 },
        ],
      },
      {
        id: "negotiate_truces",
        description: "Использовать дипломатию, чтобы выиграть время",
        cost: { influence: 6 },
        effects: [
          { type: "threat", target: "границы", value: -1 },
          { type: "reputation", target: "Региональные элиты", value: 1 },
        ],
      },
    ],
    failure: ({ region }) => ({
      timeout: 1,
      description: "Пограничные инциденты учащаются, а гарнизоны теряют дисциплину.",
      effects: [
        { type: "threat", target: "border", value: 2 },
        { type: "stability", target: "империя", value: -2 },
        ...(region ? [{ type: "loyalty", target: region.name, value: -4 }] : []),
      ],
    }),
    escalation: ({ region }) => [
      {
        chance: 0.25,
        followUp: "treasury.depletion",
        description: region
          ? `Эскалация на границе ${region.name} грозит перерасти в полномасштабный конфликт.`
          : "Продолжение кризиса приведёт к чрезвычайным расходам.",
      },
    ],
  },
  "security.border.skirmish": {
    id: "security.border.skirmish",
    category: "Военные угрозы",
    severity: "moderate",
    title: ({ region }) =>
      region
        ? `На границе ${region.name} вспыхивают столкновения`
        : "Пограничные гарнизоны сообщают о сериях нападений",
    description: ({ region }) =>
      region
        ? `Разведка фиксирует рейды противника и диверсии на территории ${region.name}.`
        : "Линия обороны подвергается многочисленным вылазкам, требуются срочные меры.",
    factions: ({ region }) =>
      region ? ["Военное сословие / гарнизоны", region.name] : ["Военное сословие / гарнизоны"],
    triggers: ({ region }) => [
      "metric:securityIndex",
      region ? `metric:regions.${region.name}.loyalty` : "metric:loyalty",
    ],
    conditions: () => ({
      metrics: {
        securityIndex: "<= 48",
      },
    }),
    options: ({ region }) => [
      {
        id: "deploy_reserves",
        description: "Направить резервные части и укрепить линии снабжения",
        cost: { gold: 80, labor: 25 },
        effects: [
          { type: "threat", target: "border", value: -1.2 },
          { type: "loyalty", target: region?.name ?? "", value: 4 },
          { type: "securityPressure", target: "border", value: -1 },
          { type: "treasury", target: "gold", value: -40 },
        ],
      },
      {
        id: "broker_local_truce",
        description: "Попытаться выкупить перемирие через местных элит",
        cost: { influence: 10 },
        effects: [
          { type: "securityPressure", target: "frontier", value: -0.6 },
          { type: "reputation", target: region?.name ?? "пограничные элиты", value: 2 },
          { type: "stability", target: region?.name ?? "", value: 1 },
        ],
        followUps: ["security.border.intelligence"],
      },
      {
        id: "delay_response",
        description: "Ограничиться дипломатическими нотами и разведкой",
        effects: [
          { type: "securityPressure", target: "frontier", value: -0.2 },
        ],
        followUps: ["security.border.crisis"],
      },
    ],
    failure: ({ region }) => ({
      timeout: 1,
      description:
        "Противник захватывает заставы, а местные гарнизоны несут потери.",
      effects: [
        { type: "threat", target: "border", value: 1.6 },
        { type: "loyalty", target: region?.name ?? "", value: -4 },
        { type: "stability", target: region?.name ?? "", value: -2 },
      ],
    }),
  },
  "security.border.intelligence": {
    id: "security.border.intelligence",
    category: "Военные угрозы",
    severity: "minor",
    title: ({ region }) =>
      region
        ? `Тайная канцелярия раскрывает заговор в ${region.name}`
        : "Агентура докладывает о подготовке новых атак",
    description: ({ region }) =>
      region
        ? `Шпионы обнаружили координационный центр нападений на территорию ${region.name}.`
        : "Аналитики фиксируют скрытую поддержку вторжения извне.",
    factions: () => ["Тайная канцелярия / шпионы", "Военное сословие / гарнизоны"],
    triggers: () => ["followup:security.border.skirmish"],
    conditions: () => ({
      metrics: {
        securityIndex: "<= 55",
      },
    }),
    options: () => [
      {
        id: "strike_back",
        description: "Провести точечные операции по ликвидации штаба",
        cost: { influence: 8, labor: 12 },
        effects: [
          { type: "threat", target: "enemy", value: -1 },
          { type: "securityPressure", target: "frontier", value: -0.8 },
        ],
      },
      {
        id: "gather_more",
        description: "Собрать дополнительную информацию, не раскрывая себя",
        effects: [
          { type: "securityPressure", target: "frontier", value: -0.3 },
        ],
        followUps: ["security.border.crisis"],
      },
    ],
    failure: () => ({
      timeout: 2,
      description:
        "Операция проваливается, агенты раскрыты, а противник усиливает проникновение.",
      effects: [
        { type: "threat", target: "border", value: 1 },
        { type: "securityPressure", target: "frontier", value: 0.5 },
      ],
    }),
  },
  "security.border.crisis": {
    id: "security.border.crisis",
    category: "Военные угрозы",
    severity: "major",
    title: ({ region }) =>
      region
        ? `В ${region.name} вспыхивает полномасштабный кризис безопасности`
        : "Империя сталкивается с угрозой вторжения",
    description: ({ region }) =>
      region
        ? `Мятежные силы захватывают укрепления ${region.name}, гарнизон просит чрезвычайных полномочий.`
        : "Совет обороны предупреждает: без немедленных действий империя рискует потерять провинции.",
    factions: ({ region }) =>
      region
        ? ["Военное сословие / гарнизоны", "Корона / центральная власть", region.name]
        : ["Военное сословие / гарнизоны", "Корона / центральная власть"],
    triggers: ({ region }) => [
      "metric:securityIndex",
      region ? `metric:regions.${region.name}.loyalty` : "metric:loyalty",
    ],
    conditions: () => ({
      metrics: {
        securityIndex: "<= 35",
      },
    }),
    options: ({ region }) => [
      {
        id: "declare_martial_law",
        description: "Ввести чрезвычайное положение и перераспределить бюджеты",
        cost: { influence: 12 },
        effects: [
          { type: "loyalty", target: region?.name ?? "", value: -3 },
          { type: "threat", target: "border", value: -1.8 },
          { type: "securityPressure", target: "frontier", value: -1.4 },
          { type: "stability", target: "империя", value: -1 },
        ],
        followUps: ["security.border.rebuild"],
      },
      {
        id: "forge_alliance",
        description: "Запросить военную помощь у союзников и профинансировать совместную операцию",
        cost: { gold: 140 },
        effects: [
          { type: "threat", target: "border", value: -2.2 },
          { type: "securityPressure", target: "frontier", value: -1.8 },
          { type: "reputation", target: "союзники", value: 3 },
          { type: "stability", target: region?.name ?? "", value: 2 },
        ],
      },
      {
        id: "concede_ground",
        description: "Отступить к укреплённым линиям и готовиться к затяжной обороне",
        effects: [
          { type: "stability", target: region?.name ?? "", value: -2 },
          { type: "securityPressure", target: "frontier", value: -0.6 },
        ],
        followUps: ["security.border.rebellion"],
      },
    ],
    failure: ({ region }) => ({
      timeout: 1,
      description:
        "Граница рухнула, противник угрожает столичным провинциям, армии не хватает дисциплины.",
      effects: [
        { type: "threat", target: "border", value: 2.5 },
        { type: "securityPressure", target: "frontier", value: 1.2 },
        { type: "stability", target: "империя", value: -3 },
        ...(region ? [{ type: "loyalty", target: region.name, value: -6 }] : []),
      ],
    }),
    escalation: ({ region }) => [
      {
        chance: 0.4,
        followUp: "security.border.rebellion",
        description: region
          ? `Поражение в ${region.name} может спровоцировать восстание и вторжение союзников врага.`
          : "Если кризис не погасить, начнутся полномасштабные бунты.",
      },
    ],
  },
  "security.border.rebuild": {
    id: "security.border.rebuild",
    category: "Военные угрозы",
    severity: "minor",
    title: ({ region }) =>
      region
        ? `Пограничные гарнизоны ${region.name} требуют восстановления`
        : "Командование просит средства на восстановление укреплений",
    description: ({ region }) =>
      region
        ? `После операции гарнизоны ${region.name} нуждаются в финансировании и пополнении.` 
        : "Военное ведомство формирует план по укреплению оборонительных линий.",
    factions: () => ["Военное сословие / гарнизоны", "Корона / центральная власть"],
    triggers: () => ["followup:security.border.crisis"],
    conditions: () => ({
      metrics: {
        securityIndex: "<= 60",
      },
    }),
    options: ({ region }) => [
      {
        id: "fund_recovery",
        description: "Направить средства и специалистов на модернизацию обороны",
        cost: { gold: 90, labor: 20 },
        effects: [
          { type: "securityPressure", target: "frontier", value: -1.2 },
          { type: "stability", target: region?.name ?? "", value: 2 },
          { type: "threat", target: "border", value: -0.8 },
        ],
      },
      {
        id: "reward_commanders",
        description: "Повысить боевой дух премиями и наградами",
        cost: { influence: 6 },
        effects: [
          { type: "securityPressure", target: "frontier", value: -0.6 },
          { type: "reputation", target: "армия", value: 3 },
        ],
      },
    ],
    failure: () => ({
      timeout: 2,
      description: "Без поддержки гарнизоны деградируют, а слухи о поражении деморализуют население.",
      effects: [
        { type: "stability", target: "империя", value: -1 },
        { type: "securityPressure", target: "frontier", value: 0.6 },
      ],
    }),
  },
  "security.border.rebellion": {
    id: "security.border.rebellion",
    category: "Социальные потрясения",
    severity: "major",
    title: ({ region }) =>
      region
        ? `В ${region.name} вспыхивает мятеж после провала обороны`
        : "Приграничные гарнизоны бунтуют",
    description: ({ region }) =>
      region
        ? `Оборона ${region.name} рухнула, часть населения поддерживает мятежников.`
        : "Военные требуют сменить командование и угрожают поддержать заговорщиков.",
    factions: ({ region }) =>
      region
        ? ["Военное сословие / гарнизоны", region.name, "Тайная канцелярия / шпионы"]
        : ["Военное сословие / гарнизоны", "Тайная канцелярия / шпионы"],
    triggers: ({ region }) => [
      "escalation:security.border.crisis",
      region ? `metric:regions.${region.name}.loyalty` : "metric:loyalty",
    ],
    conditions: ({ region }) => ({
      metrics: {
        securityIndex: "<= 32",
        ...(region ? { [`regions.${region.name}.loyalty`]: "<= 55" } : {}),
      },
    }),
    options: ({ region }) => [
      {
        id: "crush_rebellion",
        description: "Подавить мятеж жёсткой рукой и провести чистку командиров",
        cost: { labor: 40 },
        effects: [
          { type: "loyalty", target: region?.name ?? "", value: -4 },
          { type: "securityPressure", target: "frontier", value: -1.5 },
          { type: "threat", target: "border", value: -1.2 },
        ],
      },
      {
        id: "negotiate_amnesty",
        description: "Обещать реформы и амнистию гарнизонам",
        cost: { influence: 12 },
        effects: [
          { type: "stability", target: region?.name ?? "", value: 2 },
          { type: "securityPressure", target: "frontier", value: -0.9 },
          { type: "reputation", target: "армия", value: 2 },
        ],
      },
    ],
    failure: ({ region }) => ({
      timeout: 1,
      description: "Мятеж становится массовым, и соседи готовятся воспользоваться хаосом.",
      effects: [
        { type: "securityPressure", target: "frontier", value: 1.5 },
        { type: "threat", target: "border", value: 2 },
        { type: "stability", target: "империя", value: -3 },
        ...(region ? [{ type: "loyalty", target: region.name, value: -8 }] : []),
      ],
    }),
  },
  "treasury.debt_payments": {
    id: "treasury.debt_payments",
    category: "Экономический кризис",
    severity: "moderate",
    title: () => "Наступает срок выплат по чрезвычайным займам",
    description: () =>
      "Гильдии требуют выплат по недавнему кредиту и угрожают забастовками, если платеж не поступит вовремя.",
    factions: () => ["Гильдии купцов", "Корона / центральная власть"],
    triggers: () => ["followup:treasury.depletion", "metric:treasury"],
    conditions: () => ({
      metrics: {
        treasury: "<= 150",
      },
    }),
    options: () => [
      {
        id: "pay_with_reserves",
        description: "Использовать оставшиеся резервы для погашения долга",
        effects: [
          {
            type: "treasury",
            target: "gold",
            value: -70,
          },
          {
            type: "reputation",
            target: "гильдии",
            value: 2,
          },
        ],
      },
      {
        id: "renegotiate_terms",
        description: "Переговоры о пролонгации под обещания реформ",
        cost: { influence: 7 },
        effects: [
          {
            type: "stability",
            target: "империя",
            value: 1,
          },
        ],
        followUps: ["treasury.default"],
      },
    ],
    failure: () => ({
      timeout: 1,
      description: "Долг не погашен, и гильдии блокируют поставки.",
      effects: [
        {
          type: "treasury",
          target: "gold",
          value: -90,
        },
        {
          type: "reputation",
          target: "гильдии",
          value: -3,
        },
      ],
    }),
  },
  "treasury.default": {
    id: "treasury.default",
    category: "Экономический кризис",
    severity: "major",
    title: () => "Финансовый дефолт грозит империи",
    description: () =>
      "Кредиторы объявляют ультиматум: либо немедленная выплата, либо конфискация активов и поддержка мятежных фракций.",
    factions: () => ["Гильдии купцов", "Корона / центральная власть", "Военное сословие / гарнизоны"],
    triggers: () => ["escalation:treasury.depletion", "metric:treasury"],
    conditions: () => ({
      metrics: {
        treasury: "<= 80",
      },
      flags: ["treasury_default"],
    }),
    options: () => [
      {
        id: "seize_assets",
        description: "Конфисковать имущество непокорных гильдий",
        cost: { influence: 10 },
        effects: [
          {
            type: "treasury",
            target: "gold",
            value: 100,
          },
          {
            type: "reputation",
            target: "гильдии",
            value: -5,
          },
        ],
      },
      {
        id: "issue_war_bonds",
        description: "Выпустить военные облигации под гарантии армии",
        cost: { labor: 40 },
        effects: [
          {
            type: "treasury",
            target: "gold",
            value: 120,
          },
          {
            type: "stability",
            target: "империя",
            value: -1,
          },
        ],
      },
    ],
    failure: () => ({
      timeout: 1,
      description: "Империя объявляет дефолт, и региональные элиты поднимают вопрос о самостоятельности.",
      effects: [
        {
          type: "stability",
          target: "империя",
          value: -3,
        },
        {
          type: "threat",
          target: "границы",
          value: 1,
        },
      ],
    }),
  },
};

function mapOptionToSummary(option: SimulationEventOption): EventInterventionOptionSummary {
  return {
    id: option.id,
    description: option.description,
    cost: option.cost,
    effects: option.effects,
    followUps: option.followUps,
  };
}

export function buildEventInterventionPanel(options: {
  event: SimulationEvent;
  context: EventDecisionContext;
  remainingTime: number;
  quarter: number;
  advisorPreview: AdvisorOutcomePreview;
}): EventInterventionPanel {
  const { event, remainingTime, quarter, advisorPreview, context } = options;
  const contextSummary: string[] = [];

  if (event.origin?.regionName) {
    contextSummary.push(`Регион: ${event.origin.regionName}`);
  }
  if (event.origin?.estateName) {
    contextSummary.push(`Сословие: ${event.origin.estateName}`);
  }
  if (event.origin?.source) {
    contextSummary.push(`Источник: ${event.origin.source}`);
  }

  const treasuryGold = context.resources.gold.toFixed(1);
  const advisorTrust = (context.trust.advisor * 100).toFixed(1);
  contextSummary.push(`Казна: ${treasuryGold} золота`);
  contextSummary.push(`Доверие к советнику: ${advisorTrust}%`);

  return {
    event,
    quarter,
    remainingTime,
    failure: event.failure,
    options: event.options.map(mapOptionToSummary),
    advisorPreview,
    contextSummary,
  };
}

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

  const origin: EventOrigin = {
    regionName: context.region?.name,
    estateName: context.estate?.name,
    milestone: context.milestone,
    loyalty: context.loyalty,
    satisfaction: context.satisfaction,
    treasury: context.treasury,
    source: context.source ?? templateId,
  };

  if (
    origin.regionName ||
    origin.estateName ||
    origin.milestone !== undefined ||
    origin.loyalty !== undefined ||
    origin.satisfaction !== undefined ||
    origin.treasury !== undefined
  ) {
    event.origin = origin;
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

export type EventTemplateId = keyof typeof EVENT_TEMPLATES;

export function createEventFromTemplate(
  templateId: EventTemplateId,
  context: EventTemplateContext
): SimulationEvent {
  return instantiateEvent(templateId, context);
}
