(function attachRouteVisualizationMarkers(root, factory) {
  const api = factory()
  if (typeof module === "object" && module.exports) {
    module.exports = api
  }
  root.RouteVisualizationMarkers = api
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const CLOSED_LOOP_ENDPOINT_OFFSET = 14

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
      {
        kind: "start",
        label: "Start",
        logicalPoint: startLogicalPoint,
        nodeId: startNode.id,
        point: sharedLogicalNode
          ? offsetPoint(startLogicalPoint, -CLOSED_LOOP_ENDPOINT_OFFSET, -CLOSED_LOOP_ENDPOINT_OFFSET)
          : startLogicalPoint,
        sharedLogicalNode,
        variantClass: "is-start",
      },
      {
        kind: "end",
        label: "End",
        logicalPoint: endLogicalPoint,
        nodeId: endNode.id,
        point: sharedLogicalNode
          ? offsetPoint(endLogicalPoint, CLOSED_LOOP_ENDPOINT_OFFSET, CLOSED_LOOP_ENDPOINT_OFFSET)
          : endLogicalPoint,
        sharedLogicalNode,
        variantClass: "is-end",
      },
    ]
  }

  function createContextMarkers(markers, projection, kind, variantClass) {
    return markers.map((marker) => {
      const point = projectPoint(projection, marker.node)
      return {
        kind,
        label: marker.shortLabel,
        logicalPoint: point,
        nodeId: marker.node.id,
        point,
        variantClass,
      }
    })
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
      transitionMarkers: createContextMarkers(routeAnalysis.transitionMarkers, projection, "transition", "is-transition"),
      turnMarkers: createContextMarkers(routeAnalysis.turnMarkers, projection, "turn", "is-turn"),
    }
  }

  return {
    createEndpointMarkers,
    createRouteMarkerLayout,
  }
})
