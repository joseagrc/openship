import { describe, expect, test } from "vitest";

import { storedPublicEndpointsNeedCloud } from "./public-endpoints";
import { getRoutingBaseDomain } from "./routing-domains";

describe("storedPublicEndpointsNeedCloud", () => {
  const base = getRoutingBaseDomain();

  test("empty values do not need Cloud", () => {
    expect(storedPublicEndpointsNeedCloud([])).toBe(false);
    expect(storedPublicEndpointsNeedCloud(null)).toBe(false);
    expect(storedPublicEndpointsNeedCloud(undefined)).toBe(false);
  });

  test("a managed free subdomain needs Cloud", () => {
    expect(storedPublicEndpointsNeedCloud([{ domain: "myapp", domainType: "free" }])).toBe(true);
    expect(
      storedPublicEndpointsNeedCloud([{ domain: "myapp", domainType: undefined as never }]),
    ).toBe(true);
  });

  test("a real custom host does not need Cloud regardless of stale domainType", () => {
    expect(
      storedPublicEndpointsNeedCloud([
        { customDomain: "api.openship.io", domainType: undefined as never },
      ]),
    ).toBe(false);
    expect(
      storedPublicEndpointsNeedCloud([
        { customDomain: "api.openship.io", domainType: "free" as never },
      ]),
    ).toBe(false);
    expect(
      storedPublicEndpointsNeedCloud([
        { domain: "api.openship.io", domainType: undefined as never },
      ]),
    ).toBe(false);
  });

  test("a host under the managed base domain still needs Cloud", () => {
    expect(
      storedPublicEndpointsNeedCloud([
        { customDomain: `myapp.${base}`, domainType: "custom" as never },
      ]),
    ).toBe(true);
  });

  test("mixed endpoints need Cloud only when a managed subdomain is present", () => {
    expect(
      storedPublicEndpointsNeedCloud([
        { customDomain: "api.openship.io", domainType: "custom" },
        { domain: "dash", domainType: "free" },
      ]),
    ).toBe(true);
    expect(
      storedPublicEndpointsNeedCloud([
        { customDomain: "api.openship.io", domainType: "custom" },
        { customDomain: "app.clincai.com", domainType: "custom" },
      ]),
    ).toBe(false);
  });
});
