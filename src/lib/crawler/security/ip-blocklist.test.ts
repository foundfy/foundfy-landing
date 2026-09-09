import { describe, expect, it } from "vitest";
import { isBlockedHostname, isBlockedIpAddress } from "./ip-blocklist";

describe("isBlockedIpAddress", () => {
  it("blocks private and loopback IPv4 addresses", () => {
    expect(isBlockedIpAddress("127.0.0.1")).toBe(true);
    expect(isBlockedIpAddress("10.0.0.5")).toBe(true);
    expect(isBlockedIpAddress("192.168.1.10")).toBe(true);
    expect(isBlockedIpAddress("169.254.10.2")).toBe(true);
  });

  it("allows public IPv4 addresses", () => {
    expect(isBlockedIpAddress("8.8.8.8")).toBe(false);
    expect(isBlockedIpAddress("1.1.1.1")).toBe(false);
  });

  it("blocks loopback and unique-local IPv6 addresses", () => {
    expect(isBlockedIpAddress("::1")).toBe(true);
    expect(isBlockedIpAddress("fc00::1")).toBe(true);
  });
});

describe("isBlockedHostname", () => {
  it("blocks localhost and IP literals", () => {
    expect(isBlockedHostname("localhost")).toBe(true);
    expect(isBlockedHostname("app.localhost")).toBe(true);
    expect(isBlockedHostname("127.0.0.1")).toBe(true);
  });

  it("allows regular hostnames", () => {
    expect(isBlockedHostname("foundfy.me")).toBe(false);
    expect(isBlockedHostname("example.com")).toBe(false);
  });
});
