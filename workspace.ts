import { bold, cyan, gray, green, red, yellow } from "@std/fmt/colors";
import { join, resolve } from "@std/path";
import { analyzeDirectory } from "./core.ts";

interface WorkspaceConfig {
  workspace?: string[];
  imports?: Record<string, string>;
}

interface WorkspaceMemberStats {
  name: string;
  path: string;
  hasDenoJson: boolean;
  hasExports: boolean;
  exportPath?: string;
  stats: {
    total: number;
    documented: number;
    undocumented: number;
    percentage: number;
  };
  byType?: Record<string, { total: number; documented: number }>;
}

interface WorkspaceReport {
  members: WorkspaceMemberStats[];
  aggregate: {
    totalMembers: number;
    totalExports: number;
    totalDocumented: number;
    totalUndocumented: number;
    averagePercentage: number;
  };
}

/**
 * Analyzer for Deno workspace configurations.
 *
 * The WorkspaceAnalyzer helps Doggo analyze multi-package repositories
 * by examining each workspace member individually and providing both
 * individual and aggregate documentation coverage statistics.
 *
 * @example
 * ```typescript
 * import { WorkspaceAnalyzer } from "@doggo/cli";
 *
 * const analyzer = new WorkspaceAnalyzer("./my-workspace");
 * const report = await analyzer.analyze();
 *
 * if (report) {
 *   console.log(`Total coverage: ${report.aggregate.averagePercentage}%`);
 *   console.log(`Pack members: ${report.members.length}`);
 * }
 * ```
 */
export class WorkspaceAnalyzer {
  private rootPath: string;
  private workspaceConfig: WorkspaceConfig | null = null;

  constructor(rootPath: string = ".") {
    this.rootPath = resolve(rootPath);
  }

  async analyze(): Promise<WorkspaceReport | null> {
    // Load workspace configuration
    this.workspaceConfig = await this.loadWorkspaceConfig();

    if (!this.workspaceConfig?.workspace) {
      return null;
    }

    console.log(cyan(bold("\n🏢 Doggo is analyzing the pack!\n")));
    console.log(gray(`Root: ${this.rootPath}`));
    console.log(
      gray(`Pack members: ${this.workspaceConfig.workspace.length}\n`),
    );

    const members: WorkspaceMemberStats[] = [];

    // Analyze each workspace member
    for (const memberPath of this.workspaceConfig.workspace) {
      const fullPath = join(this.rootPath, memberPath);
      console.log(cyan(`\n🐕 Sniffing ${bold(memberPath)}...`));

      try {
        const stats = await this.analyzeMember(fullPath, memberPath);
        members.push(stats);

        // Output brief summary for this member
        this.outputMemberSummary(stats);
      } catch (error) {
        console.error(red(`  ✗ Doggo couldn't sniff ${memberPath}: ${error}`));
        // Add failed member with zero stats
        members.push({
          name: memberPath,
          path: fullPath,
          hasDenoJson: false,
          hasExports: false,
          stats: {
            total: 0,
            documented: 0,
            undocumented: 0,
            percentage: 0,
          },
        });
      }
    }

    // Calculate aggregate statistics
    const aggregate = this.calculateAggregate(members);
    const report: WorkspaceReport = { members, aggregate };

    // Output workspace summary
    this.outputWorkspaceSummary(report);

    return report;
  }

  private async loadWorkspaceConfig(): Promise<WorkspaceConfig | null> {
    // Try deno.json first
    const denoJsonPath = join(this.rootPath, "deno.json");
    try {
      const content = await Deno.readTextFile(denoJsonPath);
      const config = JSON.parse(content) as WorkspaceConfig;
      if (config.workspace) {
        console.log(gray(`Found workspace configuration in deno.json`));
        return config;
      }
    } catch {
      // Not found or parse error
    }

    // Try deno.jsonc
    const denoJsoncPath = join(this.rootPath, "deno.jsonc");
    try {
      const content = await Deno.readTextFile(denoJsoncPath);
      // Simple JSONC parsing - remove comments
      const jsonContent = content
        .split("\n")
        .map((line) => {
          const commentIndex = line.indexOf("//");
          return commentIndex > -1 ? line.slice(0, commentIndex) : line;
        })
        .join("\n")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      const config = JSON.parse(jsonContent) as WorkspaceConfig;
      if (config.workspace) {
        console.log(gray(`Found workspace configuration in deno.jsonc`));
        return config;
      }
    } catch {
      // Not found or parse error
    }

    return null;
  }

  private async analyzeMember(
    memberPath: string,
    memberName: string,
  ): Promise<WorkspaceMemberStats> {
    // Use the core module to analyze the member
    const result = await analyzeDirectory(memberPath);

    return {
      name: memberName,
      path: memberPath,
      hasDenoJson: result.hasDenoJson,
      hasExports: result.hasExports,
      exportPath: result.exportPath,
      stats: {
        total: result.stats.total,
        documented: result.stats.documented,
        undocumented: result.stats.undocumented,
        percentage: result.stats.percentage,
      },
      byType: result.stats.byType,
    };
  }

