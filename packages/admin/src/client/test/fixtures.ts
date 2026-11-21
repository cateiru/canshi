import type {
  CatalogFoodProductJson,
  CatalogFoodProductsResponse,
  HouseholdDetailResponse,
  UserDetailResponse,
  UserJson,
} from "../../api/types";

export function product(
  values: Partial<CatalogFoodProductJson> & { id: string; name: string },
): CatalogFoodProductJson {
  return {
    manufacturer: null,
    kcalPer100g: 380,
    packageSizes: [{ amountG: 500, unit: null }],
    nutritionType: "complete",
    textureType: "dry",
    lifeStages: [],
    targetBreed: null,
    searchKeywords: [],
    imageAssetId: null,
    addedCount: 0,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...values,
  };
}

/** 一覧の API と同じく、メーカー名・商品名の順（メーカー名のない商品は最後） */
export const PRODUCTS: CatalogFoodProductsResponse = {
  products: [
    product({ id: "p-3", name: "とりささみ", manufacturer: "いぬフード" }),
    product({
      id: "p-2",
      name: "かつお味 パウチ",
      manufacturer: "ねこフード",
      searchKeywords: ["Premium"],
    }),
    product({
      id: "p-1",
      name: "まぐろ味 カリカリ",
      manufacturer: "ねこフード",
      packageSizes: [
        { amountG: 12.3, unit: "本" },
        { amountG: 1500, unit: null },
      ],
      lifeStages: ["adult", "senior"],
    }),
    product({ id: "p-4", name: "まぐろスープ" }),
  ],
};

export function user(
  values: Partial<UserJson> & { id: string; name: string },
): UserJson {
  return {
    role: "member",
    createdAt: "2026-10-01T00:00:00.000Z",
    activeSessionCount: 0,
    latestSessionExpiresAt: null,
    households: [],
    ...values,
  };
}

export const USER_DETAIL: UserDetailResponse = {
  user: {
    id: "user-1",
    name: "たろう",
    role: "admin",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-02T00:00:00.000Z",
    households: [
      {
        householdId: "household-1",
        householdName: "わが家",
        role: "owner",
        joinedAt: "2026-10-01T00:00:00.000Z",
      },
    ],
    sessions: [
      {
        id: "session-1",
        deviceName: "iPhone・Safari",
        createdAt: "2026-10-01T00:00:00.000Z",
        expiresAt: "2026-11-01T00:00:00.000Z",
      },
    ],
    pushSubscriptions: [],
  },
};

export const HOUSEHOLD_DETAIL: HouseholdDetailResponse = {
  household: {
    id: "household-1",
    name: "わが家",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    members: [
      {
        userId: "user-1",
        userName: "たろう",
        role: "owner",
        joinedAt: "2026-10-01T00:00:00.000Z",
      },
      {
        userId: "user-2",
        userName: "<script>alert(1)</script>",
        role: "member",
        joinedAt: "2026-10-01T00:01:00.000Z",
      },
    ],
    cats: [
      {
        id: "cat-1",
        name: "みけ",
        sex: "female",
        birthDate: "2020-04-01",
        birthDatePrecision: "month",
        memorialDate: null,
        createdAt: "2026-10-01T00:00:00.000Z",
      },
    ],
    invitations: [
      {
        id: "invitation-1",
        createdByUserId: "user-1",
        createdByUserName: "たろう",
        status: "accepted",
        createdAt: "2026-10-01T00:00:00.000Z",
        expiresAt: "2026-10-08T00:00:00.000Z",
        acceptedByUserId: "user-2",
        acceptedByUserName: "<script>alert(1)</script>",
        acceptedAt: "2026-10-01T00:01:00.000Z",
      },
    ],
  },
  users: [
    { id: "user-1", name: "たろう" },
    { id: "user-2", name: "<script>alert(1)</script>" },
    { id: "user-3", name: "はなこ" },
  ],
};
