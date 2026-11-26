// Code running helpers shared by the browser worker and the Node tests.

export const RUNNABLE_LANGUAGES = ["JavaScript", "Python"];
export const RUN_TIMEOUT_MS = 15000;
export const MAX_OUTPUT_LINES = 2000;

export function formatValue(value) {
  if (typeof value === "string") return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === "function")
    return `[Function ${value.name || "anonymous"}]`;
  if (typeof value === "bigint") return `${value}n`;
  if (value === undefined || typeof value === "symbol") return String(value);
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

// Runs JavaScript with console output and prompt() lines redirected.
// In the app this only ever executes inside a Web Worker.
export async function runJavaScript(code, { stdin = "", write }) {
  const lines = stdin ? stdin.split(/\r?\n/) : [];
  let nextLine = 0;
  const print =
    (stream) =>
    (...args) =>
      write(stream, args.map(formatValue).join(" "));
  const sandboxConsole = {
    log: print("stdout"),
    info: print("stdout"),
    debug: print("stdout"),
    table: print("stdout"),
    warn: print("stderr"),
    error: print("stderr"),
  };
  const prompt = (message) => {
    if (message) write("stdout", String(message));
    return nextLine < lines.length ? lines[nextLine++] : null;
  };
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
  const program = new AsyncFunction("console", "prompt", code);
  await program(sandboxConsole, prompt);
}

// Pyodide tracebacks include frames from its own runtime; students only need
// the frames from their file.
export function cleanPythonTraceback(message) {
  const output = [];
  let skipping = false;
  for (const line of String(message).split("\n")) {
    if (/^\s*File "\/lib\//.test(line)) {
      skipping = true;
      continue;
    }
    if (skipping && /^\s{4,}/.test(line) && !/^\s*File "/.test(line)) continue;
    skipping = false;
    output.push(line);
  }
  return output.join("\n").trimEnd();
}
