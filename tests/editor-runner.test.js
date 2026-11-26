import test from "node:test";
import assert from "node:assert/strict";
import {
  cursorPosition,
  emptyHistory,
  recordEdit,
  redoEdit,
  undoEdit,
} from "../src/lib/editor.js";
import { cleanPythonTraceback, runJavaScript } from "../src/lib/runner.js";

test("cursor position reports 1-based line and column", () => {
  const code = "def greet(name):\n    return name";
  assert.deepEqual(cursorPosition(code, 0), { line: 1, column: 1 });
  assert.deepEqual(cursorPosition(code, 17), { line: 2, column: 1 });
  assert.deepEqual(cursorPosition(code, 21), { line: 2, column: 5 });
});

test("quick typing groups into one undo step and redo restores it", () => {
  let history = emptyHistory();
  history = recordEdit(history, "", 1000);
  history = recordEdit(history, "a", 1200);
  history = recordEdit(history, "ab", 5000);
  assert.deepEqual(history.past, ["", "ab"]);
  const undone = undoEdit(history, "abc");
  assert.equal(undone.code, "ab");
  const again = undoEdit(undone.history, "ab");
  assert.equal(again.code, "");
  const redone = redoEdit(again.history, "");
  assert.equal(redone.code, "ab");
  assert.equal(undoEdit(emptyHistory(), "x"), null);
  assert.equal(redoEdit(emptyHistory(), "x"), null);
});

test("a new edit clears redo history", () => {
  const undone = undoEdit(recordEdit(emptyHistory(), "a", 1), "ab");
  assert.equal(undone.history.future.length, 1);
  assert.equal(recordEdit(undone.history, "a", 9999).future.length, 0);
});

test("JavaScript runner captures console output and prompt input", async () => {
  const lines = [];
  await runJavaScript(
    'const name = prompt("Name?");\nconsole.log(`Hello, ${name}!`, [1, 2]);\nconsole.error("oops");\nconsole.log(prompt());',
    { stdin: "Ada", write: (stream, text) => lines.push([stream, text]) },
  );
  assert.deepEqual(lines, [
    ["stdout", "Name?"],
    ["stdout", "Hello, Ada! [\n  1,\n  2\n]"],
    ["stderr", "oops"],
    ["stdout", "null"],
  ]);
});

test("JavaScript runner surfaces thrown errors", async () => {
  await assert.rejects(
    runJavaScript("undefinedFunction();", { write() {} }),
    /undefinedFunction is not defined/,
  );
});

test("Python tracebacks drop runtime frames but keep the user's frames", () => {
  const raw = [
    "Traceback (most recent call last):",
    '  File "/lib/python313.zip/_pyodide/_base.py", line 597, in eval_code_async',
    "    await CodeRunner(",
    '  File "main.py", line 4, in <module>',
    "    print(greet())",
    "TypeError: greet() missing 1 required positional argument: 'name'",
  ].join("\n");
  assert.equal(
    cleanPythonTraceback(raw),
    [
      "Traceback (most recent call last):",
      '  File "main.py", line 4, in <module>',
      "    print(greet())",
      "TypeError: greet() missing 1 required positional argument: 'name'",
    ].join("\n"),
  );
});
