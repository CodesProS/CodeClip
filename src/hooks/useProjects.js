import { useEffect, useState } from "react";
import { loadProjects, STORAGE_KEY } from "../lib/storage";

export default function useProjects() {
  const [initial] = useState(() => {
    try {
      return loadProjects();
    } catch {
      return loadProjects({
        getItem() {
          throw new Error("Storage blocked");
        },
      });
    }
  });
  const [projects, setProjects] = useState(initial.projects);
  const [savedProjects, setSavedProjects] = useState(null);
  const [saveError, setSaveError] = useState(initial.error);

  useEffect(() => {
    if (!initial.canSave) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ version: 2, projects }),
        );
        setSavedProjects(projects);
        setSaveError("");
      } catch {
        setSaveError(
          "Browser storage is unavailable or full. Your work is in this tab; download your files before closing it.",
        );
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [projects, initial.canSave]);

  // Flush the latest version before a refresh, close, or background transition.
  useEffect(() => {
    const flush = () => {
      if (!initial.canSave) return;
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ version: 2, projects }),
        );
      } catch {
        /* The visible save warning already directs users to downloads. */
      }
    };
    window.addEventListener("pagehide", flush);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [projects, initial.canSave]);

  function updateProject(id, change, touch = true) {
    setProjects((current) =>
      current.map((project) =>
        project.id === id
          ? {
              ...project,
              ...change(project),
              ...(touch ? { updatedAt: Date.now() } : {}),
            }
          : project,
      ),
    );
  }

  return {
    projects,
    setProjects,
    updateProject,
    saveError,
    saveStatus: saveError
      ? "Not saved to browser"
      : savedProjects === projects
        ? "Saved in this browser"
        : "Saving…",
  };
}
