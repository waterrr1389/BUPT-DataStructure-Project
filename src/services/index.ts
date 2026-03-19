import { createDestinationService } from "./destination-service";
import { createExchangeService } from "./exchange-service";
import { createFacilityService } from "./facility-service";
import { createFoodService } from "./food-service";
import { createJournalService } from "./journal-service";
import { JournalStore } from "./journal-store";
import { createRouteService } from "./route-service";
import type { ServiceContextOptions, UserRecord } from "./contracts";
import { getRuntime } from "./runtime";

function summarizeBootstrapUser(user: UserRecord): Pick<UserRecord, "id" | "name"> {
  return {
    id: user.id,
    name: user.name,
  };
}

export async function createAppServices(options: ServiceContextOptions = {}) {
  const runtime = await getRuntime(options);
  const journalStore = new JournalStore({
    runtimeDir: runtime.runtimeDir,
    seedJournals: runtime.seedData.journals,
  });

  const destinations = createDestinationService(runtime);
  const routing = createRouteService(runtime);
  const facilities = createFacilityService(runtime);
  const journals = createJournalService(runtime, journalStore);
  const exchange = createExchangeService(runtime, journalStore);
  const foods = createFoodService(runtime);

  return {
    runtime,
    journalStore,
    destinations,
    routing,
    facilities,
    journals,
    exchange,
    foods,
    async bootstrap() {
      return {
        users: runtime.seedData.users.map(summarizeBootstrapUser),
        categories: destinations.listCategories(),
        cuisines: foods.listCuisines(),
        featured: destinations.listCatalog(12),
        destinations: destinations.listAll(),
        source: runtime.source,
      };
    },
  };
}

export type AppServices = Awaited<ReturnType<typeof createAppServices>>;
