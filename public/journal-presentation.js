(function attachJournalPresentation(root, factory) {
  const api = factory()
  if (typeof module === "object" && module.exports) {
    module.exports = api
  }
  root.JournalPresentation = api
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function normalizeText(value, fallback = "") {
    if (typeof value !== "string") {
      return value == null ? fallback : String(value)
    }
    const trimmed = value.trim()
    return trimmed || fallback
  }

  function normalizeQualifierParts(parts) {
    const list = Array.isArray(parts) ? parts : parts == null ? [] : [parts]
    return list.map((part) => normalizeText(part)).filter(Boolean)
  }

  function createLabelCandidate(entry, depth) {
    const qualifier = entry.qualifierParts.slice(0, depth).join(" · ")
    return qualifier ? `${entry.baseLabel} (${qualifier})` : `${entry.baseLabel} [${entry.key}]`
  }

  function createSelectOptionsWithDisambiguatedLabels(
    items,
    {
      getKey = (item) => item?.id,
      getBaseLabel = (item) => item?.name ?? item?.id,
      getQualifierParts = (item) => [item?.id],
    } = {},
  ) {
    const prepared = (Array.isArray(items) ? items : []).map((item, index) => {
      const key = normalizeText(getKey(item), `item-${index + 1}`)
      const baseLabel = normalizeText(getBaseLabel(item), key)
      const qualifierParts = normalizeQualifierParts(getQualifierParts(item))

      if (!qualifierParts.includes(key)) {
        qualifierParts.push(key)
      }

      return {
        item,
        key,
        baseLabel,
        qualifierParts,
      }
    })

    const groupByBaseLabel = new Map()
    prepared.forEach((entry) => {
      if (!groupByBaseLabel.has(entry.baseLabel)) {
        groupByBaseLabel.set(entry.baseLabel, [])
      }
      groupByBaseLabel.get(entry.baseLabel).push(entry)
    })

    return prepared.map((entry) => {
      const group = groupByBaseLabel.get(entry.baseLabel) || []
      if (group.length === 1) {
        return {
          ...entry.item,
          label: entry.baseLabel,
        }
      }

      const maxDepth = Math.max(...group.map((candidate) => candidate.qualifierParts.length))
      for (let depth = 1; depth <= maxDepth; depth += 1) {
        const labels = group.map((candidate) => createLabelCandidate(candidate, depth))
        if (new Set(labels).size === labels.length) {
          return {
            ...entry.item,
            label: createLabelCandidate(entry, depth),
          }
        }
      }

      return {
        ...entry.item,
        label: `${entry.baseLabel} [${entry.key}]`,
      }
    })
  }

  function createDestinationSelectOptions(destinations) {
    return createSelectOptionsWithDisambiguatedLabels(destinations, {
      getKey: (destination) => destination?.id,
      getBaseLabel: (destination) => destination?.name ?? destination?.id,
      getQualifierParts: (destination) => [destination?.region, destination?.id],
    })
  }

  function resolveLookupLabel(id, lookup, fallbackLabel) {
    if (id && lookup && typeof lookup.get === "function") {
      const record = lookup.get(id)
      const name = normalizeText(record?.name)
      if (name) {
        return name
      }
    }

    if (id) {
      return String(id)
    }

    return fallbackLabel
  }

  function summarizeText(value, maxLength = 180) {
    const normalized = normalizeText(value).replace(/\s+/g, " ")
    if (normalized.length <= maxLength) {
      return normalized
    }

    const trimmed = normalized.slice(0, Math.max(0, maxLength - 3))
    const safeBoundary = trimmed.lastIndexOf(" ")
    return `${(safeBoundary > 40 ? trimmed.slice(0, safeBoundary) : trimmed).trim()}...`
  }

  function formatJournalMetadata(journal, lookups = {}) {
    const destinationLabel = resolveLookupLabel(
      journal?.destinationId,
      lookups.destinationById,
      "Unknown destination",
    )
    const userLabel = resolveLookupLabel(journal?.userId, lookups.userById, "Unknown user")

    return {
      destinationLabel,
      userLabel,
      attribution: `${destinationLabel} / ${userLabel}`,
    }
  }

  return {
    createDestinationSelectOptions,
    createSelectOptionsWithDisambiguatedLabels,
    formatJournalMetadata,
    resolveLookupLabel,
    summarizeText,
  }
})
