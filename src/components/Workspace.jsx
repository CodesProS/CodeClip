import { useState } from "react";
import CapturePanel from "./CapturePanel";
import EditorPanel from "./EditorPanel";
import ReviewDialog from "./ReviewDialog";
import Dialog from "./Dialog";
import {
  EXTENSIONS,
  guessLanguage,
  LANGUAGES,
  makeId,
  unusedFilename,
  validateName,
} from "../lib/project";
import { downloadProject } from "../lib/download";

export default function Workspace({
  project,
  updateProject,
  settings,
  onSettings,
  saveStatus,
  notify,
}) {
  const [capture, setCapture] = useState(null);
  const [fileDialog, setFileDialog] = useState(null);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState(project.language);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const file =
    project.files.find((item) => item.id === project.selectedFileId) || null;
  const target = project.files.find((item) => item.id === fileDialog?.id);
  function update(change, touch = true) {
    updateProject(project.id, change, touch);
  }

  function openFileDialog(type, item) {
    setName(
      item?.name ||
        unusedFilename(
          project.files,
          `untitled.${EXTENSIONS[project.language]}`,
        ),
    );
    setLanguage(item?.language || project.language);
    setError("");
    setFileDialog({ type, id: item?.id });
  }

  function saveFile(event) {
    event.preventDefault();
    const message = validateName(name, project.files, target?.id, true);
    setError(message);
    if (message) return;
    if (fileDialog.type === "new") {
      const next = { id: makeId(), name: name.trim(), language, code: "" };
      update((current) => ({
        files: [...current.files, next],
        selectedFileId: next.id,
      }));
    } else {
      update((current) => ({
        files: current.files.map((item) =>
          item.id === target.id
            ? { ...item, name: name.trim(), language }
            : item,
        ),
      }));
    }
    setFileDialog(null);
    notify("File saved.");
  }

  function deleteFile() {
    update((current) => {
      const files = current.files.filter((item) => item.id !== target.id);
      return {
        files,
        selectedFileId:
          current.selectedFileId === target.id
            ? files[0]?.id || null
            : current.selectedFileId,
      };
    });
    setFileDialog(null);
    notify("File deleted.");
  }

  function saveCapture(review) {
    const id = review.targetId || makeId();
    const captureId = capture.id || makeId();
    update((current) => {
      const filename = review.targetId
        ? current.files.find((item) => item.id === id).name
        : review.filename;
      const savedCapture = {
        id: captureId,
        label: capture.label,
        filename,
        code: review.code,
        language: review.language,
        sourceType: capture.sourceType,
        createdAt: Date.now(),
        reference: capture.reference || "",
      };
      const files = review.targetId
        ? current.files.map((item) =>
            item.id === id ? { ...item, code: review.proposedCode } : item,
          )
        : [
            ...current.files,
            {
              id,
              name: filename,
              language: review.language,
              code: review.code,
            },
          ];
      return {
        files,
        selectedFileId: id,
        captures: [
          savedCapture,
          ...current.captures.filter((item) => item.id !== captureId),
        ],
      };
    });
    setCapture(null);
    notify(
      review.targetId
        ? "Proposed changes accepted."
        : "Capture saved as a new file.",
    );
  }

  async function exportZip() {
    setExporting(true);
    try {
      await downloadProject(project);
      notify("Project ZIP download started.");
    } catch (problem) {
      notify(
        problem.message ||
          "ZIP download failed. Try downloading individual files.",
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <main id="main" tabIndex={-1} className="workspace">
      <div className="workspace-toolbar">
        <div>
          <a href="#projects" className="text-button">
            ← All projects
          </a>
          <h1>{project.name}</h1>
          <p className="hint" role="status">
            {saveStatus}
          </p>
        </div>
        <button
          className="button button--primary"
          disabled={!project.files.length || exporting}
          onClick={exportZip}
        >
          {exporting ? "Preparing ZIP…" : "Download project ZIP"}
        </button>
      </div>
      <div className="workspace-grid">
        <aside className="file-panel" aria-label="Project files">
          <div className="files-heading">
            <h2>
              Files <span className="hint">{project.files.length}</span>
            </h2>
            <button
              className="text-button"
              onClick={() => openFileDialog("new")}
            >
              + New file
            </button>
          </div>
          {!project.files.length && (
            <p className="hint empty-files">
              No files yet. Add a capture or create a file.
            </p>
          )}
          <div className="file-list">
            {project.files.map((item) => (
              <div className="file-row" key={item.id}>
                <button
                  className={item.id === file?.id ? "active" : ""}
                  aria-current={item.id === file?.id ? "true" : undefined}
                  onClick={() =>
                    update(() => ({ selectedFileId: item.id }), false)
                  }
                >
                  <span className="file-icon">{EXTENSIONS[item.language]}</span>
                  <span>{item.name}</span>
                </button>
                <div className="file-row-actions">
                  <button
                    className="text-button"
                    aria-label={`Rename ${item.name}`}
                    onClick={() => openFileDialog("rename", item)}
                  >
                    Rename
                  </button>
                  <button
                    className="text-button danger-text"
                    aria-label={`Delete ${item.name}`}
                    onClick={() => openFileDialog("delete", item)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>
        <CapturePanel project={project} onReview={setCapture} />
        <EditorPanel
          file={file}
          settings={settings}
          onChange={(code) =>
            update((current) => ({
              files: current.files.map((item) =>
                item.id === file.id ? { ...item, code } : item,
              ),
            }))
          }
          onSettings={onSettings}
          notify={notify}
        />
      </div>
      {capture && (
        <ReviewDialog
          capture={capture}
          project={project}
          settings={settings}
          onSave={saveCapture}
          onClose={() => setCapture(null)}
        />
      )}
      {fileDialog && (
        <Dialog
          title={
            fileDialog.type === "delete"
              ? "Delete file"
              : fileDialog.type === "new"
                ? "Create file"
                : "Rename file"
          }
          onClose={() => setFileDialog(null)}
        >
          {fileDialog.type === "delete" ? (
            <>
              <div className="modal__body">
                <p>
                  Delete <strong>{target?.name}</strong>? This removes the file.
                  Saved capture history remains available.
                </p>
              </div>
              <footer className="modal__footer">
                <button className="button" onClick={() => setFileDialog(null)}>
                  Cancel
                </button>
                <button className="button button--danger" onClick={deleteFile}>
                  Delete file
                </button>
              </footer>
            </>
          ) : (
            <form onSubmit={saveFile}>
              <div className="modal__body stack">
                <label className="field">
                  Filename
                  <input
                    autoFocus
                    value={name}
                    maxLength={80}
                    onChange={(event) => {
                      setName(event.target.value);
                      setLanguage(guessLanguage(event.target.value, language));
                      setError("");
                    }}
                    aria-invalid={Boolean(error)}
                  />
                </label>
                <label className="field">
                  File language
                  <select
                    value={language}
                    onChange={(event) => {
                      setLanguage(event.target.value);
                      setName(
                        `${name.replace(/\.[^.]+$/, "")}.${EXTENSIONS[event.target.value]}`,
                      );
                    }}
                  >
                    {LANGUAGES.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                {error && (
                  <p className="error-text" role="alert">
                    {error}
                  </p>
                )}
              </div>
              <footer className="modal__footer">
                <button
                  className="button"
                  type="button"
                  onClick={() => setFileDialog(null)}
                >
                  Cancel
                </button>
                <button className="button button--primary" type="submit">
                  {fileDialog.type === "new" ? "Create file" : "Save filename"}
                </button>
              </footer>
            </form>
          )}
        </Dialog>
      )}
    </main>
  );
}
