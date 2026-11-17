import { describe, expect, it } from "vitest";
import { helpSlugForPath } from "./contextualHelp";
import { RECORD_HELPS } from "./recordHelps";
import { getHelpTopic } from "./topics";

describe("helpSlugForPath", () => {
  it.each([
    ["/cats", "households-and-cats"],
    ["/cats/new", "add-cat"],
    ["/cats/cat-1", "records"],
    ["/cats/cat-1/edit", "add-cat"],
    ["/cats/cat-1/timeline", "records"],
    ["/cats/cat-1/notification-settings", "notifications"],
    ["/cats/cat-1/poop-records", "records/poop-records"],
    ["/cats/cat-1/poop-records/new", "records/poop-records"],
    ["/cats/cat-1/poop-records/record-1/edit", "records/poop-records"],
    ["/cats/cat-1/cleaning/targets/target-1/records/new", "records/cleaning"],
    ["/cats/cat-1/medications/medication-1/doses", "records/medications"],
    ["/households/household-1/feeding-records/new", "records/feeding-records"],
    ["/feeding-presets/new", "feeding-presets"],
    ["/food-products/search", "household-food"],
    ["/invitations/token", "create-household"],
    ["/notifications", "notifications"],
    ["/oauth/authorize", "ai-connections"],
    ["/settings/households", "create-household"],
    ["/settings/households/new", "create-household"],
    ["/settings/households/household-1", "create-household"],
    ["/settings/households/household-1/feeding-schedules", "household-food"],
    ["/settings/notifications", "notifications"],
    ["/settings/ai-connections/connection-1", "ai-connections"],
  ])("%s は %s の記事にする", (pathname, slug) => {
    expect(helpSlugForPath(pathname)).toBe(slug);
    expect(() => getHelpTopic(slug)).not.toThrow();
  });

  it.each([
    "/",
    "/home",
    "/login",
    "/settings",
    "/settings/appearance",
    "/help",
    "/help/records",
    "/release-notes",
  ])("%s は対応する記事がない", (pathname) => {
    expect(helpSlugForPath(pathname)).toBeNull();
  });

  it("記録の種類ごとの画面は、その種類の記事にする", () => {
    for (const record of RECORD_HELPS) {
      expect(helpSlugForPath(`/cats/cat-1/${record.recordType}`)).toBe(
        `records/${record.recordType}`,
      );
    }
  });
});
