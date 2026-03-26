declare const module:
  | {
      exports?: unknown;
    }
  | undefined;

const CLOSED_LOOP_ENDPOINT_OFFSET = 14;

type MarkerKind =
  | "end"
  | "preview-end"
  | "preview-start"
  | "start"
  | "transition"
  | "turn";

type MarkerState = "active-route" | "preview";

type Point = {
  x: number;
  y: number;
};

type RouteNode = Point & {
  id: string;
};

type Projection<TNode extends RouteNode = RouteNode> = {
  point(node: TNode): Point;
};

type MarkerSemantics = {
  legendBadgeLabel: string;
  legendLabel: string;
  semanticKey: MarkerKind;
  state: MarkerState;
  variantClass: string;
};

type RouteMarker = {
  kind: MarkerKind;
  label?: string;
  legendBadgeLabel: string;
  legendLabel: string;
  logicalPoint?: Point;
  nodeId?: string;
  point: Point;
  semanticKey: MarkerKind;
  sharedLogicalNode?: boolean;
  state: MarkerState;
  variantClass: string;
};

type ContextMarkerInput<TNode extends RouteNode = RouteNode> = {
  label: string;
  node: TNode;
  shortLabel: string;
};

type PreviewSelection<TNode extends RouteNode = RouteNode> = {
  endNode?: TNode;
  startNode?: TNode;
};

type RouteAnalysis<TNode extends RouteNode = RouteNode> = {
  routeNodes: TNode[];
  transitionMarkers: Array<ContextMarkerInput<TNode>>;
  turnMarkers: Array<ContextMarkerInput<TNode>>;
};

type RouteMarkerLayout = {
  endpointMarkers: RouteMarker[];
  transitionMarkers: RouteMarker[];
  turnMarkers: RouteMarker[];
};

type RouteVisualizationMarkersApi = {
  createEndpointMarkers<TNode extends RouteNode>(
    routeNodes: TNode[],
    projection: Projection<TNode>,
  ): RouteMarker[];
  createPreviewMarkers<TNode extends RouteNode>(
    previewSelection: PreviewSelection<TNode> | null | undefined,
    projection: Projection<TNode>,
  ): RouteMarker[];
  createRouteMarkerLayout<TNode extends RouteNode>(
    routeAnalysis: RouteAnalysis<TNode> | null | undefined,
    projection: Projection<TNode>,
  ): RouteMarkerLayout;
};

type RouteVisualizationMarkersRoot = typeof globalThis & {
  RouteVisualizationMarkers?: RouteVisualizationMarkersApi;
};

/**
 * Publishes the helper API to both browser-global and CommonJS consumers.
 */
