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
  fromWorldNodeLabel?: unknown;
  toWorldNodeId?: unknown;
  toWorldNodeLabel?: unknown;
  roadType?: unknown;
  mode?: unknown;
  distance?: unknown;
  cost?: unknown;
};

type PortalTransferSummaryInput = {
  order?: unknown;
  portalId?: unknown;
  portalLabel?: unknown;
  destinationId?: unknown;
  destinationLabel?: unknown;
  transferDirection?: unknown;
  localNodeId?: unknown;
  localNodeLabel?: unknown;
  worldNodeId?: unknown;
  worldNodeLabel?: unknown;
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
  home: {
    documentTitle: "Trail Atlas",
    hero: {
      eyebrow: "安静精致的旅行日志",
      title: "记录路线，留住气氛，也能再次回到那个地点。",
      lede:
        "从目的地开始，查看路线、附近选择和旅行笔记；需要空间细节时，直接把结果带到地图里继续规划。",
      actions: {
        explore: "打开探索",
        feed: "阅读动态",
        map: "进入地图",
      },
      metrics: {
        destinations: (value: unknown) => `${copyText(value, "0")} 个目的地`,
        travelers: (value: unknown) => `${copyText(value, "0")} 位本地旅行者`,
        featured: (value: unknown) => `${copyText(value, "0")} 个精选地点`,
      },
      panelTag: "从这里开始",
      panelItems: [
        "搜索目的地，或从精选推荐里挑一个地点。",
        "打开地图查看位置、入口和路线。",
        "浏览笔记，记录下一次到访的细节。",
      ],
    },
    featured: {
      tag: "精选地点",
      heading: "精选目的地",
      linkLabel: "浏览全部",
      openInMap: "在地图中打开",
      metrics: {
        heat: (value: unknown) => `热度 ${copyText(value, "0")}`,
        rating: (value: unknown) => `评分 ${copyText(value, "0")}`,
        nodeCount: (value: unknown) => `${copyText(value, "0")} 个节点`,
      },
    },
    feedPreview: {
      tag: "笔记预览",
      heading: "最近笔记",
      linkLabel: "打开动态",
      fallbackNoticeTitle: "动态暂时不可用",
      unavailableNotice: "动态预览暂时不可用。",
      emptyTitle: "暂无预览笔记",
      emptyBody: "还没有可显示的旅行笔记。",
    },
  },
  explore: {
    documentTitle: "探索",
    hero: {
      eyebrow: "探索",
      title: "先找到下一个目的地。",
      lede:
        "搜索目的地或查看推荐，再打开地图规划路线。需要时，可以继续查附近设施和美食。",
      panelTag: "快速开始",
      panelItems: [
        "搜索目的地或查看推荐。",
        "从结果卡片直接打开地图。",
        "按需查看附近设施和美食。",
      ],
    },
    destinationSurface: {
      tag: "目的地",
      heading: "搜索与推荐目的地",
      refreshButton: "刷新精选",
      labels: {
        traveler: "旅行者视角",
        query: "搜索词",
        category: "分类",
        limit: "数量",
      },
      placeholders: {
        query: "港湾、博物馆、校园庭院",
      },
      buttons: {
        search: "搜索目的地",
        recommend: "获取推荐",
      },
      blankLabels: {
        traveler: "任意旅行者",
        category: "任意分类",
      },
      empty: {
        noMatchesTitle: "没有匹配的目的地",
        noMatchesBody: "可以放宽搜索词，或切换到推荐模式重新开始。",
        featuredUnavailableTitle: "精选目的地暂时不可用",
        featuredUnavailableBody: "基础数据未返回任何精选地点。",
      },
    },
    facilitySurface: {
      tag: "附近设施",
      heading: "附近设施",
      labels: {
        destination: "目的地",
        startNode: "起始节点",
        category: "分类",
        radius: "半径",
      },
      button: "查找设施",
      placeholders: {
        chooseDestination: "选择目的地后加载节点",
        loadingNodes: "正在加载节点...",
        noNodes: "此目的地暂无可用节点",
      },
      empty: {
        initialTitle: "按需查找设施",
        initialBody: "选择目的地和起始节点后，这里会显示附近洗手间、医疗点、休息区和其他场地设施。",
        noMatchesTitle: "范围内没有设施",
        noMatchesBody: "扩大搜索半径或调整起始节点，查看更多附近设施。",
      },
    },
    foodSurface: {
      tag: "美食指南",
      heading: "附近美食",
      labels: {
        destination: "目的地",
        traveler: "旅行者视角",
        cuisine: "菜系",
        query: "搜索词",
      },
      placeholders: {
        query: "茶、烧烤、面、点心",
      },
      buttons: {
        search: "搜索美食",
        recommend: "获取推荐",
      },
      blankLabels: {
        traveler: "任意旅行者",
        cuisine: "任意菜系",
      },
      empty: {
        initialTitle: "美食推荐已准备好",
        initialBody: "可以用菜系、旅行者视角或自由文本查找附近餐饮地点，无需离开探索页。",
        noMatchesTitle: "暂时没有美食结果",
        noMatchesBody: "调整菜系、旅行者视角或搜索词，查看其他附近选择。",
      },
      notice: {
        unavailableTitle: "美食推荐暂时不可用",
        unavailableBody: "美食查找失败。",
      },
    },
    labels: {
      destinationMeta: (typeLabel: string, regionLabel: string) => `${typeLabel} · ${regionLabel}`,
      foodMeta: (cuisineLabel: string, venueLabel: string) => `${cuisineLabel} · ${venueLabel}`,
    },
    actions: {
      openInMap: "在地图中打开",
      writeJournal: "写一篇笔记",
    },
    status: {
      destinationSearchFailed: "目的地搜索失败。",
      recommendationFailed: "推荐加载失败。",
      facilitySyncFailed: "节点同步失败。",
      facilitySearchFailed: "设施查找失败。",
      foodSearchFailed: "美食搜索失败。",
      foodRecommendationFailed: "美食推荐失败。",
    },
    metrics: {
      heat: (value: unknown) => `热度 ${copyText(value, "0")}`,
      rating: (value: unknown) => `评分 ${copyText(value, "0")}`,
      nodeCount: (value: unknown) => `${copyText(value, "0")} 个节点`,
      distanceMeters: (value: unknown) => `距离 ${copyText(value, "0")} 米`,
      pathSegments: (value: unknown) => `${copyText(value, "0")} 段路径`,
      averagePrice: (value: unknown) => `均价 US$${copyText(value, "0")}`,
    },
  },
  map: {
    documentTitle: "地图",
    hero: {
      eyebrow: "地图",
      title: "选择目的地并规划路线。",
      lede: "选择目的地，预览路线起终点，再规划适合这次到访的路径。",
      worldLink: "打开世界地图",
      panelTag: "路线流程",
      panelItems: [
        "选择目的地以加载地图和路线选项。",
        "规划前先预览起点和终点标记。",
        "只有需要途经点或不同出行偏好时，再打开高级路线设置。",
      ],
    },
    planner: {
      heading: "路线规划",
      body: "先选择目的地，再设置路线的起点和终点。",
      returnToExplore: "返回探索",
      labels: {
        destination: "目的地",
        start: "起点",
        end: "终点",
        waypoints: "途经点",
        strategy: "策略",
        mode: "方式",
      },
      placeholders: {
        waypoints: "途经节点编号，用逗号分隔",
        noStops: "暂无可用停靠点",
      },
      advancedSummary: "高级路线设置",
      buttons: {
        plan: "规划路线",
        reset: "清除路线",
      },
    },
    empty: {
      chooseDestinationTitle: "请选择目的地",
      chooseDestinationBody: "选择目的地后才会加载地图区域。",
      mapUnavailableTitle: "地图暂时不可用",
      mapUnavailableBody: "目的地数据无法加载。请选择其他目的地继续规划路线。",
      routeSummaryTitle: "规划后显示路线摘要",
      routeSummaryBody: "调整路线时预览标记会同步更新；规划完成后会显示距离和方向说明。",
    },
    status: {
      nodeLoadFailed: "地图节点加载失败。",
      previewFailed: "地图预览失败。",
      unavailableDestination: "请求的目的地不可用，已改为显示第一个可用地图。",
      restoreFailed: "路线恢复失败。",
      planFailed: "路线规划失败。",
    },
  },
  worldMap: {
    documentTitle: "世界地图",
    hero: {
      eyebrow: "世界地图",
      title: "在旅行日志中浏览并规划世界路线。",
      lede: "查看区域、规划世界行程，并在需要本地路线详情时进入目的地地图。",
      returnToExplore: "返回探索",
      panelTag: "世界视图",
      panelItems: [
        "背景图、区域和目的地标记会通过地图引擎渲染。",
        "世界路线规划支持仅世界地图和跨地图两种范围。",
        "选择目的地标记可直接设置世界路线起终点。",
      ],
    },
    meta: {
      world: "世界",
      region: "区域",
      destination: "目的地",
      worldFallback: "世界地图",
      regionFallback: "区域",
    },
    sidebar: {
      tag: "地图模式",
      heading: "世界路线规划",
      copy:
        "点击目的地标记或详情面板按钮设置起终点。路线规划会保持世界模式，并生成本地/世界/本地的接续链接。",
    },
    planner: {
      tag: "世界路线",
      heading: "规划行程",
      advancedSummary: "高级节点覆盖",
      labels: {
        scope: "范围",
        fromWorldNode: "起点世界节点",
        toWorldNode: "终点世界节点",
        fromDestination: "起点目的地",
        toDestination: "终点目的地",
        fromLocalNode: "可选起点本地节点",
        toLocalNode: "可选终点本地节点",
        strategy: "策略",
        mode: "方式",
      },
      placeholders: {
        localNode: "本地节点编号",
      },
      buttons: {
        plan: "规划世界路线",
        reset: "清除世界路线",
      },
      endpointSummary: {
        origin: "起点",
        destination: "终点",
        emptyOrigin: "未选择起点",
        emptyDestination: "未选择终点",
      },
      ariaLabel: "世界地图",
    },
    detailPanel: {
      tag: "目的地详情",
      emptyTitle: "选择一个目的地",
      emptyBody: "点击地图标记后，可在这里设置路线起点或终点，并打开本地地图。",
      labels: {
        region: "区域",
        portal: "默认入口",
      },
      buttons: {
        setOrigin: "设为起点",
        setDestination: "设为终点",
        openLocal: "打开本地地图",
      },
      noTags: "暂无标签",
      portalFallback: "暂无默认入口",
    },
    routeResult: {
      tag: "世界路线",
      pendingTitle: "正在规划路线",
      pendingBody: "正在向世界路线服务请求行程详情。",
      emptyTitle: "规划后显示世界路线摘要",
      emptyBody: "选择世界节点或目的地后规划路线，这里会显示世界行程。",
      failureTitle: "路线规划失败",
      failureFallback: "世界路线规划失败。",
      availableStatus: "路线已可使用。",
      incompleteStatus: "路线返回了不完整行程。",
      summary: (destinationDistance: unknown, worldDistance: unknown, transferDistance: unknown) =>
        `目的地 ${formatMetricDisplay(destinationDistance)} 米 · 世界地图 ${formatMetricDisplay(
          worldDistance,
        )} 米 · 换乘 ${formatMetricDisplay(transferDistance)} 米。`,
      cost: (value: unknown) => `成本 ${formatMetricDisplay(value)}`,
      meters: (value: unknown) => `${formatMetricDisplay(value)} 米`,
      handoffTag: "路线接续",
      handoffTitle: "本地地图与世界地图接续",
      handoffLinks: {
        localOrigin: "起点本地地图",
        localOriginUnavailable: "起点本地地图不可用",
        world: "世界地图",
        localDestination: "终点本地地图",
        localDestinationUnavailable: "终点本地地图不可用",
      },
      noSegments: "暂无路线分段。",
      explanationTag: "路线说明",
      explanationTitle: "行程分段顺序",
      explanationEmpty: "暂无可解释的入口换乘或世界路段步骤。",
    },
    unavailable: {
      actionLabel: "返回探索",
      worldTitle: "世界地图不可用",
      worldBody: "当前工作区后端未启用世界模式。",
      detailsTitle: "世界详情不可用",
      invalidDetailsBody: "世界详情数据校验失败。请检查边界、多边形、标记和路线图数据。",
      missingDetailsBody: "世界地图已启用，但缺少详细地图数据。",
      loadFailedBody: "世界地图暂时无法准备完成。请检查后端接口后重试。",
    },
    labels: {
      destinationLeg: (destinationId: unknown, fromNode: unknown, toNode: unknown) =>
        `目的地 ${copyText(destinationId, "destination")}：${copyText(fromNode, "起点")} → ${copyText(
          toNode,
          "终点",
        )}`,
      worldLeg: (fromNode: unknown, toNode: unknown) =>
        `世界地图：${copyText(fromNode, "起点")} → ${copyText(toNode, "终点")}`,
      failureSummary: (stage: string, reason: string, code: string, blockedSegment = "") =>
        `${stage}无法继续，原因：${reason}，类型：${code}${blockedSegment}。`,
    },
    failure: {
      stages: {
        "origin-destination": "起点目的地",
        "origin-portal": "起点入口",
        world: "世界地图",
        "destination-portal": "终点入口",
        "destination-local": "终点本地路线",
        "destination-leg": "目的地路段",
      },
      reasons: {
        unreachable: "暂时不可达",
        mode_not_allowed: "当前交通方式不可用",
        direction_not_allowed: "入口方向不支持",
        world_disconnected: "世界路线未连通",
        portal_misconfigured: "入口配置异常",
        local_graph_disconnected: "本地路线未连通",
      },
      codes: {
        origin_local_unreachable: "起点本地路线不可达",
        origin_portal_unavailable: "起点入口不可用",
        world_segment_unreachable: "世界路段不可达",
        destination_portal_unavailable: "终点入口不可用",
        destination_local_unreachable: "终点本地路线不可达",
        world_route_local_unreachable: "本地路线不可达",
      },
      fallbackStage: "路线阶段",
      fallbackReason: "规划约束",
      fallbackCode: "未分类",
    },
    status: {
      controlsUnavailable: "世界路线控件不可用。",
      unavailable: "世界模式不可用。",
      invalidDetails: "世界详情格式异常。",
      detailsUnavailable: "世界详情不可用。",
      routeReady: "世界路线已准备好。",
      routeIncomplete: "世界路线返回了不完整行程。",
      routeFailed: "世界路线规划失败。",
      mapReady: "世界地图已就绪。",
      mapLoadFailed: "世界地图加载失败。",
    },
  },
  feed: {
    documentTitle: "动态",
    hero: {
      eyebrow: "动态",
      title: "用克制的故事卡片浏览旅行笔记，同时保留课程工具。",
      lede:
        "动态页以摘要优先展示。完整内容进入笔记详情，笔记推荐仍然可用，交换工具则作为辅助区域保留。",
      panelTag: "渐进降级",
      panelItems: [
        "界面会优先尝试社交动态接口。",
        "如果社交动态接口缺失，浏览器会回退到旧版旅行笔记时间线。",
        "点赞和评论控件会显示出来，在后端缺失时按预期降级。",
      ],
    },
    stream: {
      tag: "笔记流",
      heading: "安静呈现旅行笔记和操作",
      composeLink: "写一篇新笔记",
      labels: {
        actor: "当前身份",
        destination: "目的地筛选",
        limit: "数量",
      },
      buttons: {
        latest: "加载最新",
        recommended: "推荐内容",
      },
      noticeTitles: {
        recommended: "推荐模式",
        latest: "动态模式",
      },
      notices: {
        recommended: "推荐笔记来自旧版笔记推荐工具。",
        chooseTraveler: "请选择旅行者后加载推荐。",
      },
      empty: {
        title: "当前视图没有匹配的笔记",
        body: "可以调整目的地筛选，也可以回到最新模式。",
        actionLabel: "写第一篇笔记",
      },
    },
    exchange: {
      tag: "笔记交换",
      toolTag: "交换工具",
      heading: "在不离开动态的情况下搜索、压缩和生成故事板",
      labels: {
        exactTitle: "精确标题",
        query: "文本搜索",
        destination: "目的地",
        compressionBody: "压缩文本",
        storyboardTitle: "故事标题",
        storyboardPrompt: "提示词",
      },
      placeholders: {
        exactTitle: "琥珀湾现场笔记 1",
        query: "室内大厅、餐台、黄昏路线",
        compressionBody: "粘贴一段旅行笔记用于压缩。",
        storyboardTitle: "港湾黄昏环线",
        storyboardPrompt: "描述想要生成动画的氛围、路线和片段。",
      },
      buttons: {
        search: "搜索交换内容",
        byDestination: "加载目的地动态",
        compress: "压缩",
        decompress: "解压",
        storyboard: "生成故事板",
      },
      results: {
        exactTitle: "精确标题",
        textSearch: "文本搜索",
        destination: "目的地动态",
        compressed: "压缩结果",
        decompressed: "解压结果",
        storyboardFallback: "故事板",
      },
      empty: {
        title: "交换工具保留在辅助区域",
        body: "可以按标题或文本搜索，加载目的地动态，或在这里运行压缩和故事板生成。",
      },
      compressionRatio: (value: unknown) => `压缩比 ${copyText(value, "0")}`,
    },
    labels: {
      commentCount: (value: unknown) => {
        const count = Number(value);
        return Number.isFinite(count) && count > 0 ? `${count} 条评论` : "评论";
      },
    },
    fallbackNotice: "当前工作区尚未提供社交动态接口，已改为显示旅行笔记时间线。",
    loadingFailed: "动态加载失败。",
    status: {
      journalActionFailed: "笔记操作失败。",
      loadingFailed: "动态加载失败。",
      recommendationFailed: "推荐加载失败。",
      exchangeSearchFailed: "交换内容搜索失败。",
      destinationExchangeFailed: "目的地交换内容加载失败。",
      compressionFailed: "压缩失败。",
      decompressionFailed: "解压失败。",
      storyboardFailed: "故事板生成失败。",
    },
  },
  compose: {
    documentTitle: "写笔记",
    hero: {
      eyebrow: "写笔记",
      title: "像写明信片一样写现场笔记，而不是填写管理记录。",
      lede: "标题和目的地保持在上方，正文区域足够宽松，媒体占位只作为轻量辅助。提交成功后会直接回到阅读流程。",
      panelTag: "保留能力",
      panelItems: [
        "笔记创建仍然提交到既有后端契约。",
        "目的地选择继续使用共享的消歧标签。",
        "可选媒体占位保持零依赖。",
      ],
    },
    form: {
      tag: "撰写",
      heading: "现场笔记",
      returnToFeed: "返回动态",
      labels: {
        author: "作者",
        destination: "目的地",
        title: "标题",
        body: "正文",
        tags: "标签",
        mediaTitle: "媒体标题",
        mediaSource: "媒体来源",
        mediaNote: "媒体说明",
      },
      placeholders: {
        title: "金色时刻穿过港湾中庭的环线",
        body: "写下路线、气氛，以及你想记住的那个瞬间。",
        tags: "历史、湖边、茶歇、安静庭院",
        mediaTitle: "封面定帧",
        mediaSource: "媒体来源地址",
        mediaNote: "简单说明这张图片或这段片段。",
      },
      mediaSummary: "可选媒体占位",
      submit: "发布笔记",
    },
    preview: {
      tag: "实时预览",
      heading: "笔记阅读效果",
      destinationFallback: "请选择目的地",
      authorFallback: "请选择作者",
      titleFallback: "未命名现场笔记",
      bodyFallback: "明信片式旅行笔记预览会显示在这里。",
    },
    prompts: {
      tag: "提醒",
      heading: "可以写什么",
      items: [
        "清楚写出地点，方便后续交接到地图。",
        "描述一条路线、一种气氛和一个难忘细节。",
        "标签保持克制；它们会参与后续发现和推荐。",
      ],
    },
    notices: {
      createdTitle: "笔记已发布",
      createdBody: "路由界面将从写笔记页进入新的笔记详情视图。",
      failedTitle: "写笔记出错",
      failedBody: "笔记创建失败。",
    },
  },
  postDetail: {
    documentTitle: "笔记详情",
    hero: {
      eyebrow: "笔记详情",
      notFoundTitle: "找不到这篇笔记。",
      notFoundBody: "这篇笔记暂时无法加载。",
      returnToFeed: "返回动态",
      compose: "写一篇新笔记",
      panelTag: "辅助上下文",
      panelItems: [
        "阅读质量优先；地图上下文作为可选辅助内容保留。",
        "评论和点赞在社交接口缺失时按预期降级。",
        "旧版笔记操作仍然可以在这里使用。",
      ],
    },
    article: {
      tag: "现场笔记",
      mediaFallbackTitle: "未命名媒体",
    },
    mediaTypes: {
      image: "图片",
      video: "视频",
      audio: "音频",
      media: "媒体",
    },
    actions: {
      tag: "笔记操作",
      heading: "轻量控制",
      labels: {
        author: "作者",
        currentUser: "当前用户",
        guest: "未登录",
      },
      buttons: {
        view: "增加浏览",
        rate: "评分 5",
        like: "点赞",
        unlike: "取消点赞",
        delete: "删除",
        loadMap: "显示目的地上下文",
      },
      links: {
        openMap: "在地图中打开目的地",
        composeNearby: "写一篇附近笔记",
      },
    },
    mapContext: {
      tag: "地图上下文",
      heading: "按需加载地点上下文",
      emptyTitle: "地图上下文是辅助信息",
      emptyBody: "只有当空间细节对这篇笔记有帮助时，再打开辅助目的地图结构。",
      unavailableTitle: "地图上下文不可用",
      unavailableBody: "无法加载目的地上下文。",
    },
    commentsSurface: {
      tag: "对话",
      heading: "评论",
      label: "添加评论",
      placeholder: "分享一个安静的观察，或一条路线提示。",
      submit: "发布评论",
      imageLabel: "添加图片",
      imageFallbackTitle: "评论图片",
      imagePreviewAlt: "已选择的评论图片预览",
      imageLoadFailed: "图片加载失败",
      removeImage: "移除图片",
      unknownImageType: "未知图片类型",
      imageSummary: (mimeType: unknown, size: unknown) =>
        `${copyText(mimeType, "未知图片类型")} · ${copyText(size, "0 B")}`,
      statusTitle: "评论状态",
      loadingTitle: "评论加载中",
      loadingBody: "详情页会在这里检查社交接口；如果接口缺失，会按预期降级。",
      pageLoadingBody: "正在加载这篇笔记的当前评论页。",
      failedTitle: "评论加载失败",
      emptyTitle: "暂无评论",
      unavailableTitle: "评论不可用",
      emptyBody: "从这篇笔记开始一段安静的对话。",
      unavailableBody: "当前工作区尚未提供后端评论接口。",
      loadMore: "加载更多评论",
      loadingMore: "加载中...",
      shownCount: (shown: unknown, total: unknown) => `已显示 ${copyText(shown, "0")} / ${copyText(total, "0")} 条评论`,
    },
    compression: {
      tag: "压缩导出",
      heading: "日记压缩文件",
      exportButton: "导出压缩文件",
      importLabel: "导入压缩文件",
      previewFallbackTitle: "导入的日记",
      previewTag: "导入预览",
      exportedTitle: "压缩文件已生成",
      exportedBody: "只导出了日记正文的压缩结果，图片不会写入文件。",
      importedTitle: "压缩文件已读取",
      importedBody: "下方是解压后的本地预览，线上日记未被修改。",
      failedTitle: "压缩文件处理失败",
      metrics: {
        originalLength: (value: unknown) => `原文 ${copyText(value, "0")} 字符`,
        payloadLength: (value: unknown) => `压缩载荷 ${copyText(value, "0")} 字符`,
        compressionRatio: (value: unknown) => `压缩比 ${copyText(value, "0")}`,
        savingsRatio: (value: unknown) => `节省比例 ${copyText(value, "0")}`,
      },
    },
    metrics: {
      views: (value: unknown) => `浏览 ${copyText(value, "0")}`,
      rating: (value: unknown) => `评分 ${copyText(value, "0")}`,
      ratingCount: (value: unknown) => `${copyText(value, "0")} 个评分`,
      likes: (value: unknown) => `${copyText(value, "0")} 个赞`,
      comments: (value: unknown) => `${copyText(value, "0")} 条评论`,
      createdAt: (value: unknown) => `创建于 ${copyText(value, "未知日期")}`,
      updatedAt: (value: unknown) => `更新于 ${copyText(value, "未知日期")}`,
    },
    status: {
      commentsLoadFailed: "评论无法加载。",
      viewRecorded: "浏览已记录。",
      viewFailed: "浏览操作失败。",
      ratingRecorded: "评分已记录。",
      ratingFailed: "评分操作失败。",
      deleteFailed: "删除操作失败。",
      likeUpdated: "点赞状态已更新。",
      likeFailed: "点赞操作失败。",
      refreshFailed: "笔记详情刷新失败。",
      emptyComment: "评论内容不能为空。",
      commentCreated: "评论已发布。",
      commentCreateFailed: "评论发布失败。",
      commentImageUploadFailed: "图片上传失败，评论内容和已选图片已保留。",
      invalidCommentImageType: "请选择 PNG、JPEG、WEBP 或 GIF 图片。",
      commentImageTooLarge: "图片不能超过 5 MB。",
      compressionExported: "压缩文件已导出。",
      compressionExportFailed: "压缩导出失败。",
      compressionImported: "压缩文件已解压预览。",
      compressionImportFailed: "无法读取这个压缩文件。",
    },
  },
  notFound: {
    documentTitle: "未找到",
    hero: {
      eyebrow: "未找到",
      title: "这个前端路由不在单页应用外壳中。",
      lede: (pathname: unknown) =>
        `服务器已经为 ${copyText(pathname, "当前路径")} 返回浏览器应用外壳；客户端将它解析为明确的备用页面，而不是空白屏幕或意外 404。`,
      actions: {
        home: "回到首页",
        explore: "打开探索",
        feed: "打开动态",
      },
      panelTag: "已知路由",
      knownRoutes: ["首页", "探索", "地图", "动态", "写笔记", "笔记详情"],
    },
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
  "北部带": "北部带",
  "河湾": "河湾",
  "海港线": "海港线",
  "西岭": "西岭",
  "东环": "东环",
  "中轴": "中轴",
  "North Wharf": "北码头",
  "East Bluffs": "东崖",
  "South Basin": "南湾",
};

export const worldRegionLabels: DisplayLabelMap = {
  "region-river": "河湾区域",
  "region-harbor": "港湾线区域",
  "world-region-river-arc": "河湾区域",
  "world-region-north-belt": "北部带区域",
  "world-region-west-ridge": "西岭区域",
  "world-region-central-axis": "中轴区域",
  "world-region-harbor-line": "海港线区域",
  "world-region-east-loop": "东环区域",
  "River Arc": "河湾区域",
  "North Belt": "北部带区域",
  "West Ridge": "西岭区域",
  "Central Axis": "中轴区域",
  "Harbor Line": "港湾线区域",
  "East Loop": "东环区域",
  "river arc": "河湾区域",
  "north belt": "北部带区域",
  "west ridge": "西岭区域",
  "central axis": "中轴区域",
  "harbor line": "港湾线区域",
  "east loop": "东环区域",
  "河湾": "河湾区域",
  "北部带": "北部带区域",
  "西岭": "西岭区域",
  "中轴": "中轴区域",
  "海港线": "海港线区域",
  "东环": "东环区域",
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

export const cuisineLabels: DisplayLabelMap = {
  "river grill": "河畔烤物",
  "spice street": "香料街",
  "tea house": "茶屋",
  "noodle lab": "面食实验室",
  "sea bowl": "海鲜碗",
  "bento craft": "便当工坊",
  "forest roast": "森林烘焙",
  "campus comfort": "校园简餐",
  "河畔烤物": "河畔烤物",
  "香料小街": "香料小街",
  "茶屋": "茶屋",
  "面食工坊": "面食工坊",
  "海鲜碗": "海鲜碗",
  "便当工坊": "便当工坊",
  "森林烘焙": "森林烘焙",
  "校园简餐": "校园简餐",
  tea: "茶饮",
};

export const foodVenueLabels: DisplayLabelMap = {
  "harbor court": "港湾庭院",
  "student lane": "学生巷",
  "海湾庭院": "海湾庭院",
  "学生巷": "学生巷",
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

export function displayWorldRegionLabel(value: unknown, fallback = appCopy.worldMap.meta.regionFallback): string {
  const raw = copyText(value);
  return raw ? displayLabel(worldRegionLabels, raw, raw) : fallback;
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
  const fromWorldNodeLabel = copyText(input.fromWorldNodeLabel);
  const toWorldNodeLabel = copyText(input.toWorldNodeLabel);
  const fromWorldNodeId = copyText(fromWorldNodeLabel, copyText(input.fromWorldNodeId, fallback.worldNodeId));
  const toWorldNodeId = copyText(toWorldNodeLabel, copyText(input.toWorldNodeId, fallback.worldNodeId));
  const edgeLabel = fromWorldNodeLabel || toWorldNodeLabel ? labels.worldEdge : `${labels.worldEdge} ${edgeId}`;
  const roadType = displayWorldRoadTypeLabel(input.roadType);
  const mode = displayLabel(modeLabels, input.mode, copyText(input.mode, "未知方式"));
  const distance = formatMetricDisplay(input.distance);
  const cost = formatMetricDisplay(input.cost);

  return `${labels.segmentPrefix(order)} · ${edgeLabel}：${fromWorldNodeId} → ${toWorldNodeId} · ${labels.roadType} ${roadType} · ${labels.mode} ${mode} · ${labels.distance} ${distance} ${units.meter} · ${labels.cost} ${cost}`;
}

export function portalTransferSummary(input: PortalTransferSummaryInput): string {
  const labels = appCopy.route.labels;
  const units = appCopy.route.units;
  const fallback = appCopy.route.fallback;
  const order = copyText(input.order, "0");
  const portalId = copyText(input.portalLabel, copyText(input.portalId, fallback.portalId));
  const destinationId = copyText(input.destinationLabel, copyText(input.destinationId, fallback.destinationId));
  const transferDirection = copyText(input.transferDirection);
  const localNodeId = copyText(input.localNodeLabel, copyText(input.localNodeId, fallback.localNodeId));
  const worldNodeId = copyText(input.worldNodeLabel, copyText(input.worldNodeId, fallback.worldNodeId));
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