  private outputMemberSummary(stats: WorkspaceMemberStats): void {
    const { name, hasExports, exportPath, stats: s } = stats;

    const percentageColor = s.percentage >= 80
      ? green
      : s.percentage >= 60
      ? yellow
      : red;

    const indicator = s.percentage >= 80
      ? "✓"
      : s.percentage >= 60
      ? "⚡"
      : "✗";
    const indicatorColor = s.percentage >= 80
      ? green
      : s.percentage >= 60
      ? yellow
      : red;

    console.log(
      `  ${indicatorColor(indicator)} ${name.padEnd(20)} ${
        s.total.toString().padStart(3)
      } exports, ${percentageColor(bold(`${s.percentage}%`))} documented`,
    );

    if (hasExports && exportPath) {
      console.log(gray(`    └─ Entry: ${exportPath}`));
    }
  }

  private calculateAggregate(
    members: WorkspaceMemberStats[],
  ): WorkspaceReport["aggregate"] {
    const totalMembers = members.length;
    const totalExports = members.reduce((sum, m) => sum + m.stats.total, 0);
    const totalDocumented = members.reduce(
      (sum, m) => sum + m.stats.documented,
      0,
    );
    const totalUndocumented = members.reduce(
      (sum, m) => sum + m.stats.undocumented,
      0,
    );

    // Calculate weighted average percentage
    const averagePercentage = totalExports > 0
      ? Math.round((totalDocumented / totalExports) * 100)
      : 0;

    return {
      totalMembers,
      totalExports,
      totalDocumented,
      totalUndocumented,
      averagePercentage,
    };
  }

  private outputWorkspaceSummary(report: WorkspaceReport): void {
    const { members, aggregate } = report;

    console.log("\n" + cyan(bold("📊 Pack Summary")));
    console.log(gray("─".repeat(60)));

    // Overall stats
    console.log(`\n  ${bold("Pack Statistics:")}`);
    console.log(
      `    Pack Members:      ${bold(aggregate.totalMembers.toString())}`,
    );
    console.log(
      `    Total Exports:     ${bold(aggregate.totalExports.toString())}`,
    );
    console.log(
      `    Documented:        ${green(aggregate.totalDocumented.toString())}`,
    );
    console.log(
      `    Undocumented:      ${red(aggregate.totalUndocumented.toString())}`,
    );

    const percentageColor = aggregate.averagePercentage >= 80
      ? green
      : aggregate.averagePercentage >= 60
      ? yellow
      : red;
    console.log(
      `    Coverage:          ${
        percentageColor(bold(`${aggregate.averagePercentage}%`))
      }`,
    );

    // Member breakdown table
    console.log(`\n  ${bold("Member Breakdown:")}\n`);
    console.log(gray("    " + "─".repeat(56)));
    console.log(
      gray("    │") + " Member".padEnd(20) + gray("│") + " Exports " +
        gray("│") + " Documented " + gray("│") + " Coverage " + gray("│"),
    );
    console.log(gray("    " + "─".repeat(56)));

    // Sort members by coverage percentage
    const sortedMembers = [...members].sort((a, b) =>
      b.stats.percentage - a.stats.percentage
    );

    for (const member of sortedMembers) {
      const percentageColor = member.stats.percentage >= 80
        ? green
        : member.stats.percentage >= 60
        ? yellow
        : red;

      const name = member.name.length > 18
        ? member.name.substring(0, 15) + "..."
        : member.name;

      console.log(
        gray("    │") +
          ` ${name.padEnd(18)} ` +
          gray("│") +
          ` ${member.stats.total.toString().padStart(7)} ` +
          gray("│") +
          ` ${member.stats.documented.toString().padStart(10)} ` +
          gray("│") +
          ` ${
            percentageColor(
              member.stats.percentage.toString().padStart(7) + "%",
            )
          } ` +
          gray("│"),
      );
    }
    console.log(gray("    " + "─".repeat(56)));

    // Identify members needing attention
    const needsWork = members.filter((m) => m.stats.percentage < 60);
    const goodCoverage = members.filter((m) => m.stats.percentage >= 80);

    if (needsWork.length > 0) {
      console.log(`\n  ${red("⚠️  Pack members needing training:")}`);
      for (const member of needsWork) {
        console.log(`    - ${member.name} (${member.stats.percentage}%)`);
      }
    }

    if (goodCoverage.length > 0) {
      console.log(`\n  ${green("✨ Kibble-worthy pups:")}`);
      for (const member of goodCoverage) {
        if (member.stats.percentage === 100) {
          console.log(`    - ${member.name} ${green("(best in show!)")}`);
        } else {
          console.log(`    - ${member.name} (${member.stats.percentage}%)`);
        }
      }
    }

    // Final indicator
    const indicator = this.getWorkspaceIndicator(aggregate.averagePercentage);
    console.log(`\n  ${indicator}\n`);
  }

  private getWorkspaceIndicator(percentage: number): string {
    if (percentage === 100) {
      return green("🏆 Perfect! The whole pack is doing zoomies!");
    } else if (percentage >= 90) {
      return green("✨ Excellent! The pack's tails are wagging!");
    } else if (percentage >= 80) {
      return green("👍 Good pack! Happy woofs all around");
    } else if (percentage >= 60) {
      return yellow("📈 The pack needs more training (and treats)");
    } else if (percentage >= 40) {
      return red("⚠️  Poor pack coverage (Collective sad puppy eyes)");
    } else {
      return red("🚨 Critical! The whole pack is hiding");
    }
  }
}

// CLI entry point
async function main() {
  const analyzer = new WorkspaceAnalyzer();
  const report = await analyzer.analyze();

  if (!report) {
    console.log(yellow("\n⚠️  Woof! No pack configuration found."));
    console.log(
      gray(
        "Doggo was looking for 'workspace' field in deno.json or deno.jsonc\n",
      ),
    );
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
