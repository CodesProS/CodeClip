// Runs one program at a time, away from the page, so a long-running program
// can be stopped by terminating this worker.
import { cleanPythonTraceback, formatValue, runJavaScript } from "./runner.js";

const PYODIDE_URL = "https://cdn.jsdelivr.net/npm/pyodide@0.29.5/";
let pyodide = null;

function write(stream, text) {
  self.postMessage({ type: "output", stream, text });
}

async function loadPython() {
  if (!pyodide) {
    self.postMessage({ type: "loading" });
    pyodide = import(/* @vite-ignore */ `${PYODIDE_URL}pyodide.mjs`)
      .then(({ loadPyodide }) => loadPyodide({ indexURL: PYODIDE_URL }))
      .catch((problem) => {
        pyodide = null;
        throw new Error(
          `The Python runtime could not be downloaded. Check your connection and try again. (${problem.message})`,
        );
      });
  }
  return pyodide;
}

async function runPython(code, stdin, filename) {
  const py = await loadPython();
  self.postMessage({ type: "started" });
  const lines = stdin ? stdin.split(/\r?\n/) : [];
  let nextLine = 0;
  py.setStdout({ batched: (text) => write("stdout", text) });
  py.setStderr({ batched: (text) => write("stderr", text) });
  py.setStdin({
    stdin: () => (nextLine < lines.length ? lines[nextLine++] : undefined),
  });
  const scope = py.globals.get("dict")();
  scope.set("__name__", "__main__");
  try {
    await py.runPythonAsync(code, { globals: scope, filename });
  } catch (problem) {
    throw new Error(cleanPythonTraceback(problem.message), { cause: "python" });
  } finally {
    scope.destroy();
  }
}

self.onmessage = async ({ data }) => {
  const { language, code, stdin, filename } = data;
  try {
    if (language === "JavaScript") {
      self.postMessage({ type: "started" });
      await runJavaScript(code, { stdin, write });
    } else if (language === "Python") {
      await runPython(code, stdin, filename);
    } else {
      throw new Error(`${language} cannot run in the browser yet.`);
    }
    self.postMessage({ type: "done" });
  } catch (problem) {
    write(
      "stderr",
      problem?.cause === "python" ? problem.message : formatValue(problem),
    );
    self.postMessage({ type: "failed" });
  }
};
