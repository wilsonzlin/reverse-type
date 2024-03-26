#!/usr/bin/env node

import fs from "fs";
import prettier from "prettier";
import defined from "@xtjs/lib/js/defined";
import UnreachableError from "@xtjs/lib/js/UnreachableError";

const tsProp = (raw: string) =>
  !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(raw) ? JSON.stringify(raw) : raw;

type Simple =
  | "bigint"
  | "boolean"
  | "function"
  | "null"
  | "number"
  | "string"
  | "symbol"
  | "undefined";

type ObjectMembers = Record<string, Type>;

type Type = {
  simples?: Set<Simple>;
  object?: ObjectMembers;
  instanceOf?: Set<string>;
  array?: Type;
};

const UNDEFINED: Type = { simples: new Set(["undefined"]) };

const mergeObjectMembers = (
  a: ObjectMembers | undefined,
  b: ObjectMembers | undefined
): ObjectMembers | undefined => {
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  const merged: Record<string, Type> = {};
  for (const prop of new Set([...aKeys, ...bKeys])) {
    const m = mergeTypes(a[prop] ?? UNDEFINED, b[prop] ?? UNDEFINED);
    if (m) {
      merged[prop] = m;
    }
  }
  return merged;
};

const mergeTypes = (
  a: Type | undefined,
  b: Type | undefined
): Type | undefined => {
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }
  return {
    array: mergeTypes(a.array, b.array),
    instanceOf: new Set([...(a.instanceOf ?? []), ...(b.instanceOf ?? [])]),
    object: mergeObjectMembers(a.object, b.object),
    simples: new Set([...(a.simples ?? []), ...(b.simples ?? [])]),
  };
};

export const determineType = (
  val: unknown,
  arrayStrategy: "first" | "first+last" | "first+mid+last" | "all" = "all"
): Type => {
  const t = typeof val;
  switch (t) {
    case "bigint":
    case "boolean":
    case "function":
    case "number":
    case "string":
    case "symbol":
    case "undefined":
      return { simples: new Set([t]) };
    case "object":
      if (val === null) {
        return { simples: new Set(["null"]) };
      }
      if (Array.isArray(val)) {
        let candidates;
        switch (arrayStrategy) {
          case "first":
            candidates = arrayStrategy.slice(0, 1);
            break;
          case "first+last":
            candidates = [
              ...arrayStrategy.slice(0, 1),
              ...arrayStrategy.slice(-1),
            ];
            break;
          case "first+mid+last":
            candidates = [
              arrayStrategy.at(0),
              arrayStrategy.at(Math.floor(val.length / 2)),
              arrayStrategy.at(-1),
            ].filter(defined);
            break;
          case "all":
            candidates = val;
            break;
          default:
            throw new UnreachableError();
        }
        let elements: Type = {};
        for (const v of candidates) {
          elements = mergeTypes(elements, determineType(v, arrayStrategy))!;
        }
        return { array: elements };
      }
      const proto = Object.getPrototypeOf(val);
      switch (proto) {
        case Object.prototype:
        case null:
          const members = Object.fromEntries(
            Object.entries(val!).map(
              ([prop, val]) => [prop, determineType(val)] as const
            )
          );
          return { object: members };
        default:
          return { instanceOf: new Set([proto.constructor.name]) };
      }
    // Fall through.
    default:
      throw new TypeError(
        `Unrecognised value of type ${typeof val}: ${JSON.stringify(val)}`
      );
  }
};

export const generateTypeDefinition = (t: Type): string => {
  const parts = Array<string>();
  if (t.array) {
    parts.push(`Array<${generateTypeDefinition(t.array)}>`);
  }
  for (const s of t.instanceOf ?? []) {
    parts.push(s);
  }
  for (const s of t.simples ?? []) {
    parts.push(s);
  }
  if (t.object) {
    parts.push(
      [
        "{",
        ...Object.entries(t.object).map(
          ([prop, val]) => `${tsProp(prop)}: ${generateTypeDefinition(val)};`
        ),
        "}",
      ].join("")
    );
  }
  return parts.join(" | ") || "unknown";
};

if (require.main == module) {
  console.log(
    prettier.format(
      `type MyCustomType = ${generateTypeDefinition(
        determineType(JSON.parse(fs.readFileSync(0, "utf-8")))
      )}`,
      { parser: "typescript" }
    )
  );
}
