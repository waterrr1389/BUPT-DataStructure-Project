type DisplayLabelMap = Record<string, string>;

type FrontendErrorInput = {
  code?: unknown;
  context?: unknown;
  status?: unknown;
};

type WorldEdgeSummaryInput = {
  order?: unknown;
  edgeId?: unknown;
  fromWorldNodeId?: unknown;
  toWorldNodeId?: unknown;
  roadType?: unknown;
  mode?: unknown;
  distance?: unknown;
  cost?: unknown;
};

type PortalTransferSummaryInput = {
  order?: unknown;
  portalId?: unknown;
  destinationId?: unknown;
  transferDirection?: unknown;
  localNodeId?: unknown;
  worldNodeId?: unknown;
  mode?: unknown;
  transferDistance?: unknown;
  transferCost?: unknown;
  distance?: unknown;
  cost?: unknown;
};

function copyText(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (value == null) {
    return fallback;
  }
  return String(value);
}

export const dateLocale = "zh-CN";
export const moneyLocale = "zh-CN";
export const moneyCurrency = "USD";

export const appCopy = {
  brand: "Trail Atlas",
  tagline: "面向地点、路线和旅行笔记的探索工作台。",
  htmlDescription:
    "Trail Atlas 是一个用于目的地探索、地图规划、动态浏览和旅行笔记创作的中文旅行日志应用。",
  document: {
    separator: " • ",
  },
  nav: {
    primaryLabel: "主导航",
    toggleLabel: "展开或收起导航",
    toggleText: "菜单",
    items: {
      home: "Trail Atlas",
      explore: "探索",
      map: "地图",
      feed: "动态",
      compose: "写笔记",
      post: "笔记详情",
      notFound: "未找到",
      view: "页面",
    },
  },
  common: {
    buttons: {
      backToTop: "回到顶部",
      openExplore: "打开探索",
      reloadShell: "重新加载",
    },
    status: {
      runtimeReady: "运行时已就绪。",
      loadingRuntime: "正在加载运行时...",
      loadingKind: "加载中",
      noteKind: "提示",
      successKind: "成功",
      errorKind: "错误",
      neutralKind: "提示",
    },
    empty: {
      title: "暂无内容",
      body: "选择路线或运行搜索后，这里会显示结果。",
    },
    notice: {
      fallbackTitle: "提示",
      fallbackBody: "暂无可显示的信息。",
    },
    select: {
      blankLabel: "请选择",
    },
    date: {
      unknown: "未知日期",
    },
    money: {
      zero: "US$0",
    },
  },
  shell: {
    bootFailureTitle: "浏览器界面暂时不可用",
    bootFailureMessage: "SPA 启动失败。",
    loadingTitle: "正在加载浏览器界面",
    loadingBody: "正在准备旅行日志体验。",
    routeLoadingBody: "仅加载当前页面，保持界面响应。",
    resolvingRoute: "正在解析路由",
    openingRoute: (routeLabel: string) => `正在打开${routeLabel}`,
    routeFailedTitle: (routeLabel: string) => `${routeLabel}加载失败`,
    runtimeDataStatus: (dataSource: unknown, algorithmSource: unknown) =>
      runtimeDataStatus(dataSource, algorithmSource),
  },
  route: {
    labels: {
      segmentPrefix: (order: unknown) => `第 ${copyText(order, "0")} 段`,
      worldEdge: "世界路段",
      portalTransfer: "入口换乘",
      roadType: "道路类型",
      direction: "方向",
      mode: "方式",
      distance: "距离",
      cost: "成本",
      transferDistance: "换乘距离",
      transferCost: "换乘成本",
      destination: "目的地",
    },
    units: {
      meter: "米",
    },
    fallback: {
      worldEdgeId: "未知世界路段",
      portalId: "未知入口",
      worldNodeId: "未知世界节点",
      localNodeId: "未知本地节点",
      destinationId: "未知目的地",
    },
  },
  explore: {
    labels: {
      destinationMeta: (typeLabel: string, regionLabel: string) => `${typeLabel} · ${regionLabel}`,
      foodMeta: (cuisineLabel: string, venueLabel: string) => `${cuisineLabel} · ${venueLabel}`,
    },
  },
  feed: {
    fallbackNotice: "当前工作区尚未提供社交动态接口，已改为显示旅行笔记时间线。",
    loadingFailed: "动态加载失败。",
  },
  comments: {
    unavailableNotice: "当前工作区尚未接入评论接口。",
    creationUnavailableNotice: "评论发布仍在等待社交后端接口接入。",
    loadingFailed: "评论加载失败。",
    creationFailed: "评论发布失败。",
  },
  journal: {
    unsupportedAction: "不支持的笔记操作。",
    likesUnavailableNotice: "当前工作区尚未提供点赞功能。",
    actionFailed: "笔记操作失败。",
  },
  errors: {
    appRootMissing: "未找到应用根节点。",
    requestFailed: (status: unknown) => `请求失败：${copyText(status, "未知状态")}`,
    routeLoadFallback: "请求的页面无法加载。",
    generic: "操作未能完成，请稍后重试。",
    bootstrap: "基础数据加载失败，请刷新后重试。",
    notFound: "请求的内容不存在。",
    invalidRequest: "请求内容不完整或格式不正确。",
    unknownEndpoint: "请求的接口不存在。",
  },
};

