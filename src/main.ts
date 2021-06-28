#!/usr/bin/env node

import fs from "fs";
import prettier from "prettier";

const tsProp = (raw: string) =>
  !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(raw) ? `["${raw}"]` : raw;

export const generateTypeDefinition = (val: unknown): string => {
  switch (typeof val) {
    case "bigint":
    case "boolean":
    case "function":
    case "number":
    case "string":
    case "symbol":
    case "undefined":
      return typeof val;
    case "object":
      if (val === null) {
        return "null";
      }
      if (Array.isArray(val)) {
        if (val.length === 0) {
          console.warn(`Found empty array`);
          return `Array<unknown>`;
        }
        return `Array<${generateTypeDefinition(val[0])}>`;
      }
      const proto = Object.getPrototypeOf(val);
      switch (proto) {
        case Object.prototype:
        case null:
          return [
            "{",
            ...Object.entries(val).map(
              ([prop, val]) =>
                `${tsProp(prop)}: ${generateTypeDefinition(val)};`
            ),
            "}",
          ].join("\n");
        default:
          return proto.constructor.name;
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
      `type MyCustomType = ${generateTypeDefinition(
        JSON.parse(fs.readFileSync(0, "utf-8"))
      )}`,
      { parser: "typescript" }
    )
  );
}
