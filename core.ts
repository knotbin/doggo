/**
 * Core module for JSDoc coverage analysis
 * @module
 */

import { walk } from "@std/fs";
import { dirname, join, relative, resolve } from "@std/path";

export interface ExportedSymbol {
  name: string;
  type:
    | "function"
    | "class"
    | "interface"
    | "type"
    | "const"
    | "variable"
    | "enum";
  file: string;
  line: number;
  hasJSDoc: boolean;
  jsDocContent?: string;
  exportType: "named" | "default";
}

export interface DocumentationStats {
  total: number;
  documented: number;
  undocumented: number;
  percentage: number;
  byType: Record<string, { total: number; documented: number }>;
}

export interface AnalysisResult {
  path: string;
  hasDenoJson: boolean;
  hasExports: boolean;
  exportPath?: string;
  symbols: ExportedSymbol[];
  stats: DocumentationStats;
}

interface DenoConfig {
  exports?: string | Record<string, string>;
  name?: string;
  version?: string;
}

interface TracedExport {
  originalName: string;
  exportedName: string;
  sourcePath: string;
  line: number;
}

/**
 * Analyzes a directory or file for JSDoc coverage.
 * @param targetPath The path to analyze
 * @returns Analysis results including symbols and statistics
 */
export async function analyzeDirectory(
  targetPath: string,
): Promise<AnalysisResult> {
  const rootPath = resolve(targetPath);
  const symbols: ExportedSymbol[] = [];
  const analyzedFiles = new Set<string>();
  const exportMap = new Map<string, TracedExport[]>();

  // Check for deno.json
  const denoConfig = await loadDenoConfig(rootPath);
  const hasDenoJson = denoConfig !== null;
  const hasExports = !!(denoConfig?.exports);
  const exportPath = typeof denoConfig?.exports === "string"
    ? denoConfig.exports
    : denoConfig?.exports
    ? Object.values(denoConfig.exports)[0]
    : undefined;

  if (denoConfig?.exports) {
    // Use exports field as entry point
    await analyzeFromExports(
      rootPath,
      denoConfig.exports,
      symbols,
      analyzedFiles,
      exportMap,
    );
  } else {
    // Fall back to analyzing all files
    await analyzeAllFiles(rootPath, symbols);
  }

  // Calculate statistics
  const stats = calculateStats(symbols);

  return {
    path: rootPath,
    hasDenoJson,
    hasExports,
    exportPath,
    symbols,
    stats,
  };
}

async function loadDenoConfig(rootPath: string): Promise<DenoConfig | null> {
  // Check if rootPath is a file
  const stat = await Deno.stat(rootPath);
  if (stat.isFile) {
    // If analyzing a single file, check parent directory for deno.json
    rootPath = dirname(rootPath);
  }

  const configPath = join(rootPath, "deno.json");
  try {
    const configContent = await Deno.readTextFile(configPath);
    const config = JSON.parse(configContent) as DenoConfig;
    return config;
  } catch {
    // Try deno.jsonc
    const configPathJsonc = join(rootPath, "deno.jsonc");
    try {
      const configContent = await Deno.readTextFile(configPathJsonc);
      // Simple JSONC parsing - remove comments
      const jsonContent = configContent
        .split("\n")
        .map((line) => {
          const commentIndex = line.indexOf("//");
          return commentIndex > -1 ? line.slice(0, commentIndex) : line;
        })
        .join("\n")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      const config = JSON.parse(jsonContent) as DenoConfig;
      return config;
    } catch {
      return null;
    }
  }
}

