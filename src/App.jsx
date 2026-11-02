import { useEffect, useRef, useState } from "react";
import Dashboard from "./components/Dashboard";
import Workspace from "./components/Workspace";
import Dialog from "./components/Dialog";
import ProjectDialog from "./components/ProjectDialog";
import useProjects from "./hooks/useProjects";
import { createProject, makeId, validateName } from "./lib/project";
import { loadSettings, SETTINGS_KEY } from "./lib/storage";

function currentProjectId() {
  try {
    return window.location.hash.startsWith("#project/")
      ? decodeURIComponent(window.location.hash.slice(9))
      : null;
  } catch {
    return null;
  }
}

export default function App() {
  const { projects, setProjects, updateProject, saveError, saveStatus } =
    useProjects();
  const [activeId, setActiveId] = useState(currentProjectId);
  const [dialog, setDialog] = useState(null);
  const [settings, setSettings] = useState(loadSettings);
  const [settingsError, setSettingsError] = useState("");
  const [message, setMessage] = useState("");
  const toastTimer = useRef(null);
  const project = projects.find((item) => item.id === activeId);

  useEffect(() => {
    const handleHash = () => setActiveId(currentProjectId());
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);
  useEffect(() => {
    document.title = project
      ? `${project.name} · CodeClip`
      : "CodeClip · My projects";
  }, [project?.name]);
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      setSettingsError("");
    } catch {
      setSettingsError(
        "Display preferences could not be saved in this browser.",
      );
    }
  }, [settings]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  function notify(text) {
    clearTimeout(toastTimer.current);
    setMessage(text);
    toastTimer.current = setTimeout(() => setMessage(""), 4500);
  }
  function saveProject(name, language) {
    if (dialog.project) {
      updateProject(dialog.project.id, () => ({ name, language }));
      notify("Project updated.");
    } else {
      const next = createProject(name, language);
      setProjects((current) => [next, ...current]);
      window.location.hash = `project/${next.id}`;
      notify("Project created. Add a capture or a file to get started.");
    }
    setDialog(null);
  }
  function duplicate(item) {
    let name = `${item.name.slice(0, 65)} Copy`;
    let suffix = 2;
    while (validateName(name, projects))
      name = `${item.name.slice(0, 65)} Copy ${suffix++}`;
    const copy = structuredClone(item);
    copy.id = makeId();
    copy.name = name;
    copy.updatedAt = Date.now();
    // File and capture IDs only need to be unique inside their own project.
    setProjects((current) => [copy, ...current]);
    notify("Project duplicated.");
  }
  function removeProject() {
    setProjects((current) =>
      current.filter((item) => item.id !== dialog.project.id),
    );
    if (dialog.project.id === activeId) window.location.hash = "projects";
    setDialog(null);
    notify("Project deleted.");
  }

  return (
    <div className={`app app--${settings.theme}`}>
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Skip to content
      </a>
      <header className="topbar">
        <a className="brand" href="#projects">
          <span className="brand__mark" aria-hidden="true">
            &lt;/&gt;
          </span>
          <strong>CodeClip</strong>
        </a>
        <div className="top-actions">
          <button
            className="theme-toggle"
            onClick={() =>
              setSettings((current) => ({
                ...current,
                theme: current.theme === "light" ? "dark" : "light",
              }))
            }
          >
            {settings.theme === "light" ? "◐ Dark mode" : "☼ Light mode"}
          </button>
          <button
            className="guide-button"
            onClick={() => setDialog({ type: "guide" })}
          >
            How it works
          </button>
        </div>
      </header>
      {(saveError || settingsError) && (
        <div className="save-warning" role="alert">
          {saveError || settingsError}
        </div>
      )}
      {project ? (
        <Workspace
          key={project.id}
          project={project}
          updateProject={updateProject}
          settings={settings}
          onSettings={() => setDialog({ type: "settings" })}
          saveStatus={saveStatus}
          notify={notify}
        />
      ) : activeId ? (
        <main id="main" tabIndex={-1} className="empty-state">
          <h1>Project not found</h1>
          <p>This project may have been deleted or saved in another browser.</p>
          <a className="button" href="#projects">
            Back to projects
          </a>
        </main>
      ) : (
        <Dashboard
          projects={projects}
          onCreate={() => setDialog({ type: "project" })}
          onEdit={(item) => setDialog({ type: "project", project: item })}
          onDuplicate={duplicate}
          onDelete={(item) =>
            setDialog({ type: "delete-project", project: item })
          }
        />
      )}
      <div className="toast-region" role="status" aria-live="polite">
        {message && <div className="toast">{message}</div>}
      </div>
      {dialog?.type === "project" && (
        <ProjectDialog
          project={dialog.project}
          projects={projects}
          onSave={saveProject}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === "delete-project" && (
        <Dialog title="Delete project" onClose={() => setDialog(null)}>
          <div className="modal__body">
            <p>
              Delete <strong>{dialog.project.name}</strong> and all of its files
              and capture history? Download anything you want to keep first.
            </p>
          </div>
          <footer className="modal__footer">
            <button className="button" onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button className="button button--danger" onClick={removeProject}>
              Delete project
            </button>
          </footer>
        </Dialog>
      )}
      {dialog?.type === "settings" && (
        <Dialog title="Editor settings" onClose={() => setDialog(null)}>
          <div className="modal__body stack">
            <label className="field">
              Font size
              <select
                value={settings.fontSize}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    fontSize: Number(event.target.value),
                  }))
                }
              >
                {[12, 14, 16, 18].map((size) => (
                  <option key={size} value={size}>
                    {size} px
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={settings.wordWrap}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    wordWrap: event.target.checked,
                  }))
                }
              />{" "}
              Wrap long lines (hides line numbers)
            </label>
            <p className="hint">Preferences apply immediately.</p>
          </div>
          <footer className="modal__footer">
            <button
              className="button button--primary"
              onClick={() => setDialog(null)}
            >
              Done
            </button>
          </footer>
        </Dialog>
      )}
      {dialog?.type === "guide" && (
        <Dialog title="How CodeClip works" onClose={() => setDialog(null)}>
          <div className="modal__body stack">
            <ol className="guide-steps">
              <li>
                Create a project. Its language is a default; each file has its
                own language.
              </li>
              <li>
                Try a preset sample, upload a screenshot to transcribe, or save
                a video reference.
              </li>
              <li>Review the code, language, and filename.</li>
              <li>
                Save a new file, or update an existing file after checking the
                proposed changes.
              </li>
              <li>
                Edit, copy, and download files, or download the whole project as
                a ZIP.
              </li>
            </ol>
            <p className="hint">
              This milestone uses preset sample extraction and manual
              transcription. AI vision and direct webpage capture are still
              planned. Code is stored locally in this browser; clearing site
              data removes it. Image previews are not saved.
            </p>
          </div>
          <footer className="modal__footer">
            <button
              className="button button--primary"
              onClick={() => setDialog(null)}
            >
              Got it
            </button>
          </footer>
        </Dialog>
      )}
    </div>
  );
}