(function attachRouteVisualizationMarkers(
  root: RouteVisualizationMarkersRoot,
  factory: () => RouteVisualizationMarkersApi,
): void {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.RouteVisualizationMarkers = api;
})(
  (typeof globalThis !== "undefined" ? globalThis : this) as RouteVisualizationMarkersRoot,
  () => {
    const MARKER_SEMANTICS: Record<MarkerKind, MarkerSemantics> = {
      start: {
        legendBadgeLabel: "Start",
        legendLabel: "Start",
        semanticKey: "start",
        state: "active-route",
        variantClass: "is-start",
      },
      end: {
        legendBadgeLabel: "End",
        legendLabel: "End",
        semanticKey: "end",
        state: "active-route",
        variantClass: "is-end",
      },
      transition: {
        legendBadgeLabel: "Indoor",
        legendLabel: "Indoor/outdoor change",
        semanticKey: "transition",
        state: "active-route",
        variantClass: "is-transition",
      },
      turn: {
        legendBadgeLabel: "Turn",
        legendLabel: "Direction or route change",
        semanticKey: "turn",
        state: "active-route",
        variantClass: "is-turn",
      },
      "preview-start": {
        legendBadgeLabel: "Start",
        legendLabel: "Preview start",
        semanticKey: "preview-start",
        state: "preview",
        variantClass: "is-preview",
      },
      "preview-end": {
        legendBadgeLabel: "End",
        legendLabel: "Preview end",
        semanticKey: "preview-end",
        state: "preview",
        variantClass: "is-preview",
      },
    };

    /**
     * Projects a logical route node into screen coordinates.
     */
    function projectPoint<TNode extends RouteNode>(
      projection: Projection<TNode>,
      node: TNode,
    ): Point {
      const point = projection.point(node);
      return {
        x: point.x,
        y: point.y,
      };
    }

    /**
     * Applies a small pixel offset to a rendered marker position.
     */
    function offsetPoint(point: Point, dx = 0, dy = 0): Point {
      return {
        x: point.x + dx,
        y: point.y + dy,
      };
    }

    /**
     * Creates a concrete marker with semantic metadata attached.
     */
    function createMarker(
      kind: MarkerKind,
      point: Point,
      overrides: Partial<RouteMarker> = {},
    ): RouteMarker {
      const semantic = MARKER_SEMANTICS[kind];
      return {
        kind,
        legendBadgeLabel: semantic.legendBadgeLabel,
        legendLabel: semantic.legendLabel,
        semanticKey: semantic.semanticKey,
        state: semantic.state,
        variantClass: semantic.variantClass,
        ...overrides,
        point,
      };
    }

    /**
     * Builds start and end markers, offsetting closed loops for readability.
     */
    function createEndpointMarkers<TNode extends RouteNode>(
      routeNodes: TNode[],
      projection: Projection<TNode>,
    ): RouteMarker[] {
      if (!routeNodes.length) {
        return [];
      }

      const startNode = routeNodes[0];
      const endNode = routeNodes[routeNodes.length - 1];
      const startLogicalPoint = projectPoint(projection, startNode);
      const endLogicalPoint = projectPoint(projection, endNode);
      const sharedLogicalNode = startNode.id === endNode.id;

      return [
        createMarker(
          "start",
          sharedLogicalNode
            ? offsetPoint(
                startLogicalPoint,
                -CLOSED_LOOP_ENDPOINT_OFFSET,
                -CLOSED_LOOP_ENDPOINT_OFFSET,
              )
            : startLogicalPoint,
          {
            label: "Start",
            logicalPoint: startLogicalPoint,
            nodeId: startNode.id,
            sharedLogicalNode,
          },
        ),
        createMarker(
          "end",
          sharedLogicalNode
            ? offsetPoint(endLogicalPoint, CLOSED_LOOP_ENDPOINT_OFFSET, CLOSED_LOOP_ENDPOINT_OFFSET)
            : endLogicalPoint,
          {
            label: "End",
            logicalPoint: endLogicalPoint,
            nodeId: endNode.id,
            sharedLogicalNode,
          },
        ),
      ];
    }

    /**
     * Projects transition and turn markers with their semantic labels intact.
     */
    function createContextMarkers<TNode extends RouteNode>(
      markers: Array<ContextMarkerInput<TNode>>,
      projection: Projection<TNode>,
      kind: "transition" | "turn",
    ): RouteMarker[] {
      return markers.map((marker) => {
        const point = projectPoint(projection, marker.node);
        return createMarker(kind, point, {
          label: marker.shortLabel,
          logicalPoint: point,
          nodeId: marker.node.id,
          ...(kind === "transition" || kind === "turn"
            ? { legendBadgeLabel: marker.shortLabel }
            : {}),
        });
      });
    }

    /**
     * Creates preview-only start and end markers for tentative routes.
     */
    function createPreviewMarkers<TNode extends RouteNode>(
      previewSelection: PreviewSelection<TNode> | null | undefined,
      projection: Projection<TNode>,
    ): RouteMarker[] {
      const previewMarkers: RouteMarker[] = [];

      if (previewSelection?.startNode) {
        const point = projectPoint(projection, previewSelection.startNode);
        previewMarkers.push(
          createMarker("preview-start", point, {
            label: "Start",
            logicalPoint: point,
            nodeId: previewSelection.startNode.id,
            sharedLogicalNode: false,
          }),
        );
      }

      if (previewSelection?.endNode) {
        const point = projectPoint(projection, previewSelection.endNode);
        previewMarkers.push(
          createMarker("preview-end", point, {
            label: "End",
            logicalPoint: point,
            nodeId: previewSelection.endNode.id,
            sharedLogicalNode: false,
          }),
        );
      }

      return previewMarkers;
    }

    /**
     * Groups all active-route markers needed by the route visualization layer.
     */
    function createRouteMarkerLayout<TNode extends RouteNode>(
      routeAnalysis: RouteAnalysis<TNode> | null | undefined,
      projection: Projection<TNode>,
    ): RouteMarkerLayout {
      if (!routeAnalysis) {
        return {
          endpointMarkers: [],
          transitionMarkers: [],
          turnMarkers: [],
        };
      }

      return {
        endpointMarkers: createEndpointMarkers(routeAnalysis.routeNodes, projection),
        transitionMarkers: createContextMarkers(
          routeAnalysis.transitionMarkers,
          projection,
          "transition",
        ),
        turnMarkers: createContextMarkers(routeAnalysis.turnMarkers, projection, "turn"),
      };
    }

    return {
      createEndpointMarkers,
      createPreviewMarkers,
      createRouteMarkerLayout,
    };
  },
);