async function analyzeFromExports(
  rootPath: string,
  exports: string | Record<string, string>,
  symbols: ExportedSymbol[],
  analyzedFiles: Set<string>,
  exportMap: Map<string, TracedExport[]>,
): Promise<void> {
  // Handle string or object exports
  const exportPaths: string[] = [];

  if (typeof exports === "string") {
    exportPaths.push(exports);
  } else {
    // For object exports, analyze all export paths
    exportPaths.push(...Object.values(exports));
  }

  for (const exportPath of exportPaths) {
    const fullPath = join(rootPath, exportPath);
    await traceExportsFromFile(
      fullPath,
      analyzedFiles,
      exportMap,
      rootPath,
    );
  }

  // Now analyze JSDoc for all traced symbols
  // Collect all unique exports by their source to avoid duplicates
  const uniqueExports = new Map<string, TracedExport>();
  for (const [_filePath, exports] of exportMap.entries()) {
    for (const exp of exports) {
      const key = `${exp.sourcePath}:${exp.originalName}:${exp.exportedName}`;
      if (!uniqueExports.has(key)) {
        uniqueExports.set(key, exp);
      }
    }
  }

  // Analyze only unique exports
  await analyzeFileForJSDoc(
    Array.from(uniqueExports.values()),
    symbols,
    rootPath,
  );
}

async function traceExportsFromFile(
  filePath: string,
  analyzedFiles: Set<string>,
  exportMap: Map<string, TracedExport[]>,
  rootPath: string,
): Promise<void> {
  if (analyzedFiles.has(filePath)) {
    return;
  }
  analyzedFiles.add(filePath);

  try {
    const content = await Deno.readTextFile(filePath);
    const lines = content.split("\n");
    const currentDir = dirname(filePath);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Handle re-exports: export * from "./module.ts" or export { ... } from "./module.ts" or export type { ... } from "./module.ts"
      if (
        trimmed.startsWith("export *") || trimmed.startsWith("export {") ||
        trimmed.startsWith("export type {")
      ) {
        const fromMatch = trimmed.match(/from\s+["']([^"']+)["']/);
        if (fromMatch) {
          // Re-export with from clause
          const importPath = fromMatch[1];
          const resolvedPath = await resolveImportPath(importPath, currentDir);
          if (resolvedPath) {
            // If it's export *, we need to find all exports from that file
            if (trimmed.startsWith("export *")) {
              // For export *, we need to recursively trace that file
              await traceExportsFromFile(
                resolvedPath,
                analyzedFiles,
                exportMap,
                rootPath,
              );
              // Copy all exports from that file
              const sourceExports = exportMap.get(resolvedPath) || [];
              for (const exp of sourceExports) {
                addExport(exportMap, filePath, {
                  ...exp,
                  exportedName: exp.exportedName,
                });
              }
            } else {
              // Handle selective re-exports: export { a, b as c } from "./module" or export type { ... } from "./module"
              const exportsMatch = trimmed.match(
                /export\s*(?:type\s+)?{\s*([^}]+)\s*}/,
              );
              if (exportsMatch) {
                const exportsList = exportsMatch[1].split(",").map((e) =>
                  e.trim()
                );

                // For selective exports, only track the specific symbols
                for (const exportItem of exportsList) {
                  const [originalName, exportedName] = exportItem
                    .split(/\s+as\s+/)
                    .map((s) => s.trim());

                  // Find the line number in the source file where this symbol is defined
                  const lineNum = await findSymbolInFile(
                    resolvedPath,
                    originalName,
                  );

                  addExport(exportMap, filePath, {
                    originalName,
                    exportedName: exportedName || originalName,
                    sourcePath: resolvedPath,
                    line: lineNum || i + 1,
                  });
                }
              }
            }
          }
        } else if (
          trimmed.startsWith("export {") || trimmed.startsWith("export type {")
        ) {
          // Export without from clause (e.g., export { foo, bar } or export type { foo })
          // These are re-exports of previously imported symbols
          const exportsMatch = trimmed.match(
            /export\s*(?:type\s+)?{\s*([^}]+)\s*}/,
          );
          if (exportsMatch) {
            const exportsList = exportsMatch[1].split(",").map((e) => e.trim());

            for (const exportItem of exportsList) {
              const [originalName, exportedName] = exportItem
                .split(/\s+as\s+/)
                .map((s) => s.trim());

              // For import-then-export pattern, we need to find where these were imported from
              const importSource = await findImportSource(
                content,
                originalName,
                currentDir,
              );

              if (importSource) {
                // Found the import source, trace that file
                const lineNum = await findSymbolInFile(
                  importSource,
                  originalName,
                );

                addExport(exportMap, filePath, {
                  originalName,
                  exportedName: exportedName || originalName,
                  sourcePath: importSource,
                  line: lineNum || i + 1,
                });
              } else {
                // Treat as a local export if we can't find the import
                // Find the actual definition line in this file
                const lineNum = await findSymbolInFile(
                  filePath,
                  originalName,
                );
                addExport(exportMap, filePath, {
                  originalName,
                  exportedName: exportedName || originalName,
                  sourcePath: filePath,
                  line: lineNum || i + 1,
                });
              }
            }
          }
        }
      } // Handle direct exports in this file
      else if (isDirectExport(trimmed)) {
        const symbolName = extractExportName(trimmed);
        if (symbolName) {
          addExport(exportMap, filePath, {
            originalName: symbolName,
            exportedName: symbolName,
            sourcePath: filePath,
            line: i + 1,
          });
        }
      }
    }
  } catch {
    // Silently ignore errors for missing files
  }
}

