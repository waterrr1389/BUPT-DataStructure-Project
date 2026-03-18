import { MINIMUM_COUNTS } from "../src/data/validation";
import type {
  Destination,
  FacilityCategoryDefinition,
  SeedData,
  UserProfile,
} from "../src/domain/models";

const FACILITY_CATEGORIES: FacilityCategoryDefinition[] = [
  {
    id: "restroom",
    keywords: ["restroom", "toilet", "washroom"],
    label: "Restroom",
    summary: "Restroom access for visitors and students.",
  },
  {
    id: "clinic",
    keywords: ["clinic", "health", "first-aid"],
    label: "Clinic",
    summary: "Basic health and first-aid support.",
  },
  {
    id: "store",
    keywords: ["store", "shop", "supplies"],
    label: "Store",
    summary: "Retail and convenience supply stops.",
  },
  {
    id: "charging",
    keywords: ["charging", "power", "battery"],
    label: "Charging",
    summary: "Charging points for phones and devices.",
  },
  {
    id: "info",
    keywords: ["info", "guide", "help"],
    label: "Info Desk",
    summary: "Visitor information and routing help.",
  },
  {
    id: "parking",
    keywords: ["parking", "car", "drop-off"],
    label: "Parking",
    summary: "Parking and pick-up coordination areas.",
  },
  {
    id: "water",
    keywords: ["water", "fountain", "refill"],
    label: "Water",
    summary: "Water refill and hydration stations.",
  },
  {
    id: "atm",
    keywords: ["atm", "cash", "banking"],
    label: "ATM",
    summary: "Cash access for lightweight transactions.",
  },
  {
    id: "security",
    keywords: ["security", "guard", "safety"],
    label: "Security",
    summary: "Security assistance and safety response.",
  },
  {
    id: "lounge",
    keywords: ["lounge", "rest", "waiting"],
    label: "Lounge",
    summary: "Waiting and resting areas for guests.",
  },
];

function createIsoTimestamp(dayOffset: number, hour = 8): string {
  return new Date(Date.UTC(2026, 0, 1 + dayOffset, hour, 0, 0)).toISOString();
}

function createDestination(
  index: number,
  categories: readonly FacilityCategoryDefinition[],
): Destination {
  const number = index + 1;
  const destinationId = `destination-${number}`;
  const buildingId = `${destinationId}-building`;
  const gateNodeId = `${destinationId}-gate`;
  const hubNodeId = `${destinationId}-hub`;
  const category = categories[index % categories.length];
  const type = index % 2 === 0 ? "campus" : "scenic";

  return {
    buildings: [
      {
        category: type === "campus" ? "teaching" : "visitor-center",
        destinationId,
        entranceNodeId: hubNodeId,
        floors: 2 + (index % 3),
        id: buildingId,
        name: `Building ${number}`,
        tags: ["sample", type, "entry"],
      },
    ],
    categories: [type, "sample", `cluster-${index % 10}`],
    description:
      `Sample destination ${number} includes repeatable routing, search, and food fixtures ` +
      "for zero-dependency scripts and smoke tests.",
    facilities: [
      {
        category: category.id,
        destinationId,
        id: `${destinationId}-facility`,
        name: `${category.label} ${number}`,
        nodeId: hubNodeId,
        openHours: "08:00-20:00",
      },
    ],
    featured: index < 8,
    foods: [
      {
        avgPrice: 18 + (index % 6),
        cuisine: index % 2 === 0 ? "local" : "fusion",
        destinationId,
        heat: 35 + (index % 55),
        id: `${destinationId}-food`,
        keywords: ["lunch", "sample", type],
        name: `Cafe ${number}`,
        nodeId: hubNodeId,
        rating: 3.6 + ((index % 10) / 10),
        venue: `Dining Hall ${number}`,
      },
    ],
    graph: {
      edges: [
        {
          allowedModes: ["walk"],
          congestion: 1,
          distance: 1 + (index % 3),
          from: gateNodeId,
          id: `${destinationId}-edge`,
          roadType: "walkway",
          to: hubNodeId,
        },
      ],
      nodes: [
        {
          floor: 0,
          id: gateNodeId,
          kind: "gate",
          keywords: ["entry", "arrival", "sample"],
          name: `Gate ${number}`,
          x: number * 3,
          y: number * 2,
        },
        {
          buildingId,
          floor: 1,
          id: hubNodeId,
          kind: "building",
          keywords: ["hub", "indoor", "sample"],
          name: `Hub ${number}`,
          x: (number * 3) + 1,
          y: (number * 2) + 1,
        },
      ],
    },
    heat: 40 + (index % 60),
    id: destinationId,
    keywords: ["sample", "route", "travel", `zone-${index % 12}`],
    name: `Sample Destination ${number}`,
    rating: 3.5 + ((index % 9) / 10),
    region: `Region ${1 + (index % 6)}`,
    type,
  };
}

function createUsers(destinations: readonly Destination[]): UserProfile[] {
  return Array.from({ length: MINIMUM_COUNTS.users }, (_, index) => {
    const homeDestination = destinations[index];

    return {
      dietaryPreferences: index % 3 === 0 ? ["vegetarian"] : [],
      homeDestinationId: homeDestination.id,
      id: `user-${index + 1}`,
      interests: ["food", "route", index % 2 === 0 ? "campus" : "scenic"],
      name: `Sample User ${index + 1}`,
    };
  });
}

export function createSampleSeedData(): SeedData {
  const facilityCategories = FACILITY_CATEGORIES.map((category) => ({
    ...category,
    keywords: [...category.keywords],
  }));
  const destinations = Array.from(
    { length: MINIMUM_COUNTS.destinations },
    (_, index) => createDestination(index, facilityCategories),
  );
  const users = createUsers(destinations);
  const journals: SeedData["journals"] = Array.from(
    { length: MINIMUM_COUNTS.users * 2 },
    (_, index) => {
      const author = users[index % users.length];
      const reviewer = users[(index + 1) % users.length];
      const destination = destinations[index % destinations.length];
      const createdAt = createIsoTimestamp(index);

      return {
        body:
          `${destination.name} offers predictable routes, searchable text, and stable fixtures ` +
          "for round-0 smoke tests and script entrypoints.",
        createdAt,
        destinationId: destination.id,
        id: `journal-${index + 1}`,
        media: [
          {
            source: `sample://${destination.id}/cover`,
            title: `${destination.name} cover`,
            type: "image",
          },
        ],
        ratings: [
          {
            score: (index % 5) + 1,
            userId: reviewer.id,
          },
        ],
        recommendedFor: [author.id, reviewer.id],
        tags: ["sample", destination.type, "journal"],
        title: `Visit Notes ${index + 1}`,
        updatedAt: createIsoTimestamp(index, 12),
        userId: author.id,
        views: index * 11,
      };
    },
  );

  return {
    destinations,
    facilityCategories,
    generatedAt: createIsoTimestamp(0),
    journals,
    users,
    version: "sample-2026-01",
  };
}
