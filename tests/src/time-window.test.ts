import { parseIso, resolveWindow } from "../../src/utils/time-window.js";

describe("resolveWindow", () => {
    const now = new Date("2026-10-16T12:00:00.000Z");

    it("defaults to the last 15 minutes before now", () => {
        expect(resolveWindow(undefined, undefined, 15, now)).toEqual({
            start: "2026-10-16T11:45:00.000Z",
            end: "2026-10-16T12:00:00.000Z",
        });
    });

    it("counts the default start back from an explicit end", () => {
        expect(resolveWindow(undefined, "2026-10-16T08:00:00Z", 15, now)).toEqual({
            start: "2026-10-16T07:45:00.000Z",
            end: "2026-10-16T08:00:00.000Z",
        });
    });

    it("converts zoned bounds to UTC", () => {
        expect(
            resolveWindow("2026-10-16T11:00:00+03:00", "2026-10-16T11:30:00+03:00", 15, now),
        ).toEqual({
            start: "2026-10-16T08:00:00.000Z",
            end: "2026-10-16T08:30:00.000Z",
        });
    });

    it("rejects start not earlier than end", () => {
        expect(() =>
            resolveWindow("2026-10-16T12:00:00Z", "2026-10-16T12:00:00Z", 15, now),
        ).toThrow("start must be earlier than end");
    });
});

describe("parseIso", () => {
    it("reads a value without a zone as UTC", () => {
        expect(parseIso("2026-10-16T08:00:00").toISOString()).toBe("2026-10-16T08:00:00.000Z");
    });

    it("rejects garbage", () => {
        expect(() => parseIso("yesterday")).toThrow("invalid time: yesterday");
    });
});