async function findImportSource(
  fileContent: string,
  symbolName: string,
  currentDir: string,
): Promise<string | null> {
  const lines = fileContent.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Look for import statements
    if (trimmed.startsWith("import ")) {
      // Check for named imports: import { symbolName } from "..."
      const namedImportMatch = trimmed.match(
        /import\s*{([^}]+)}\s*from\s*["']([^"']+)["']/,
      );

      if (namedImportMatch) {
        const imports = namedImportMatch[1].split(",").map((i) => i.trim());

        for (const imp of imports) {
          const [imported, alias] = imp.split(/\s+as\s+/).map((s) => s.trim());

          // Check if this import includes our symbol
          if (imported === symbolName || alias === symbolName) {
            const importPath = namedImportMatch[2];
            return await resolveImportPath(importPath, currentDir);
          }
        }
      }

      // Check for default import: import symbolName from "..."
      const defaultImportMatch = trimmed.match(
        /import\s+(\w+)\s+from\s*["']([^"']+)["']/,
      );

      if (defaultImportMatch && defaultImportMatch[1] === symbolName) {
        const importPath = defaultImportMatch[2];
        return await resolveImportPath(importPath, currentDir);
      }

      // Check for namespace import: import * as symbolName from "..."
      const namespaceImportMatch = trimmed.match(
        /import\s*\*\s+as\s+(\w+)\s+from\s*["']([^"']+)["']/,
      );

      if (namespaceImportMatch && namespaceImportMatch[1] === symbolName) {
        const importPath = namespaceImportMatch[2];
        return await resolveImportPath(importPath, currentDir);
      }
    }
  }

  return null;
}

async function resolveImportPath(
  importPath: string,
  fromDir: string,
): Promise<string | null> {
  // Handle relative imports
  if (importPath.startsWith(".")) {
    const basePath = join(fromDir, importPath);

    // Try with common extensions
    const extensions = [
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".mjs",
      "/mod.ts",
      "/index.ts",
    ];

    // First try exact path
    try {
      await Deno.stat(basePath);
      return resolve(basePath);
    } catch {
      // Try with extensions
      for (const ext of extensions) {
        try {
          const fullPath = basePath.endsWith(".ts") || basePath.endsWith(".js")
            ? basePath
            : basePath + ext;
          await Deno.stat(fullPath);
          return resolve(fullPath);
        } catch {
          continue;
        }
      }
    }
  }

  return null;
}