export const modeLabels: DisplayLabelMap = {
  walk: "步行",
  bike: "骑行",
  shuttle: "接驳车",
  mixed: "混合方式",
};

export const strategyLabels: DisplayLabelMap = {
  distance: "距离优先",
  time: "时间优先",
  mixed: "综合优先",
};

export const roadTypeLabels: DisplayLabelMap = {
  walkway: "步行道",
  "bike-lane": "骑行道",
  "shuttle-lane": "接驳车道",
  indoor: "室内通道",
  road: "道路",
  bridge: "桥梁",
  tunnel: "隧道",
  rail: "轨道",
  trail: "步道",
};

export const runtimeSourceLabels: DisplayLabelMap = {
  seeded: "种子数据",
  fallback: "备用数据",
  runtime: "运行时数据",
  generated: "生成数据",
  static: "静态数据",
};

export const algorithmSourceLabels: DisplayLabelMap = {
  seeded: "种子算法",
  fallback: "备用实现",
  runtime: "运行时算法",
  generated: "生成算法",
  static: "静态算法",
};

export const destinationTypeLabels: DisplayLabelMap = {
  campus: "校园",
  scenic: "景区",
  district: "街区",
};

export const destinationRegionLabels: DisplayLabelMap = {
  "north belt": "北部带",
  "river arc": "河湾",
  "harbor line": "港湾线",
  "west ridge": "西岭",
  "east loop": "东环",
  "central axis": "中轴",
  "North Wharf": "北码头",
  "East Bluffs": "东崖",
  "South Basin": "南湾",
};

export const destinationCategoryLabels: DisplayLabelMap = {
  architecture: "建筑",
  art: "艺术",
  bridge: "桥梁",
  bridgehead: "桥头",
  campus: "校园",
  central: "中轴",
  chokepoint: "瓶颈点",
  connector: "连接线",
  design: "设计",
  family: "亲子",
  flexible: "灵活行程",
  food: "美食",
  forest: "森林",
  harbor: "港湾",
  history: "历史",
  landmark: "地标",
  learning: "学习",
  loop: "环线",
  market: "市集",
  museum: "博物馆",
  nature: "自然",
  night: "夜间",
  nightscape: "夜景",
  north: "北部",
  photography: "摄影",
  portal: "入口",
  research: "研究",
  region: "区域",
  river: "河流",
  riverfront: "滨河",
  scenic: "景区",
  social: "社交",
  spine: "主轴",
  tea: "茶饮",
  tunnel: "隧道",
  upland: "高地",
  walking: "步行",
  waterfront: "滨水",
  wellness: "康养",
  west: "西部",
};

export const destinationTagLabels = destinationCategoryLabels;

export const cuisineLabels: DisplayLabelMap = {
  "river grill": "河畔烤物",
  "spice street": "香料街",
  "tea house": "茶屋",
  "noodle lab": "面食实验室",
  "sea bowl": "海鲜碗",
  "bento craft": "便当工坊",
  "forest roast": "森林烘焙",
  "campus comfort": "校园简餐",
  tea: "茶饮",
};

export const foodVenueLabels: DisplayLabelMap = {
  "harbor court": "港湾庭院",
  "student lane": "学生巷",
  "Wharf Arcade": "码头拱廊",
  "Atrium Hall": "中庭大厅",
};

export const foodKeywordLabels: DisplayLabelMap = {
  "river grill": cuisineLabels["river grill"],
  "spice street": cuisineLabels["spice street"],
  "tea house": cuisineLabels["tea house"],
  "noodle lab": cuisineLabels["noodle lab"],
  "sea bowl": cuisineLabels["sea bowl"],
  "bento craft": cuisineLabels["bento craft"],
  "forest roast": cuisineLabels["forest roast"],
  "campus comfort": cuisineLabels["campus comfort"],
  campus: destinationTypeLabels.campus,
  scenic: destinationTypeLabels.scenic,
  "quick bite": "快餐",
  signature: "招牌",
  late: "夜间",
  quiet: "安静",
  noodles: "面食",
  tea: cuisineLabels.tea,
};

