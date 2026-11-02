import {
  guessLanguage,
  LANGUAGES,
  makeId,
  starterProjects,
} from "./project.js";

export const STORAGE_KEY = "codeclip.student.v2";
export const SETTINGS_KEY = "codeclip.settings.v2";

function validProjects(projects) {
  const unique = (items) =>
    new Set(items.map((item) => item?.id)).size === items.length;
  return (
    Array.isArray(projects) &&
    unique(projects) &&
    projects.every(
      (project) =>
        project &&
        typeof project.id === "string" &&
        typeof project.name === "string" &&
        LANGUAGES.includes(project.language) &&
        Number.isFinite(project.updatedAt) &&
        Array.isArray(project.files) &&
        unique(project.files) &&
        project.files.every(
          (file) =>
            file &&
            typeof file.id === "string" &&
            typeof file.name === "string" &&
            typeof file.code === "string" &&
            LANGUAGES.includes(file.language),
        ) &&
        (project.selectedFileId === null ||
          project.files.some((file) => file.id === project.selectedFileId)) &&
        Array.isArray(project.captures) &&
        unique(project.captures) &&
        project.captures.every(
          (capture) =>
            capture &&
            typeof capture.id === "string" &&
            typeof capture.label === "string" &&
            typeof capture.code === "string" &&
            typeof capture.filename === "string" &&
            Number.isFinite(capture.createdAt) &&
            ["demo", "image", "youtube"].includes(capture.sourceType) &&
            LANGUAGES.includes(capture.language) &&
            (capture.reference === undefined ||
              typeof capture.reference === "string"),
        ),
    )
  );
}

// Import text from the original prototype once. Its storage key is left intact.
function migratePrototype(old) {
  if (!Array.isArray(old.projects) || !old.data)
    throw new Error("Invalid prototype data");
  return old.projects.map((project) => {
    const data = old.data[project.id] || {};
    const files = (data.files || []).map((file) => ({
      id: makeId(),
      name: file.name,
      code: file.code,
      language: guessLanguage(file.name, project.language),
    }));
    return {
      id: String(project.id),
      name: project.name,
      language: LANGUAGES.includes(project.language)
        ? project.language
        : "Text",
      updatedAt: Date.now(),
      files,
      selectedFileId:
        files.find((file) => file.name === data.selectedFile)?.id ||
        files[0]?.id ||
        null,
      captures: (data.captureHistory || []).map((capture) => ({
        id: makeId(),
        label: capture.label || "Prototype sample",
        filename: capture.filename || "capture.txt",
        code: capture.code || "",
        sourceType: "demo",
        createdAt: Date.now(),
        language: guessLanguage(capture.filename || "capture.txt"),
      })),
    };
  });
}

export function loadProjects(storage = window.localStorage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const projects = JSON.parse(raw).projects;
      if (!validProjects(projects)) throw new Error("Invalid saved projects");
      return { projects, error: "", canSave: true };
    }
    const old = storage.getItem("codeclip.prototype.v1");
    const projects = old
      ? migratePrototype(JSON.parse(old))
      : starterProjects();
    if (!validProjects(projects)) throw new Error("Invalid prototype projects");
    return { projects, error: "", canSave: true };
  } catch {
    // Do not overwrite unreadable user data with the starter project.
    return {
      projects: starterProjects(),
      error:
        "Saved projects could not be read. This session will not overwrite them. Download any work you want to keep.",
      canSave: false,
    };
  }
}

export function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    return {
      theme: saved?.theme === "dark" ? "dark" : "light",
      fontSize: [12, 14, 16, 18].includes(saved?.fontSize)
        ? saved.fontSize
        : 14,
      wordWrap: saved?.wordWrap === true,
    };
  } catch {
    return { theme: "light", fontSize: 14, wordWrap: false };
  }
}
