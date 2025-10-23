import { assertEquals } from "@std/assert";
import { analyzeDirectory } from "../core.ts";
import { join } from "@std/path";

Deno.test("analyzeDirectory - finds exported symbols", async () => {
  const fixturesPath = join(
    Deno.cwd(),
    "tests",
    "fixtures",
    "simple",
    "basic.ts",
  );

  const result = await analyzeDirectory(fixturesPath);

  assertEquals(result.symbols.length, 4);
  assertEquals(result.hasDenoJson, false);
});

Deno.test("analyzeDirectory - detects JSDoc presence", async () => {
  const fixturesPath = join(
    Deno.cwd(),
    "tests",
    "fixtures",
    "simple",
    "basic.ts",
  );

  const result = await analyzeDirectory(fixturesPath);

  const undocumented = result.symbols.filter((s) => !s.hasJSDoc);
  assertEquals(undocumented.length, 4);
});

Deno.test("analyzeDirectory - detects documented symbols", async () => {
  const fixturesPath = join(
    Deno.cwd(),
    "tests",
    "fixtures",
    "simple",
    "documented.ts",
  );

  const result = await analyzeDirectory(fixturesPath);

  assertEquals(result.symbols.length, 4);

  const documented = result.symbols.filter((s) => s.hasJSDoc);
  assertEquals(documented.length, 4);

  assertEquals(result.stats.percentage, 100);
});

Deno.test("analyzeDirectory - calculates stats correctly", async () => {
  const fixturesPath = join(
    Deno.cwd(),
    "tests",
    "fixtures",
    "simple",
    "basic.ts",
  );

  const result = await analyzeDirectory(fixturesPath);

  assertEquals(result.stats.total, 4);
  assertEquals(result.stats.documented, 0);
  assertEquals(result.stats.undocumented, 4);
  assertEquals(result.stats.percentage, 0);
});

Deno.test("analyzeDirectory - handles different export types", async () => {
  const fixturesPath = join(
    Deno.cwd(),
    "tests",
    "fixtures",
    "export_blocks",
    "export_block.ts",
  );

  const result = await analyzeDirectory(fixturesPath);

  assertEquals(result.symbols.length, 3);

  const classSymbol = result.symbols.find((s) => s.name === "MyClass");
  assertEquals(classSymbol?.type, "class");

  const functionSymbol = result.symbols.find((s) => s.name === "myFunction");
  assertEquals(functionSymbol?.type, "function");

  const constSymbol = result.symbols.find((s) => s.name === "myConst");
  assertEquals(constSymbol?.type, "const");
});

Deno.test("analyzeDirectory - uses deno.json exports field", async () => {
  const fixturesPath = join(Deno.cwd(), "tests", "fixtures", "with_config");

  const result = await analyzeDirectory(fixturesPath);

  assertEquals(result.hasDenoJson, true);
  assertEquals(result.hasExports, true);
  assertEquals(result.exportPath, "./reexport.ts");
});

Deno.test("analyzeDirectory - traces re-exports", async () => {
  const fixturesPath = join(Deno.cwd(), "tests", "fixtures", "with_config");

  const result = await analyzeDirectory(fixturesPath);

  const symbolNames = result.symbols.map((s) => s.name).sort();

  assertEquals(symbolNames.includes("documentedFunction"), true);
  assertEquals(symbolNames.includes("UndocumentedClass"), true);
  assertEquals(symbolNames.includes("DocumentedInterface"), true);
  assertEquals(symbolNames.includes("undocumentedConst"), true);
  assertEquals(symbolNames.includes("renamedFunction"), true);
});

Deno.test("analyzeDirectory - avoids duplicate exports", async () => {
  const fixturesPath = join(Deno.cwd(), "tests", "fixtures", "with_config");

  const result = await analyzeDirectory(fixturesPath);

  const symbolNames = result.symbols.map((s) => s.name);
  const uniqueNames = new Set(symbolNames);

  assertEquals(symbolNames.length, uniqueNames.size);
});

Deno.test("analyzeDirectory - tracks symbol types correctly", async () => {
  const fixturesPath = join(
    Deno.cwd(),
    "tests",
    "fixtures",
    "simple",
    "basic.ts",
  );

  const result = await analyzeDirectory(fixturesPath);

  const byType = result.stats.byType;

  assertEquals(byType["function"]?.total, 1);
  assertEquals(byType["class"]?.total, 1);
  assertEquals(byType["interface"]?.total, 1);
  assertEquals(byType["const"]?.total, 1);
});

Deno.test("analyzeDirectory - correctly matches symbols with prefix names", async () => {
  const fixturesPath = join(
    Deno.cwd(),
    "tests",
    "fixtures",
    "prefix_bug",
    "types.ts",
  );

  const result = await analyzeDirectory(fixturesPath);

  assertEquals(result.symbols.length, 2);

  const serverSymbol = result.symbols.find((s) => s.name === "Server");
  assertEquals(serverSymbol?.type, "type");
  assertEquals(serverSymbol?.line, 6);

  const serverRateLimitSymbol = result.symbols.find((s) => s.name === "ServerRateLimitDescription");
  assertEquals(serverRateLimitSymbol?.type, "type");
  assertEquals(serverRateLimitSymbol?.line, 1);
});