async function findSymbolInFile(
  filePath: string,
  symbolName: string,
): Promise<number | null> {
  try {
    const content = await Deno.readTextFile(filePath);
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check if this line exports the symbol we're looking for
      if (isDirectExport(line)) {
        const exportedName = extractExportName(line);
        if (exportedName === symbolName) {
          return i + 1;
        }
      }

      // Also check for non-exported declarations (class, function, interface, type, enum, const)
      // that might be exported later with export { ... }
      const patterns = [
        new RegExp(`^(?:async\\s+)?function\\s+${symbolName}\\b`),
        new RegExp(`^class\\s+${symbolName}\\b`),
        new RegExp(`^interface\\s+${symbolName}\\b`),
        new RegExp(`^type\\s+${symbolName}\\b`),
        new RegExp(`^enum\\s+${symbolName}\\b`),
        new RegExp(`^(?:const|let|var)\\s+${symbolName}\\b`),
      ];

      for (const pattern of patterns) {
        if (pattern.test(line)) {
          return i + 1;
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return null;
}

function isDirectExport(line: string): boolean {
  return (
    line.startsWith("export function") ||
    line.startsWith("export async function") ||
    line.startsWith("export class") ||
    line.startsWith("export interface") ||
    line.startsWith("export type") ||
    line.startsWith("export enum") ||
    line.startsWith("export const") ||
    line.startsWith("export let") ||
    line.startsWith("export var") ||
    line.startsWith("export default")
  );
}

function extractExportName(line: string): string | null {
  // Extract the symbol name from various export patterns
  const patterns = [
    /export\s+(?:async\s+)?function\s+(\w+)/,
    /export\s+class\s+(\w+)/,
    /export\s+interface\s+(\w+)/,
    /export\s+type\s+(\w+)/,
    /export\s+enum\s+(\w+)/,
    /export\s+(?:const|let|var)\s+(\w+)/,
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) {
      return match[1];
    }
  }

  if (line.includes("export default")) {
    return "default";
  }

  return null;
}

function addExport(
  exportMap: Map<string, TracedExport[]>,
  filePath: string,
  exportInfo: TracedExport,
): void {
  if (!exportMap.has(filePath)) {
    exportMap.set(filePath, []);
  }

  // Avoid duplicates
  const existing = exportMap.get(filePath)!;
  const isDuplicate = existing.some(
    (e) =>
      e.exportedName === exportInfo.exportedName &&
      e.sourcePath === exportInfo.sourcePath,
  );

  if (!isDuplicate) {
    existing.push(exportInfo);
  }
}

async function analyzeFileForJSDoc(
  exports: TracedExport[],
  symbols: ExportedSymbol[],
  rootPath: string,
): Promise<void> {
  // Group exports by their source file and deduplicate
  const exportsBySource = new Map<string, TracedExport[]>();
  const seenExports = new Set<string>();

  for (const exp of exports) {
    // Create a unique key for deduplication
    const key = `${exp.sourcePath}:${exp.exportedName}:${exp.originalName}`;
    if (seenExports.has(key)) {
      continue; // Skip duplicates
    }
    seenExports.add(key);

    if (!exportsBySource.has(exp.sourcePath)) {
      exportsBySource.set(exp.sourcePath, []);
    }
    exportsBySource.get(exp.sourcePath)!.push(exp);
  }

  // Analyze each source file
  for (const [sourcePath, sourceExports] of exportsBySource.entries()) {
    try {
      const content = await Deno.readTextFile(sourcePath);
      const lines = content.split("\n");
      const relativePath = relative(rootPath, sourcePath);

      // Track JSDoc blocks
      const jsDocBlocks: Map<number, string> = new Map();
      let currentJSDoc: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Track JSDoc blocks
        if (trimmed.startsWith("/**")) {
          if (trimmed.endsWith("*/")) {
            const jsDocContent = trimmed;
            if (!jsDocContent.includes("@module")) {
              for (let j = i + 1; j < lines.length; j++) {
                const nextLine = lines[j].trim();
                if (nextLine && !nextLine.startsWith("//")) {
                  if (
                    isDirectExport(nextLine) || nextLine.startsWith("export ")
                  ) {
                    jsDocBlocks.set(j, jsDocContent);
                    for (let k = j + 1; k <= j + 5 && k < lines.length; k++) {
                      jsDocBlocks.set(k, jsDocContent);
                    }
                  }
                  break;
                }
              }
            }
          } else {
            currentJSDoc = [trimmed];
          }
        } else if (currentJSDoc.length > 0) {
          currentJSDoc.push(line);
          if (trimmed.endsWith("*/")) {
            const jsDocContent = currentJSDoc.join("\n");
            if (jsDocContent.includes("@module")) {
              currentJSDoc = [];
              continue;
            }
            for (let j = i + 1; j < lines.length; j++) {
              const nextLine = lines[j].trim();
              if (nextLine && !nextLine.startsWith("//")) {
                if (
                  isDirectExport(nextLine) || nextLine.startsWith("export ")
                ) {
                  jsDocBlocks.set(j, jsDocContent);
                  for (let k = j + 1; k <= j + 5 && k < lines.length; k++) {
                    jsDocBlocks.set(k, jsDocContent);
                  }
                }
                break;
              }
            }
            currentJSDoc = [];
          }
        }

        // Check if this line starts an export declaration
        if (isDirectExport(trimmed)) {
          // For multi-line declarations, we need to extract the full declaration
          let fullDeclaration = trimmed;
          const declarationStartLine = i;

          // If the line doesn't contain a complete function/class signature, gather more lines
          if (!trimmed.includes("{") && !trimmed.includes(";")) {
            for (let j = i + 1; j < lines.length && j < i + 10; j++) {
              fullDeclaration += " " + lines[j].trim();
              if (lines[j].includes("{") || lines[j].includes(";")) {
                break;
              }
            }
          }

          const lineExportName = extractExportName(fullDeclaration);
          if (lineExportName) {
            // Find if we're tracking this specific export
            for (const exp of sourceExports) {
              if (
                exp.originalName === lineExportName &&
                exp.sourcePath === sourcePath
              ) {
                const symbol = parseExportedSymbol(
                  fullDeclaration,
                  declarationStartLine,
                  relativePath,
                  jsDocBlocks,
                );
                if (symbol) {
                  // Use the exported name from our trace
                  symbol.name = exp.exportedName;
                  symbols.push(symbol);
                }
                break;
              }
            }
          }
        } else {
          // Check for non-exported declarations that match symbols in sourceExports
          for (const exp of sourceExports) {
            const patterns = [
              `class ${exp.originalName}`,
              `function ${exp.originalName}`,
              `const ${exp.originalName}`,
              `let ${exp.originalName}`,
              `var ${exp.originalName}`,
              `interface ${exp.originalName}`,
              `type ${exp.originalName}`,
              `enum ${exp.originalName}`,
            ];

            for (const pattern of patterns) {
              if (trimmed.startsWith(pattern)) {
                let fullDeclaration = trimmed;
                const declarationStartLine = i;

                if (!trimmed.includes("{") && !trimmed.includes(";")) {
                  for (let j = i + 1; j < lines.length && j < i + 10; j++) {
                    fullDeclaration += " " + lines[j].trim();
                    if (lines[j].includes("{") || lines[j].includes(";")) {
                      break;
                    }
                  }
                }

                const symbol = parseExportedSymbol(
                  fullDeclaration,
                  declarationStartLine,
                  relativePath,
                  jsDocBlocks,
                );
                if (symbol) {
                  symbol.name = exp.exportedName;
                  symbols.push(symbol);
                }
                break;
              }
            }
          }
        }
      }
    } catch {
      // Silently ignore errors
    }
  }
}

async function analyzeAllFiles(
  rootPath: string,
  symbols: ExportedSymbol[],
): Promise<void> {
  const files = await findSourceFiles(rootPath);

  for (const file of files) {
    await analyzeFile(file, symbols, rootPath);
  }
}

async function findSourceFiles(rootPath: string): Promise<string[]> {
  const files: string[] = [];

  // Check if the path is a file or directory
  const stat = await Deno.stat(rootPath);

  if (stat.isFile) {
    // If it's a single file, check if it's a source file
    const validExts = [".ts", ".tsx", ".js", ".jsx", ".mjs"];
    if (validExts.some((ext) => rootPath.endsWith(ext))) {
      files.push(rootPath);
    }
  } else if (stat.isDirectory) {
    // If it's a directory, walk through it
    const entries = walk(rootPath, {
      exts: [".ts", ".tsx", ".js", ".jsx", ".mjs"],
      skip: [
        /node_modules/,
        /\.git/,
        /dist/,
        /build/,
        /coverage/,
        /\.test\./,
        /\.spec\./,
        /test\//,
        /tests\//,
        /_test\./,
      ],
    });

    for await (const entry of entries) {
      if (entry.isFile) {
        files.push(entry.path);
      }
    }
  }

  return files;
}

async function analyzeFile(
  filePath: string,
  symbols: ExportedSymbol[],
  rootPath: string,
): Promise<void> {
  const content = await Deno.readTextFile(filePath);
  const lines = content.split("\n");

  // Handle both file and directory paths
  const stat = await Deno.stat(rootPath);
  const relativePath = stat.isFile
    ? relative(Deno.cwd(), filePath)
    : relative(rootPath, filePath);

  // Track JSDoc blocks
  const jsDocBlocks: Map<number, string> = new Map();
  let currentJSDoc: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Track JSDoc blocks
    if (trimmed.startsWith("/**")) {
      if (trimmed.endsWith("*/")) {
        const jsDocContent = trimmed;
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim() && !lines[j].trim().startsWith("//")) {
            jsDocBlocks.set(j, jsDocContent);
            break;
          }
        }
      } else {
        currentJSDoc = [trimmed];
      }
    } else if (currentJSDoc.length > 0) {
      currentJSDoc.push(line);
      if (trimmed.endsWith("*/")) {
        const jsDocContent = currentJSDoc.join("\n");
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim() && !lines[j].trim().startsWith("//")) {
            jsDocBlocks.set(j, jsDocContent);
            break;
          }
        }
        currentJSDoc = [];
      }
    }

    // Check for exports
    if (isExportLine(trimmed)) {
      const symbol = parseExportedSymbol(
        trimmed,
        i,
        relativePath,
        jsDocBlocks,
      );
      if (symbol) {
        symbols.push(symbol);
      }
    }
  }
}

