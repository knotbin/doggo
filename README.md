# 🐶 Doggo

> A loyal companion for your documentation journey! Doggo sniffs out undocumented exports in your Deno packages and helps you achieve 100% JSDoc coverage.

```
        __
   (___()'`;
   /,___ /`
   \\"  \\     "Woof! Let's document that code!"
```

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Deno](https://img.shields.io/badge/Deno-1.40+-blue.svg)](https://deno.land)

## 🦴 What is Doggo?

Doggo is a good boy who helps you maintain documentation quality in your Deno projects! This CLI tool analyzes JSDoc documentation coverage of exported/public symbols in Deno packages, making sure every export has proper documentation - because well-documented code is a treat for everyone! 🍖

### 🐾 Key Features

- 🔍 **Sniffs Out Exports** - Automatically detects all exported symbols (functions, classes, interfaces, types, constants, variables, enums)
- 📝 **JSDoc Tracking** - Checks which exports have been properly documented with JSDoc
- 🎯 **Smart Fetch** - When a `deno.json` with `exports` field is found, analyzes only the actual public API (no chasing squirrels!)
- 🏢 **Pack Support** - Analyzes all members in a Deno workspace with aggregate statistics
- 📊 **Detailed Reports** - Get coverage percentages overall and by symbol type
- 🎨 **Pretty Output** - Color-coded terminal output that's easy on the eyes
- ⚡ **Fast & Lightweight** - Built with Deno's standard library (no heavy dependencies to slow us down!)

## 🚀 Quick Start

### Fetch the ball... I mean, analyze your code!

```bash
# Let Doggo analyze the current directory
deno run --allow-read https://deno.land/x/doggo/main.ts

# Point Doggo to a specific directory
deno run --allow-read https://deno.land/x/doggo/main.ts ./src

# Analyze a single file
deno run --allow-read https://deno.land/x/doggo/main.ts ./src/module.ts
```

### 🏠 Train Doggo (Install)

```bash
# Install Doggo as a good boy on your system
deno install --allow-read -n doggo https://deno.land/x/doggo/main.ts

# Now you can call Doggo anytime!
doggo
doggo ./src
doggo --help
```

### 🎾 Workspace Mode

```bash
# Doggo automatically detects workspace configuration
doggo

# Force workspace mode
doggo --workspace
```

### 🦴 Using with Deno Tasks

Add to your `deno.json`:
```json
{
  "tasks": {
    "doc:check": "doggo",
    "doc:check:workspace": "doggo --workspace"
  }
}
```

Then run:
```bash
deno task doc:check
```

## 🐕 Commands & Options

```
Doggo - JSDoc Coverage Analyzer for Good Boys and Girls

Usage:
  doggo [options] [path]

Options:
  -h, --help      Show help (Doggo does tricks!)
  -v, --version   Show version (Doggo's age in dog years)
  -p, --path      Path to analyze (where should Doggo sniff?)
  -w, --workspace Force workspace mode (analyze the whole pack!)

Examples:
  doggo                           # Analyze current directory
  doggo ./src                     # Analyze specific directory
  doggo ./src/module.ts          # Analyze single file
  doggo --workspace              # Analyze all workspace members
```

## 🎯 What Doggo Analyzes

### 🏢 Workspace Mode (The Pack)
When Doggo finds a `workspace` field in `deno.json`:
- Analyzes each pack member individually
- Provides per-member documentation statistics
- Shows aggregate statistics for the entire pack
- Barks at members that need documentation improvements

### 🎯 Smart Mode (Following the Scent)
When a `deno.json` or `deno.jsonc` file with an `exports` field is found:
- Traces the actual public API from the entry point(s)
- Only analyzes symbols that users actually see
- Ignores internal implementation (no digging in the backyard!)
- Provides accurate coverage for your public API

### 🔍 Full Analysis Mode (Sniffing Everything)
When no `deno.json` with exports is found:
- Analyzes all exported symbols in the codebase
- Comprehensive coverage reporting
- Great for internal packages or during development

### 📦 Supported Exports

Doggo can detect and analyze:
- **Functions** - Regular functions, async functions, arrow functions
- **Classes** - Class declarations with their methods
- **Interfaces** - TypeScript interface definitions
- **Types** - Type aliases and type definitions
- **Constants** - Exported const declarations
- **Variables** - Exported let/var declarations
- **Enums** - TypeScript enum definitions
- **Default Exports** - Default exported symbols

### 🚫 What Doggo Ignores

Good boys know not to dig in:
- `node_modules/` directory
- `.git/` directory
- `dist/`, `build/`, `coverage/` directories
- Test files (`*.test.*`, `*.spec.*`, `test/`, `tests/`, `*_test.*`)

## 🎨 Example Output

### Single Package (Good Boy Mode)
```
🐶 Analyzing Deno Package Documentation Coverage

Path: /path/to/your/package

Found deno.json with exports: ./mod.ts

Sniffing out public API from export entry points...

📝 Undocumented Exports (Doggo found these!):

  src/utils.ts:
    ✗ formatDate [function]:67

  mod.ts:
    ✗ LogLevel [type]:45

📊 Documentation Coverage Summary

──────────────────────────────────────────────────
  Total Exports:     8
  Documented:        6
  Undocumented:      2
  Coverage:          75%
──────────────────────────────────────────────────

  📈 Documentation needs improvement (Doggo wants treats!)
```

### Workspace Analysis (Pack Report)
```
🏢 Analyzing Deno Workspace (The Pack!)

Root: /path/to/workspace
Members: 3

🐕 Analyzing common...
  ⚡ common                10 exports, 60% documented
    └─ Entry: ./mod.ts

🐕 Analyzing bytes...
  ✗ bytes                 14 exports, 50% documented
    └─ Entry: ./mod.ts

📊 Pack Summary
────────────────────────────────────────────────────────────
  Overall Statistics:
    Total Members:     3
    Total Exports:     37
    Documented:        20
    Coverage:          54%

  ⚠️  Pack members needing training:
    - bytes (50%)

  ⚠️  The pack needs better documentation!
```

## 🏆 Coverage Indicators

Doggo's tail wags differently based on your coverage:

- 🏆 **100%** - Perfect! Doggo is doing zoomies!
- ✨ **90-99%** - Excellent! Tail wagging intensifies!
- 👍 **80-89%** - Good boy! Happy tail wags
- 📈 **60-79%** - Needs improvement (Doggo is concerned)
- ⚠️ **40-59%** - Poor coverage (Sad puppy eyes)
- 🚨 **0-39%** - Critical! (Doggo is hiding under the bed)

## 💡 JSDoc Examples

### ✅ Good Boy (Documented)
```typescript
/**
 * Calculates the number of dog treats needed.
 * @param dogs The number of dogs
 * @param treatsPerDog Treats each dog should get
 * @returns Total number of treats needed
 */
export function calculateTreats(dogs: number, treatsPerDog: number): number {
  return dogs * treatsPerDog;
}
```

### ❌ Bad Boy (Needs Documentation)
```typescript
export function calculateTreats(dogs: number, treatsPerDog: number): number {
  return dogs * treatsPerDog;
}
```

## 🔧 How Doggo Works

### When sniffing a workspace:
1. **Detect Pack** - Reads `deno.json` to find workspace members
2. **Analyze Each Member** - Individually checks each pack member
3. **Aggregate Results** - Combines statistics across all members
4. **Generate Report** - Shows both individual and pack-wide metrics

### When following an exports scent:
1. **Load Configuration** - Reads `deno.json` to find the `exports` field
2. **Trace Public API** - Follows all re-exports and direct exports
3. **Symbol Resolution** - Tracks `export { ... } from` statements
4. **JSDoc Detection** - Checks for JSDoc comments on source definitions
5. **Report Generation** - Shows only public API symbols

### When sniffing everything:
1. **File Discovery** - Recursively finds all source files
2. **Export Detection** - Identifies all exported symbols
3. **JSDoc Detection** - Checks for JSDoc comments above exports
4. **Statistics Calculation** - Computes coverage percentages
5. **Report Generation** - Outputs formatted report

## 🦴 Configuration

### Working with deno.json

Doggo automatically detects your configuration:

```json
{
  "name": "@your-org/package",
  "version": "1.0.0",
  "exports": "./mod.ts"
}
```

When an `exports` field is present, Doggo only analyzes symbols exported through that entry point.

### Working with Workspaces

For multi-package repositories:

```json
{
  "workspace": [
    "packages/core",
    "packages/utils",
    "packages/cli"
  ]
}
```

Doggo will analyze each member independently and provide aggregate statistics.

## 🐾 Tips & Tricks

1. **Start with exports** - Use `deno.json` exports field to focus on your public API
2. **Document as you code** - It's easier to document while the code is fresh
3. **Use meaningful descriptions** - Help users understand not just what, but why
4. **Include examples** - Show how to use your functions
5. **Check regularly** - Add Doggo to your CI/CD pipeline

## 🤝 Contributing

Doggo loves new friends! Feel free to:
- Report bugs (Doggo doesn't like fleas!)
- Suggest new features (Teach Doggo new tricks!)
- Submit pull requests (Bring treats!)
- Improve documentation (Help Doggo communicate better!)

## 📄 License

MIT License - Doggo is free to roam and play!

## 🙏 Acknowledgments

- Built with ❤️ and 🦴 for the Deno community
- Inspired by good boys and girls everywhere
- Special thanks to all contributors who helped train Doggo

## 🐕 Why "Doggo"?

Because good dogs always document their code! Plus, who doesn't love a coding companion that:
- Never judges your code (only helps improve it)
- Is always excited to help
- Loyally guards your documentation quality
- Makes coding more fun!

---

*Woof! Happy documenting!* 🐶

**Remember:** A well-documented codebase is like a well-trained dog - everyone loves playing with it!
