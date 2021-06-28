#!/usr/bin/env node

import fs from "fs";
import prettier from "prettier";

const tsProp = (raw: string) =>
  !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(raw) ? `["${raw}"]` : raw;

export const generateTypeDefinition = (val: unknown): string => {
  switch (typeof val) {
    case "undefined":
    case "boolean":
    case "number":
    case "string":
    case "function":
    case "symbol":
    case "bigint":
      return typeof val;
    case "object":
      if (val == null) {
        return "null";
      }
      if (Array.isArray(val)) {
        if (val.length == 0) {
          console.warn(`Found empty array`);
          return `Array<unknown>`;
        }
        return `Array<${generateTypeDefinition(val[0])}>`;
      }
      if (Object.getPrototypeOf(val) == Object.prototype) {
        return [
          "{",
          ...Object.entries(val).map(
            ([prop, val]) => `${tsProp(prop)}: ${generateTypeDefinition(val)};`
          ),
          "}",
          "",
        ].join("\n");
      }
    // Fall through.
    default:
      throw new TypeError(
        `Unrecognised value of type ${typeof val}: ${JSON.stringify(val)}`
      );
  }
};

if (require.main == module) {
  console.log(
    prettier.format(
      generateTypeDefinition(JSON.parse(fs.readFileSync(0, "utf-8"))),
      { parser: "typescript" }
    )
  );
}
