/**
 * 🐶 Doggo - JSDoc Coverage Analyzer for Deno
 *
 * A loyal companion for your documentation journey! Doggo sniffs out undocumented
 * exports in your Deno packages and helps you achieve 100% JSDoc coverage.
 *
 * @module
 *
 * @example Install Doggo
 * ```bash
 * deno install --global --allow-read jsr:@knotbin/doggo --name doggo
 * ```
 *
 * @example Usage
 * ```bash
 * # Run Doggo in the current directory
 * doggo
 * # Run Doggo in a specific directory
 * doggo /path/to/directory
 * # Run Doggo for a specific file
 * doggo /path/to/file.ts
 * ```
 */

import { parseArgs } from "@std/cli";
import { join, resolve } from "@std/path";
import { bold, cyan, gray, green, red, yellow } from "@std/fmt/colors";
import {
  analyzeDirectory,
  type DocumentationStats,
  type ExportedSymbol,
} from "./core.ts";

class JSDocAnalyzer {
  private rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = resolve(rootPath);
  }

  async analyze(): Promise<void> {
    console.log(
      cyan(bold("\n🐶 Doggo is analyzing your documentation coverage!\n")),
    );
    console.log(gray(`Path: ${this.rootPath}\n`));

    // Use core module for analysis
    const result = await analyzeDirectory(this.rootPath);

    if (result.hasDenoJson && result.hasExports) {
      console.log(gray(`Found deno.json with exports: ${result.exportPath}\n`));
      console.log(
        cyan("Sniffing out public API from export entry points...\n"),
      );
    }

    // Output results
    this.outputResults(result.symbols, result.stats);
  }

  private outputResults(
    symbols: ExportedSymbol[],
    stats: DocumentationStats,
  ): void {
    if (symbols.length === 0) {
      console.log(yellow("Woof! No exported symbols found. 🦴"));
      return;
    }

    // Output undocumented symbols
    const undocumented = symbols.filter((s) => !s.hasJSDoc);

    if (undocumented.length > 0) {
      console.log(red(bold("📝 Undocumented Exports (Doggo found these!):\n")));

      // Group by file
      const byFile = new Map<string, ExportedSymbol[]>();
      for (const symbol of undocumented) {
        if (!byFile.has(symbol.file)) {
          byFile.set(symbol.file, []);
        }
        byFile.get(symbol.file)!.push(symbol);
      }

      // Output by file
      for (const [file, symbols] of byFile.entries()) {
        console.log(yellow(`  ${file}:`));
        for (const symbol of symbols.sort((a, b) => a.line - b.line)) {
          const typeLabel = gray(`[${symbol.type}]`);
          const lineNum = gray(`:${symbol.line}`);
          console.log(`    ${red("✗")} ${symbol.name} ${typeLabel}${lineNum}`);
        }
        console.log();
      }
    } else {
      console.log(
        green(bold("✨ Good boy! All exported symbols are documented!\n")),
      );
    }

    // Output summary
    this.outputSummary(stats);
  }

  private outputSummary(stats: DocumentationStats): void {
    console.log(bold(cyan("📊 Documentation Coverage Summary\n")));
    console.log(gray("─".repeat(50)));

    // Overall stats
    const percentageColor = stats.percentage >= 80
      ? green
      : stats.percentage >= 60
      ? yellow
      : red;

    console.log(`  Total Exports:     ${bold(stats.total.toString())}`);
    console.log(`  Documented:        ${green(stats.documented.toString())}`);
    console.log(`  Undocumented:      ${red(stats.undocumented.toString())}`);
    console.log(
      `  Coverage:          ${percentageColor(bold(`${stats.percentage}%`))}`,
    );

    // Stats by type
    if (Object.keys(stats.byType).length > 0) {
      console.log(gray("─".repeat(50)));
      console.log(bold("\n  Coverage by Type:\n"));

      for (const [type, typeStats] of Object.entries(stats.byType)) {
        const percentage = typeStats.total > 0
          ? Math.round((typeStats.documented / typeStats.total) * 100)
          : 100;
        const percentageColor = percentage >= 80
          ? green
          : percentage >= 60
          ? yellow
          : red;

        const typeLabel = type.padEnd(12);
        const statsStr = `${typeStats.documented}/${typeStats.total}`.padEnd(7);
        console.log(
          `    ${typeLabel} ${statsStr} ${percentageColor(`${percentage}%`)}`,
        );
      }
    }

    console.log(gray("─".repeat(50)));

    // Coverage indicator
    const indicator = this.getCoverageIndicator(stats.percentage);
    console.log(`\n  ${indicator}`);
  }

  private getCoverageIndicator(percentage: number): string {
    if (percentage === 100) {
      return green("🏆 Perfect! Doggo is doing zoomies!");
    } else if (percentage >= 90) {
      return green("✨ Excellent! Tail wagging intensifies!");
    } else if (percentage >= 80) {
      return green("👍 Good boy! Happy tail wags");
    } else if (percentage >= 60) {
      return yellow("📈 Doggo needs more treats (documentation)");
    } else if (percentage >= 40) {
      return red("⚠️  Poor coverage (Sad puppy eyes)");
    } else {
      return red("🚨 Critical! Doggo is hiding under the bed");
    }
  }
}