export const worldRoadTypeLabels: DisplayLabelMap = roadTypeLabels;

export const transferDirectionLabels: DisplayLabelMap = {
  "local-to-world": "本地地图到世界地图",
  "world-to-local": "世界地图到本地地图",
};

export const facilityCategoryLabels: DisplayLabelMap = {
  all: "全部设施",
  restroom: "洗手间",
  clinic: "医疗点",
  store: "商店",
  charging: "充电点",
  info: "问询处",
  parking: "停车点",
  water: "饮水点",
  atm: "自动取款机",
  security: "安保点",
  lounge: "休息区",
};

export const worldRouteScopeLabels: DisplayLabelMap = {
  "world-only": "仅世界地图",
  "cross-map": "跨地图路线",
};

export const routeMarkerRoleLabels: DisplayLabelMap = {
  start: "起点",
  end: "终点",
  "preview-start": "预览起点",
  "preview-end": "预览终点",
  transition: "场景切换",
  turn: "转向",
  "floor-change": "楼层变化",
};

export const frontendErrorFallbacks: DisplayLabelMap = {
  invalid_request: appCopy.errors.invalidRequest,
  malformed_json: appCopy.errors.invalidRequest,
  payload_too_large: "请求内容过大。",
  unknown_endpoint: appCopy.errors.unknownEndpoint,
  not_found: appCopy.errors.notFound,
  world_unavailable: "世界地图暂时不可用。",
  world_route_invalid_request: appCopy.errors.invalidRequest,
  world_route_destination_not_found: "所选世界路线目的地不存在。",
  world_route_local_node_not_found: "所选本地节点不存在。",
  world_route_mode_not_allowed: "当前交通方式不适用于所选路线。",
  world_route_portal_misconfigured: "跨地图入口配置异常。",
  world_route_unreachable: "当前起终点之间暂时无法规划路线。",
  world_route_local_unreachable: "本地路线暂时不可达。",
  world_route_portal_not_found: "跨地图入口不可用。",
};

export function documentTitle(title: unknown): string {
  const normalized = copyText(title);
  return normalized
    ? `${normalized}${appCopy.document.separator}${appCopy.brand}`
    : appCopy.brand;
}

export function displayLabel(
  labels: DisplayLabelMap,
  value: unknown,
  fallback = appCopy.nav.items.view,
): string {
  const key = copyText(value);
  return labels[key] || fallback;
}

export function displaySourceLabel(value: unknown, fallback = "未知来源"): string {
  const raw = copyText(value);
  return raw ? displayLabel(runtimeSourceLabels, raw, raw) : fallback;
}

export function displayAlgorithmSourceLabel(value: unknown, fallback = "未知实现"): string {
  const raw = copyText(value);
  return raw ? displayLabel(algorithmSourceLabels, raw, raw) : fallback;
}

export function runtimeDataStatus(dataSource: unknown, algorithmSource: unknown): string {
  return `运行时数据：${displaySourceLabel(dataSource, "种子数据")}。算法：${displayAlgorithmSourceLabel(
    algorithmSource,
    "备用实现",
  )}。`;
}

export function displayDestinationTypeLabel(value: unknown): string {
  const raw = copyText(value);
  return raw ? displayLabel(destinationTypeLabels, raw, raw) : "未知类型";
}

export function displayDestinationRegionLabel(value: unknown): string {
  const raw = copyText(value);
  return raw ? displayLabel(destinationRegionLabels, raw, raw) : "未知区域";
}

export function displayDestinationCategoryLabel(value: unknown): string {
  const raw = copyText(value);
  return raw ? displayLabel(destinationCategoryLabels, raw, raw) : "未分类";
}

export function displayDestinationTagLabel(value: unknown): string {
  return displayDestinationCategoryLabel(value);
}

export function displayDestinationMeta(type: unknown, region: unknown): string {
  return appCopy.explore.labels.destinationMeta(displayDestinationTypeLabel(type), displayDestinationRegionLabel(region));
}

export function displayCuisineLabel(value: unknown): string {
  const raw = copyText(value);
  return raw ? displayLabel(cuisineLabels, raw, raw) : "未知菜系";
}

