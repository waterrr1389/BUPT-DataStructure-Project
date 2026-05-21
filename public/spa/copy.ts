type DisplayLabelMap = Record<string, string>;

type FrontendErrorInput = {
  code?: unknown;
  context?: unknown;
  status?: unknown;
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
      `运行时数据：${copyText(dataSource, "种子数据")}。算法：${copyText(algorithmSource, "备用实现")}。`,
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
