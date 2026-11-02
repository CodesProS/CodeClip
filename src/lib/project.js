// Each project owns its files and captures. Components do not keep a second copy.
export const LANGUAGES = ["JavaScript", "Python", "Java", "C", "C++", "Text"];
export const EXTENSIONS = {
  JavaScript: "js",
  Python: "py",
  Java: "java",
  C: "c",
  "C++": "cpp",
  Text: "txt",
};

export function guessLanguage(filename, fallback = "Text") {
  const extension = filename.split(".").pop().toLowerCase();
  if (["jsx", "mjs"].includes(extension)) return "JavaScript";
  return (
    Object.keys(EXTENSIONS).find(
      (language) => EXTENSIONS[language] === extension,
    ) || fallback
  );
}

export function projectLanguages(project) {
  return [
    ...new Set(
      project.files.length
        ? project.files.map((file) => file.language)
        : [project.language],
    ),
  ];
}

export const SAMPLES = [
  {
    id: "greeting",
    title: "A simple function",
    filename: "greeting.js",
    code: 'function greet(name) {\n  return `Hello, ${name}!`;\n}\n\nconsole.log(greet("Ada"));',
  },
  {
    id: "array",
    title: "Function + next section",
    filename: "greeting.js",
    code: 'console.log(greet("Ada"));\n\nconst names = ["Ada", "Sam"];\nnames.forEach(name => console.log(greet(name)));',
  },
  {
    id: "filter",
    title: "Filter a list",
    filename: "students.js",
    code: 'const students = [\n  { name: "Ada", active: true },\n  { name: "Sam", active: false }\n];\n\nconst active = students.filter(student => student.active);\nconsole.log(active);',
  },
];

export const makeId = () => crypto.randomUUID();

export function createProject(name, language) {
  return {
    id: makeId(),
    name: name.trim(),
    language,
    updatedAt: Date.now(),
    files: [],
    captures: [],
    selectedFileId: null,
  };
}

export function starterProjects() {
  const project = createProject("JavaScript Tutorial", "JavaScript");
  const file = {
    id: makeId(),
    name: "main.js",
    language: "JavaScript",
    code: SAMPLES[0].code,
  };
  return [{ ...project, files: [file], selectedFileId: file.id }];
}

export function validateName(name, items, ignoreId = null, isFile = false) {
  const value = name.trim();
  if (!value) return "Enter a name.";
  if (value.length > 80) return "Use 80 characters or fewer.";
  if (
    isFile &&
    (/[/\\<>:"|?*\u0000-\u001f]/.test(value) ||
      /[. ]$/.test(value) ||
      value === "." ||
      value === "..")
  ) {
    return "Use a filename without folders or special characters.";
  }
  if (isFile && /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(value))
    return "Choose a different filename; this name is reserved on Windows.";
  if (
    items.some(
      (item) =>
        item.id !== ignoreId && item.name.toLowerCase() === value.toLowerCase(),
    )
  )
    return "That name already exists. Choose another name.";
  return "";
}

export function unusedFilename(files, name) {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : "";
  let candidate = name;
  let suffix = 2;
  while (
    files.some((file) => file.name.toLowerCase() === candidate.toLowerCase())
  )
    candidate = `${stem}-${suffix++}${extension}`;
  return candidate;
}

export function downloadFile(file) {
  downloadBlob(
    new Blob([file.code], { type: "text/plain;charset=utf-8" }),
    file.name,
  );
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Only skip EXACT trailing/leading line matches. Preserve indentation.
export function proposeMerge(existing, incoming) {
  const original = existing.replace(/\r\n/g, "\n");
  const addition = incoming.replace(/\r\n/g, "\n");
  if (!addition.trim()) return { code: original, overlap: 0, unchanged: true };
  if (!original.trim()) return { code: addition, overlap: 0, unchanged: false };
  if (original === addition)
    return {
      code: original,
      overlap: addition.split("\n").length,
      unchanged: true,
    };
  const before = original.replace(/\n+$/, "").split("\n");
  const after = addition.replace(/^\n+/, "").split("\n");
  let overlap = 0;
  for (let count = Math.min(before.length, after.length); count > 0; count--) {
    const tail = before.slice(-count);
    if (
      tail.some((line) => line.trim()) &&
      tail.every((line, index) => line === after[index])
    ) {
      overlap = count;
      break;
    }
  }
  if (overlap === after.length)
    return { code: original, overlap, unchanged: true };
  return {
    code: [...before, ...(overlap ? [] : [""]), ...after.slice(overlap)].join(
      "\n",
    ),
    overlap,
    unchanged: false,
  };
}

export function formatDate(time) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(time);
}

// This only loads known sample text. It does not inspect an uploaded image.
export function extractDemo(sampleId, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted)
      return reject(new DOMException("Cancelled", "AbortError"));
    const cancel = () => {
      clearTimeout(timer);
      reject(new DOMException("Cancelled", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", cancel);
      const sample = SAMPLES.find((item) => item.id === sampleId);
      if (sample) resolve(sample);
      else
        reject(new Error("This sample is unavailable. Choose another sample."));
    }, 600);
    signal.addEventListener("abort", cancel, { once: true });
  });
}
