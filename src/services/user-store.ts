import { createHash } from "node:crypto";
import type { UserRecord } from "./contracts";

const FIXED_SALT = "trail-atlas-fixed-salt";

export function hashPassword(password: string): string {
  return createHash("sha256").update(password + FIXED_SALT).digest("hex");
}

type UserStoreEntry = {
  profile: UserRecord;
  passwordHash: string;
};

export type UserCreateInput = {
  name: string;
  password: string;
  interests?: string[];
  dietaryPreferences?: string[];
  homeDestinationId?: string;
};

export class UserStore {
  private users = new Map<string, UserStoreEntry>();
  private nextId: number;

  constructor(options: { seedUsers: UserRecord[]; defaultPassword?: string }) {
    const password = options.defaultPassword ?? "trail-atlas";
    for (const user of options.seedUsers) {
      this.users.set(user.id, {
        profile: user,
        passwordHash: hashPassword(password),
      });
    }
    this.nextId = options.seedUsers.length + 1;
  }

  findById(id: string): UserRecord | null {
    return this.users.get(id)?.profile ?? null;
  }

  list(): UserRecord[] {
    return [...this.users.values()].map((entry) => entry.profile);
  }

  findByName(name: string): UserRecord | null {
    for (const entry of this.users.values()) {
      if (entry.profile.name === name) {
        return entry.profile;
      }
    }
    return null;
  }

  create(input: UserCreateInput): UserRecord {
    if (this.findByName(input.name)) {
      throw new Error("Username already exists.");
    }

    const profile: UserRecord = {
      id: `user-${this.nextId}`,
      name: input.name,
      interests: input.interests ?? [],
      dietaryPreferences: input.dietaryPreferences ?? [],
      homeDestinationId: input.homeDestinationId ?? "",
    };

    this.nextId += 1;

    this.users.set(profile.id, {
      profile,
      passwordHash: hashPassword(input.password),
    });

    return profile;
  }

  verifyPassword(name: string, password: string): UserRecord | null {
    const user = this.findByName(name);
    if (!user) {
      return null;
    }
    const entry = this.users.get(user.id);
    if (!entry) {
      return null;
    }
    const hash = hashPassword(password);
    if (entry.passwordHash !== hash) {
      return null;
    }
    return user;
  }
}
