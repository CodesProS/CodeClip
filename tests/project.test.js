import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import {
  proposeMerge,
  validateName,
  unusedFilename,
  starterProjects,
} from "../src/lib/project.js";
import { loadProjects, STORAGE_KEY } from "../src/lib/storage.js";
import { buildProjectZip } from "../src/lib/download.js";

const storage = (values) => ({ getItem: (key) => values[key] ?? null });

test("scroll capture merges an exact boundary without dropping indentation", () => {
  const current = "function greet() {\n  return 1;\n}\nconsole.log(greet());";
  const incoming = "}\nconsole.log(greet());\n\nconst next = 2;";
  const result = proposeMerge(current, incoming);
  assert.equal(result.overlap, 2);
  assert.equal(result.code, `${current}\n\nconst next = 2;`);
});
test("matching lines inside a file are preserved instead of globally deduplicated", () => {
  const result = proposeMerge(
    "start();\nconsole.log(1);\nfinish();",
    "console.log(1);\nnewStep();",
  );
  assert.equal(result.code.match(/console.log\(1\)/g).length, 2);
  assert.equal(result.overlap, 0);
});
test("changed boundary lines are not silently substituted", () => {
  const result = proposeMerge("const a = 1;", "const a = 2;");
  assert.ok(result.code.includes("const a = 1;"));
  assert.ok(result.code.includes("const a = 2;"));
});
test("identical captures are a no-op, including final newline", () => {
  const code = "  one();\n  two();\n";
  assert.equal(proposeMerge(code, code).code, code);
  assert.equal(proposeMerge(code, code).unchanged, true);
});
test("a trailing subset is not appended again", () => {
  assert.equal(proposeMerge("one();\ntwo();", "two();").code, "one();\ntwo();");
});
test("empty capture cannot erase a file; empty target accepts the capture", () => {
  assert.equal(proposeMerge("keep();", "  ").code, "keep();");
  assert.equal(proposeMerge("", "  keep();").code, "  keep();");
});
test("CRLF captures retain code and indentation after normalization", () => {
  assert.equal(
    proposeMerge("a();\r\n  b();", "  b();\r\n  c();").code,
    "a();\n  b();\n  c();",
  );
});
test("duplicate names are rejected case insensitively and self-rename works", () => {
  const files = [{ id: "one", name: "main.js" }];
  assert.ok(validateName("MAIN.JS", files, null, true));
  assert.equal(validateName("main.js", files, "one", true), "");
  assert.equal(
    unusedFilename([...files, { id: "two", name: "main-2.js" }], "main.js"),
    "main-3.js",
  );
});
test("unsafe and Windows reserved filenames are blocked", () => {
  for (const name of [
    "../x.js",
    "a/b.js",
    "a\\b.js",
    "con.js",
    "nul",
    "file.",
    "a:b.js",
  ])
    assert.ok(validateName(name, [], null, true), name);
});
test("an intentionally empty saved project list stays empty", () => {
  assert.deepEqual(
    loadProjects(storage({ [STORAGE_KEY]: '{"projects":[]}' })).projects,
    [],
  );
});
test("corrupt stored data disables overwrite", () => {
  const result = loadProjects(storage({ [STORAGE_KEY]: "broken" }));
  assert.equal(result.canSave, false);
  assert.ok(result.error);
});
test("well-formed JSON with invalid nested files also disables overwrite", () => {
  const projects = starterProjects();
  projects[0].files = [null];
  assert.equal(
    loadProjects(storage({ [STORAGE_KEY]: JSON.stringify({ projects }) }))
      .canSave,
    false,
  );
});
test("old prototype projects retain files and selected filename on migration", () => {
  const old = {
    projects: [{ id: 1, name: "Old project", language: "Python" }],
    data: {
      1: {
        files: [{ name: "main.py", code: "example text" }],
        selectedFile: "main.py",
        captureHistory: [],
      },
    },
  };
  const result = loadProjects(
    storage({ "codeclip.prototype.v1": JSON.stringify(old) }),
  );
  assert.equal(result.canSave, true);
  assert.equal(result.projects[0].files[0].language, "Python");
  assert.equal(
    result.projects[0].selectedFileId,
    result.projects[0].files[0].id,
  );
  assert.equal(result.projects[0].files[0].code, "example text");
});
test("project ZIP contains every mixed-language file with exact UTF-8 content", async () => {
  const files = [
    {
      id: "a",
      name: "main.js",
      code: 'console.log("✓");',
      language: "JavaScript",
    },
    { id: "b", name: "notes.py", code: "  stored text\n", language: "Python" },
  ];
  const bytes = await buildProjectZip({ files }).generateAsync({
    type: "nodebuffer",
  });
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
  assert.deepEqual(Object.keys(zip.files), ["main.js", "notes.py"]);
  for (const file of files)
    assert.equal(await zip.file(file.name).async("string"), file.code);
});
test("ZIP creation refuses traversal names, including imported files", () => {
  assert.throws(
    () =>
      buildProjectZip({
        files: [{ id: "a", name: "../main.js", code: "text" }],
      }),
    /Rename/,
  );
});