export function displayFoodVenueLabel(value: unknown): string {
  const raw = copyText(value);
  return raw ? displayLabel(foodVenueLabels, raw, raw) : "未知地点";
}

export function displayFoodKeywordLabel(value: unknown): string {
  const raw = copyText(value);
  return raw ? displayLabel(foodKeywordLabels, raw, raw) : "未分类";
}

export function displayFoodMeta(cuisine: unknown, venue: unknown): string {
  return appCopy.explore.labels.foodMeta(displayCuisineLabel(cuisine), displayFoodVenueLabel(venue));
}

export function displayWorldRoadTypeLabel(value: unknown): string {
  const raw = copyText(value);
  return raw ? displayLabel(worldRoadTypeLabels, raw, raw) : "未知道路";
}

export function displayTransferDirectionLabel(value: unknown): string {
  const raw = copyText(value);
  return raw ? displayLabel(transferDirectionLabels, raw, raw) : "未知方向";
}

export function formatMetricDisplay(value: unknown): string {
  const metric = Number(value);
  if (!Number.isFinite(metric)) {
    return "0";
  }
  return Number.isInteger(metric) ? String(metric) : metric.toFixed(2);
}

export function worldEdgeSummary(input: WorldEdgeSummaryInput): string {
  const labels = appCopy.route.labels;
  const units = appCopy.route.units;
  const fallback = appCopy.route.fallback;
  const order = copyText(input.order, "0");
  const edgeId = copyText(input.edgeId, fallback.worldEdgeId);
  const fromWorldNodeId = copyText(input.fromWorldNodeId, fallback.worldNodeId);
  const toWorldNodeId = copyText(input.toWorldNodeId, fallback.worldNodeId);
  const roadType = displayWorldRoadTypeLabel(input.roadType);
  const mode = displayLabel(modeLabels, input.mode, copyText(input.mode, "未知方式"));
  const distance = formatMetricDisplay(input.distance);
  const cost = formatMetricDisplay(input.cost);

  return `${labels.segmentPrefix(order)} · ${labels.worldEdge} ${edgeId}：${fromWorldNodeId} → ${toWorldNodeId} · ${labels.roadType} ${roadType} · ${labels.mode} ${mode} · ${labels.distance} ${distance} ${units.meter} · ${labels.cost} ${cost}`;
}

export function portalTransferSummary(input: PortalTransferSummaryInput): string {
  const labels = appCopy.route.labels;
  const units = appCopy.route.units;
  const fallback = appCopy.route.fallback;
  const order = copyText(input.order, "0");
  const portalId = copyText(input.portalId, fallback.portalId);
  const destinationId = copyText(input.destinationId, fallback.destinationId);
  const transferDirection = copyText(input.transferDirection);
  const localNodeId = copyText(input.localNodeId, fallback.localNodeId);
  const worldNodeId = copyText(input.worldNodeId, fallback.worldNodeId);
  const fromEndpoint = transferDirection === "world-to-local" ? worldNodeId : localNodeId;
  const toEndpoint = transferDirection === "world-to-local" ? localNodeId : worldNodeId;
  const direction = displayTransferDirectionLabel(transferDirection);
  const mode = displayLabel(modeLabels, input.mode, copyText(input.mode, "未知方式"));
  const transferDistance = formatMetricDisplay(input.transferDistance);
  const transferCost = formatMetricDisplay(input.transferCost);
  const distance = formatMetricDisplay(input.distance);
  const cost = formatMetricDisplay(input.cost);

  return `${labels.segmentPrefix(order)} · ${labels.portalTransfer} ${portalId}：${fromEndpoint} → ${toEndpoint} · ${labels.destination} ${destinationId} · ${labels.direction} ${direction} · ${labels.mode} ${mode} · ${labels.transferDistance} ${transferDistance} ${units.meter} · ${labels.transferCost} ${transferCost} · ${labels.distance} ${distance} ${units.meter} · ${labels.cost} ${cost}`;
}

export function frontendErrorMessage(input: FrontendErrorInput = {}): string {
  const code = copyText(input.code);
  if (code && frontendErrorFallbacks[code]) {
    return frontendErrorFallbacks[code];
  }

  const context = copyText(input.context);
  if (context.includes("/api/bootstrap")) {
    return appCopy.errors.bootstrap;
  }

  const status = Number(input.status);
  if (status === 404) {
    return appCopy.errors.notFound;
  }
  if (status >= 400 && status < 500) {
    return appCopy.errors.invalidRequest;
  }
  if (status >= 500) {
    return "服务暂时不可用，请稍后重试。";
  }

  return appCopy.errors.generic;
}
