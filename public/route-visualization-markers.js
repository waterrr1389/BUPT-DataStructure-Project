(function attachRouteVisualizationMarkers(root, factory) {
  const api = factory()
  if (typeof module === "object" && module.exports) {
    module.exports = api
  }
  root.RouteVisualizationMarkers = api
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const CLOSED_LOOP_ENDPOINT_OFFSET = 14
  const MARKER_SEMANTICS = {
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
  }

  function projectPoint(projection, node) {
    const point = projection.point(node)
    return {
      x: point.x,
      y: point.y,
    }
  }

  function offsetPoint(point, dx = 0, dy = 0) {
    return {
      x: point.x + dx,
      y: point.y + dy,
    }
  }

  function createMarker(kind, point, overrides = {}) {
    const semantic = MARKER_SEMANTICS[kind]
    return {
      kind,
      legendBadgeLabel: semantic.legendBadgeLabel,
      legendLabel: semantic.legendLabel,
      semanticKey: semantic.semanticKey,
      state: semantic.state,
      variantClass: semantic.variantClass,
      ...overrides,
      point,
    }
  }

  function createEndpointMarkers(routeNodes, projection) {
    if (!routeNodes.length) {
      return []
    }

    const startNode = routeNodes[0]
    const endNode = routeNodes[routeNodes.length - 1]
    const startLogicalPoint = projectPoint(projection, startNode)
    const endLogicalPoint = projectPoint(projection, endNode)
    const sharedLogicalNode = startNode.id === endNode.id

    return [
      createMarker(
        "start",
        sharedLogicalNode
          ? offsetPoint(startLogicalPoint, -CLOSED_LOOP_ENDPOINT_OFFSET, -CLOSED_LOOP_ENDPOINT_OFFSET)
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
    ]
  }

  function createContextMarkers(markers, projection, kind) {
    return markers.map((marker) => {
      const point = projectPoint(projection, marker.node)
      return createMarker(kind, point, {
        label: marker.shortLabel,
        logicalPoint: point,
        nodeId: marker.node.id,
        ...(kind === "transition" || kind === "turn" ? { legendBadgeLabel: marker.shortLabel } : {}),
      })
    })
  }

  function createPreviewMarkers(previewSelection, projection) {
    const previewMarkers = []

    if (previewSelection?.startNode) {
      const point = projectPoint(projection, previewSelection.startNode)
      previewMarkers.push(
        createMarker("preview-start", point, {
          label: "Start",
          logicalPoint: point,
          nodeId: previewSelection.startNode.id,
          sharedLogicalNode: false,
        }),
      )
    }

    if (previewSelection?.endNode) {
      const point = projectPoint(projection, previewSelection.endNode)
      previewMarkers.push(
        createMarker("preview-end", point, {
          label: "End",
          logicalPoint: point,
          nodeId: previewSelection.endNode.id,
          sharedLogicalNode: false,
        }),
      )
    }

    return previewMarkers
  }

  function createRouteMarkerLayout(routeAnalysis, projection) {
    if (!routeAnalysis) {
      return {
        endpointMarkers: [],
        transitionMarkers: [],
        turnMarkers: [],
      }
    }

    return {
      endpointMarkers: createEndpointMarkers(routeAnalysis.routeNodes, projection),
      transitionMarkers: createContextMarkers(routeAnalysis.transitionMarkers, projection, "transition"),
      turnMarkers: createContextMarkers(routeAnalysis.turnMarkers, projection, "turn"),
    }
  }

  return {
    createEndpointMarkers,
    createPreviewMarkers,
    createRouteMarkerLayout,
  }
})
