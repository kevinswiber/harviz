#!/usr/bin/env node

import { readFileSync } from "fs";
import { Har } from "har-format";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { print } from "./entry";
import { PrintOptions } from "./types";

const argv = yargs(hideBin(process.argv))
  .command(
    "$0 <file>",
    "Visualize HTTP Archive (HAR) files right in your terminal."
  )
  .positional("file", {
    describe: "HAR file to analyze",
    type: "string",
  })
  .option("style", {
    describe: "Style of output",
    choices: ["standard", "compact"] as const,
    default: "standard",
  })
  .version()
  .help()
  .strict().argv as { [key: string]: unknown } & PrintOptions;

const har: Har = JSON.parse(readFileSync(argv.file, "utf8"));

for (const [i, entry] of har.log.entries.entries()) {
  print(i, entry, argv, (output) => console.log(output));
}