function isExportLine(line: string): boolean {
  return (
    line.startsWith("export ") ||
    (line.includes("export {") && !line.includes("export type {")) ||
    line.includes("export default")
  );
}

function parseExportedSymbol(
  line: string,
  lineIndex: number,
  filePath: string,
  jsDocBlocks: Map<number, string>,
): ExportedSymbol | null {
  const trimmed = line.trim();
  let name = "";
  let type: ExportedSymbol["type"] = "variable";
  let exportType: "named" | "default" = "named";

  // Check for JSDoc
  const hasJSDoc = jsDocBlocks.has(lineIndex);
  const jsDocContent = jsDocBlocks.get(lineIndex);

  // Parse export default
  if (trimmed.includes("export default")) {
    exportType = "default";

    if (trimmed.includes("function")) {
      const match = trimmed.match(/function\s+(\w+)/);
      name = match ? match[1] : "default";
      type = "function";
    } else if (trimmed.includes("class")) {
      const match = trimmed.match(/class\s+(\w+)/);
      name = match ? match[1] : "default";
      type = "class";
    } else {
      name = "default";
      type = "variable";
    }
  } // Parse export function
  else if (
    trimmed.startsWith("export function") ||
    trimmed.startsWith("export async function")
  ) {
    const match = trimmed.match(/function\s+(\w+)/);
    if (match) {
      name = match[1];
      type = "function";
    }
  } // Parse export class
  else if (trimmed.startsWith("export class")) {
    const match = trimmed.match(/class\s+(\w+)/);
    if (match) {
      name = match[1];
      type = "class";
    }
  } // Parse export interface
  else if (trimmed.startsWith("export interface")) {
    const match = trimmed.match(/interface\s+(\w+)/);
    if (match) {
      name = match[1];
      type = "interface";
    }
  } // Parse export type
  else if (trimmed.startsWith("export type")) {
    const match = trimmed.match(/type\s+(\w+)/);
    if (match) {
      name = match[1];
      type = "type";
    }
  } // Parse export enum
  else if (trimmed.startsWith("export enum")) {
    const match = trimmed.match(/enum\s+(\w+)/);
    if (match) {
      name = match[1];
      type = "enum";
    }
  } // Parse export const/let/var
  else if (
    trimmed.startsWith("export const") ||
    trimmed.startsWith("export let") ||
    trimmed.startsWith("export var")
  ) {
    const match = trimmed.match(/(?:const|let|var)\s+(\w+)/);
    if (match) {
      name = match[1];
      type = trimmed.includes("const") ? "const" : "variable";
    }
  } // Parse export { ... }
  else if (trimmed.includes("export {") && !trimmed.includes("from")) {
    // Only handle direct export { ... } without from clause in this function
    // Re-exports are handled elsewhere
    const match = trimmed.match(/export\s*{\s*([^}]+)\s*}/);
    if (match) {
      const exports = match[1].split(",").map((e) => e.trim());
      // For simplicity, we'll just track the first one
      // In a real implementation, you'd want to handle all of them
      if (exports.length > 0) {
        name = exports[0].split(/\s+as\s+/)[0];
        type = "variable"; // We'd need more context to determine the actual type
      }
    }
  } // Parse non-exported declarations
  else if (trimmed.startsWith("class ")) {
    const match = trimmed.match(/class\s+(\w+)/);
    if (match) {
      name = match[1];
      type = "class";
    }
  } else if (
    trimmed.startsWith("function ") || trimmed.startsWith("async function ")
  ) {
    const match = trimmed.match(/function\s+(\w+)/);
    if (match) {
      name = match[1];
      type = "function";
    }
  } else if (trimmed.startsWith("interface ")) {
    const match = trimmed.match(/interface\s+(\w+)/);
    if (match) {
      name = match[1];
      type = "interface";
    }
  } else if (trimmed.startsWith("type ")) {
    const match = trimmed.match(/type\s+(\w+)/);
    if (match) {
      name = match[1];
      type = "type";
    }
  } else if (trimmed.startsWith("enum ")) {
    const match = trimmed.match(/enum\s+(\w+)/);
    if (match) {
      name = match[1];
      type = "enum";
    }
  } else if (
    trimmed.startsWith("const ") || trimmed.startsWith("let ") ||
    trimmed.startsWith("var ")
  ) {
    const match = trimmed.match(/(?:const|let|var)\s+(\w+)/);
    if (match) {
      name = match[1];
      type = trimmed.startsWith("const") ? "const" : "variable";
    }
  }

  if (name) {
    return {
      name,
      type,
      file: filePath,
      line: lineIndex + 1,
      hasJSDoc,
      jsDocContent,
      exportType,
    };
  }

  return null;
}

export function calculateStats(symbols: ExportedSymbol[]): DocumentationStats {
  const stats: DocumentationStats = {
    total: symbols.length,
    documented: symbols.filter((s) => s.hasJSDoc).length,
    undocumented: symbols.filter((s) => !s.hasJSDoc).length,
    percentage: 0,
    byType: {},
  };

  stats.percentage = stats.total > 0
    ? Math.round((stats.documented / stats.total) * 100)
    : 100;

  // Calculate stats by type
  for (const symbol of symbols) {
    if (!stats.byType[symbol.type]) {
      stats.byType[symbol.type] = { total: 0, documented: 0 };
    }
    stats.byType[symbol.type].total++;
    if (symbol.hasJSDoc) {
      stats.byType[symbol.type].documented++;
    }
  }

  return stats;
}
