import type {
  FacilityCategoryDefinition,
  SeedData,
  SeedLookups,
} from "../domain/models";
import { fallbackSeedData } from "../services/fallback-data";

export const facilityCategories: FacilityCategoryDefinition[] = [
  {
    id: "restroom",
    label: "Restrooms",
    summary: "Indoor and outdoor restroom stops across the destination network.",
    keywords: ["restroom", "bathroom", "toilet"],
  },
  {
    id: "clinic",
    label: "Clinics",
    summary: "First-aid and on-site care points for urgent visitor needs.",
    keywords: ["clinic", "medical", "first aid"],
  },
  {
    id: "store",
    label: "Stores",
    summary: "Retail counters for travel basics, gifts, and quick supplies.",
    keywords: ["store", "shop", "retail"],
  },
  {
    id: "charging",
    label: "Charging",
    summary: "Power and device charging points near active circulation nodes.",
    keywords: ["charging", "power", "device"],
  },
  {
    id: "info",
    label: "Information",
    summary: "Help desks and visitor guidance points for wayfinding support.",
    keywords: ["info", "help", "guide"],
  },
  {
    id: "parking",
    label: "Parking",
    summary: "Vehicle and bike parking access points around major entries.",
    keywords: ["parking", "garage", "bike"],
  },
  {
    id: "water",
    label: "Water",
    summary: "Bottle refill and drinking water stops along common routes.",
    keywords: ["water", "refill", "drink"],
  },
  {
    id: "atm",
    label: "ATMs",
    summary: "Cash access points near plazas, halls, and market areas.",
    keywords: ["atm", "cash", "banking"],
  },
  {
    id: "security",
    label: "Security",
    summary: "Security and assistance desks positioned at key checkpoints.",
    keywords: ["security", "safety", "assistance"],
  },
  {
    id: "lounge",
    label: "Lounges",
    summary: "Rest and waiting spaces for breaks between destination stops.",
    keywords: ["lounge", "rest", "waiting"],
  },
];

export const seedData: SeedData = {
  version: "fallback-adapter-v1",
  generatedAt: "2026-03-18T00:00:00.000Z",
  facilityCategories,
  destinations: fallbackSeedData.destinations,
  users: fallbackSeedData.users,
  journals: fallbackSeedData.journals,
};

export const lookups: SeedLookups = {
  destinationById: new Map(seedData.destinations.map((destination) => [destination.id, destination])),
  userById: new Map(seedData.users.map((user) => [user.id, user])),
  facilityCategoryById: new Map(
    seedData.facilityCategories.map((category) => [category.id, category]),
  ),
};

export const destinationById = lookups.destinationById;
export const userById = lookups.userById;
export const facilityCategoryById = lookups.facilityCategoryById;

export default {
  seedData,
  lookups,
};
