// Аннотации MCP: у каждого зарегистрированного инструмента есть пометка, читающие помечены readOnlyHint.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { TOOL_ANNOTATIONS, toolAnnotations } from "../../src/utils/tool-annotations.js";

const indexSource = readFileSync(join(__dirname, "../../src/index.ts"), "utf8");
const registered = [...indexSource.matchAll(/server\.tool\(\s*"([^"]+)",/g)].map(match => match[1]);
// Каждый вызов регистрации обязан начинаться с имени-литерала: иначе он выпал бы из сверки выше.
const registrations = indexSource.match(/server\.tool\(/g) ?? [];

describe("tool annotations", () => {
    it("covers every registered tool and nothing else", () => {
        expect(registered.length).toBeGreaterThan(0);
        expect(registered.length).toBe(registrations.length);
        expect([...registered].sort()).toEqual(Object.keys(TOOL_ANNOTATIONS).sort());
    });

    it("passes annotations to every registration", () => {
        const blocks = indexSource.split(/server\.tool\(/).slice(1);
        expect(blocks.length).toBe(registered.length);
        for (const block of blocks) {
            const name = /^\s*"([^"]+)",/.exec(block)?.[1];
            expect(block.split("\n);")[0]).toContain(`toolAnnotations("${name}")`);
        }
    });

    it("marks every APM tool read-only and none destructive", () => {
        for (const name of [
            "list-apm-services",
            "list-apm-transactions",
            "list-apm-errors",
            "list-apm-trace-samples",
            "get-apm-trace",
        ]) {
            expect(toolAnnotations(name).readOnlyHint).toBe(true);
            expect(toolAnnotations(name).destructiveHint).toBeFalsy();
        }
    });

    it("refuses an unknown tool", () => {
        expect(() => toolAnnotations("no-such-tool")).toThrow(/no-such-tool/);
    });
});