// Main CLI
async function main() {
  const args = parseArgs(Deno.args, {
    string: ["path"],
    boolean: ["help", "version", "workspace"],
    alias: {
      h: "help",
      v: "version",
      p: "path",
      w: "workspace",
    },
    default: {
      path: ".",
    },
  });

  if (args.help) {
    console.log(`
 ${bold("🐶 Doggo - The Doc Sniffing Dog")}

 A loyal companion for your documentation journey! Doggo sniffs out undocumented
 exports in your Deno packages and helps you achieve 100% JSDoc coverage.

        __
   (___()'${"`"};
   /,___ /${"`"}
   ${"\\\\"}   ${"\\\\"}   Woof! Let's document that code!

 ${bold("Usage:")}
   doggo [options] [path]

 ${bold("Options:")}
   -h, --help      Show help (Doggo does tricks!)
   -v, --version   Show version (Doggo's age in dog years)
   -p, --path      Path to analyze (where should Doggo sniff?)
   -w, --workspace Force workspace mode (analyze the whole pack!)

 ${bold("Examples:")}
   doggo                           # Analyze current directory
   doggo ./src                     # Analyze specific directory
   doggo ./src/module.ts          # Analyze single file
   doggo --workspace              # Analyze all workspace members

 ${bold("Notes:")}
   🦴 If a workspace configuration is found, analyzes all pack members
   🎯 If a deno.json 'exports' field is found, analyzes only the public API
   🔍 Otherwise, sniffs out all exported symbols in the codebase

 ${bold("Remember:")} A well-documented codebase is like a well-trained dog -
 everyone loves working with it!
 `);
    Deno.exit(0);
  }

  if (args.version) {
    console.log("🐶 Doggo - The goodest documentation boy!");
    Deno.exit(0);
  }

  // Get path from positional argument or --path flag
  const targetPath = args._[0]?.toString() || args.path;

  try {
    // Check if we should try workspace mode
    const workspaceConfigPath = join(resolve(targetPath), "deno.json");
    const workspaceConfigPathJsonc = join(resolve(targetPath), "deno.jsonc");

    let hasWorkspace = false;

    // Check for workspace configuration
    try {
      const content = await Deno.readTextFile(workspaceConfigPath);
      const config = JSON.parse(content);
      hasWorkspace = !!config.workspace;
    } catch {
      // Try deno.jsonc
      try {
        const content = await Deno.readTextFile(workspaceConfigPathJsonc);
        // Simple JSONC parsing
        const jsonContent = content
          .split("\n")
          .map((line) => {
            const commentIndex = line.indexOf("//");
            return commentIndex > -1 ? line.slice(0, commentIndex) : line;
          })
          .join("\n")
          .replace(/\/\*[\s\S]*?\*\//g, "");
        const config = JSON.parse(jsonContent);
        hasWorkspace = !!config.workspace;
      } catch {
        // No workspace config found
      }
    }

    // Use workspace analyzer if workspace found or forced
    if (hasWorkspace || args.workspace) {
      const { WorkspaceAnalyzer } = await import("./workspace.ts");
      const workspaceAnalyzer = new WorkspaceAnalyzer(targetPath);
      const report = await workspaceAnalyzer.analyze();

      if (!report && args.workspace) {
        console.log(yellow("\n⚠️  Woof! No workspace configuration found."));
        console.log(
          gray(
            "Doggo was looking for 'workspace' field in deno.json or deno.jsonc\n",
          ),
        );
        Deno.exit(1);
      }
    } else {
      // Regular single-package analysis
      const analyzer = new JSDocAnalyzer(targetPath);
      await analyzer.analyze();
    }
  } catch (error) {
    console.error(red(`Error: ${error}`));
    Deno.exit(1);
  }
}

// Export for use in workspace.ts
export { JSDocAnalyzer };

if (import.meta.main) {
  await main();
}
