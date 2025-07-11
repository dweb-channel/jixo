import {logger} from "@jixo/mcp-core";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";
import pkg from "../package.json" with {type: "json"};
import {parseCliArgs} from "./cli-parser.js";
import {startServer} from "./server.js";

async function main() {
  const cli = yargs(hideBin(process.argv))
    .scriptName(Object.keys(pkg.bin)[0] ?? "mcp-fs")
    .version(pkg.version)
    .usage("MCP Secure Filesystem Server\n\nUsage: $0 [options] [mount-points...]\n\nMount Point Syntax:\n  [R|W|RW]=/path/to/dir\n  $A=/path/to/dir\n  $B[RW]=/another/path")
    .command(
      "$0 [mount-points...]",
      "Starts the MCP filesystem server with specified mount points.",
      (yargs) => {
        return yargs
          .positional("mount-points", {
            describe: "List of mount points to configure.",
            type: "string",
          })
          .option("readOnly", {
            type: "boolean",
            alias: "R",
            describe: "Globally override all mounts to be read-only. Disables all write operations.",
          })
          .option("log", {
            type: "boolean",
            alias: "L",
            describe: "Enable logging",
          })
          .option("logFile", {
            type: "string",
            describe: "Enable logging to a specified file path",
          });
      },
      async (argv) => {
        try {
          const {mountPoints, readOnly: detectedReadOnly} = parseCliArgs((argv.mountPoints as unknown as string[]) || []);

          if (argv.log || argv.logFile) {
            const logFilename = argv.logFile || `${argv.$0}.log`;
            logger.setEnable(logFilename);
          }

          await startServer(mountPoints, argv.readOnly || detectedReadOnly);
        } catch (error) {
          console.error(`Fatal error: ${(error as Error).message}`);
          process.exit(1);
        }
      },
    )
    .help()
    .alias("help", "h")
    .strict()
    .fail((msg, err) => {
      console.error(msg || err?.message || "An unknown error occurred.");
      if (err) console.error(err.stack);
      process.exit(1);
    })
    .parse();
}

if (import_meta_ponyfill(import.meta).main) {
  main().catch((error) => {
    console.error("An unexpected error occurred:", error);
    process.exit(1);
  });
}
