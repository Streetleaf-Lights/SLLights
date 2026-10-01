import { describe, expect, it } from "vitest";
import { base64UrlToBytes, decodeJwtPayload, utf8Decode } from "../jwt";
import { makeToken } from "./helpers";

describe("base64UrlToBytes", () => {
  it("decodes unpadded base64url, including - and _ characters", () => {
    // 0xfb 0xff 0xbf encodes to "-_-_" in base64url ("+/+/" in base64).
    expect([...base64UrlToBytes("-_-_")]).toEqual([0xfb, 0xff, 0xbf]);
  });

  it("accepts padded input and standard base64 characters", () => {
    expect([...base64UrlToBytes("aGk=")]).toEqual([104, 105]);
    expect([...base64UrlToBytes("+/+/")]).toEqual([0xfb, 0xff, 0xbf]);
  });

  it("rejects invalid characters and impossible lengths", () => {
    expect(() => base64UrlToBytes("ab$d")).toThrow();
    expect(() => base64UrlToBytes("abcde")).toThrow();
  });
});

describe("utf8Decode", () => {
  it("decodes 1- to 4-byte sequences", () => {
    const text = "Pole Ñ 街灯 💡";
    expect(utf8Decode(new TextEncoder().encode(text))).toBe(text);
  });

  it("rejects malformed sequences", () => {
    expect(() => utf8Decode(Uint8Array.from([0xe2, 0x28, 0xa1]))).toThrow();
    expect(() => utf8Decode(Uint8Array.from([0xc3]))).toThrow();
    expect(() => utf8Decode(Uint8Array.from([0xff]))).toThrow();
  });
});

describe("decodeJwtPayload", () => {
  it("returns the payload object", () => {
    expect(decodeJwtPayload(makeToken({ sub: "u1", name: "Nguyễn" }))).toEqual({
      sub: "u1",
      name: "Nguyễn",
    });
  });

  it("returns null for anything that isn't a three-part token with an object payload", () => {
    expect(decodeJwtPayload("not-a-token")).toBeNull();
    expect(decodeJwtPayload("a.b")).toBeNull();
    expect(decodeJwtPayload("a.!!!.c")).toBeNull();
    expect(decodeJwtPayload(makeToken([1, 2]))).toBeNull();
    expect(decodeJwtPayload(makeToken("text"))).toBeNull();
    expect(decodeJwtPayload(makeToken(null))).toBeNull();
  });
});
