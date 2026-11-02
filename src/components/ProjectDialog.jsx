import { useState } from "react";
import Dialog from "./Dialog";
import { LANGUAGES, validateName } from "../lib/project";

export default function ProjectDialog({ project, projects, onSave, onClose }) {
  const [name, setName] = useState(project?.name || "");
  const [language, setLanguage] = useState(project?.language || "JavaScript");
  const [error, setError] = useState("");
  function submit(event) {
    event.preventDefault();
    const message = validateName(name, projects, project?.id);
    setError(message);
    if (!message) onSave(name.trim(), language);
  }
  return (
    <Dialog
      title={project ? "Edit project" : "Create project"}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="modal__body stack">
          <label className="field">
            Project name
            <input
              autoFocus
              maxLength={80}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setError("");
              }}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "project-error" : undefined}
              placeholder="e.g. React study notes"
            />
          </label>
          <label className="field">
            Language
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
            >
              {LANGUAGES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <p className="hint">
            The language sets the default file extension. Files are stored as
            editable text.
          </p>
          {error && (
            <p className="error-text" id="project-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <footer className="modal__footer">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button button--primary" type="submit">
            {project ? "Save project" : "Create project"}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
