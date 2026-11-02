import { useState } from "react";
import Dialog from "./Dialog";
import CodeEditor from "./CodeEditor";
import {
  EXTENSIONS,
  LANGUAGES,
  proposeMerge,
  unusedFilename,
  validateName,
} from "../lib/project";

export default function ReviewDialog({
  capture,
  project,
  settings,
  onSave,
  onClose,
}) {
  const [filename, setFilename] = useState(() =>
    unusedFilename(project.files, capture.filename),
  );
  const [language, setLanguage] = useState(
    capture.language || project.language,
  );
  const [code, setCode] = useState(capture.code);
  const [mode, setMode] = useState("new");
  const [targetId, setTargetId] = useState(
    project.selectedFileId || project.files[0]?.id || "",
  );
  const [editedProposal, setEditedProposal] = useState(null);
  const [error, setError] = useState("");
  const target = project.files.find((file) => file.id === targetId);
  const suggestion = proposeMerge(target?.code || "", code);
  const proposed = editedProposal ?? suggestion.code;
  const mismatch = mode === "merge" && target && target.language !== language;

  function submit(event) {
    event.preventDefault();
    const message = !code.trim()
      ? "Add some code before saving this capture."
      : mode === "new"
        ? validateName(filename, project.files, null, true)
        : !target
          ? "Choose a target file."
          : mismatch
            ? "The capture and target file must use the same language."
            : !proposed.trim()
              ? "The proposed file is empty."
              : "";
    setError(message);
    if (!message)
      onSave({
        filename: filename.trim(),
        language,
        code,
        targetId: mode === "merge" ? targetId : null,
        proposedCode: proposed,
      });
  }

  function changeLanguage(value) {
    setLanguage(value);
    setFilename(
      unusedFilename(
        project.files,
        `${filename.replace(/\.[^.]+$/, "")}.${EXTENSIONS[value]}`,
      ),
    );
    setEditedProposal(null);
    setError("");
  }

  return (
    <Dialog title="Review capture" onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="review-meta">
          <span className="status-chip">
            {capture.sourceType === "demo"
              ? "Preset sample"
              : "Manual transcription"}
          </span>
          <label className="field">
            Capture language
            <select
              value={language}
              onChange={(event) => changeLanguage(event.target.value)}
            >
              {LANGUAGES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="review-grid">
          <section className="review-pane">
            <h3>Source · {capture.label}</h3>
            {capture.imageUrl ? (
              <img
                className="review-image"
                src={capture.imageUrl}
                alt="Screenshot to transcribe"
              />
            ) : capture.sourceType === "youtube" ? (
              <div className="modal__body">
                <p>Open your video reference and add its code on the right.</p>
                {capture.reference && (
                  <a href={capture.reference} target="_blank" rel="noreferrer">
                    Open video reference ↗
                  </a>
                )}
              </div>
            ) : capture.sourceType === "demo" ? (
              <pre className="source-code">
                {capture.sourceCode || capture.code}
              </pre>
            ) : (
              <div className="modal__body">
                <p>Original image: {capture.reference || capture.label}</p>
                <p className="hint">
                  Image previews are session only. Your saved transcription is
                  on the right.
                </p>
              </div>
            )}
          </section>
          <section className="review-pane">
            <h3>Review extracted / transcribed code</h3>
            <CodeEditor
              code={code}
              onChange={(value) => {
                setCode(value);
                setEditedProposal(null);
                setError("");
              }}
              fontSize={settings.fontSize}
              wordWrap={settings.wordWrap}
              label="Reviewed code"
            />
          </section>
        </div>
        <div className="modal__body stack">
          <fieldset className="save-options">
            <legend>Where should this code go?</legend>
            <label>
              <input
                type="radio"
                name="save-mode"
                value="new"
                checked={mode === "new"}
                onChange={() => {
                  setMode("new");
                  setError("");
                }}
              />{" "}
              New file
            </label>
            <label>
              <input
                type="radio"
                name="save-mode"
                value="merge"
                checked={mode === "merge"}
                disabled={!project.files.length}
                onChange={() => {
                  setMode("merge");
                  setError("");
                }}
              />{" "}
              Update existing file
            </label>
          </fieldset>
          {mode === "new" ? (
            <label className="field">
              Filename
              <input
                value={filename}
                maxLength={80}
                onChange={(event) => {
                  setFilename(event.target.value);
                  setError("");
                }}
              />
            </label>
          ) : (
            <>
              <label className="field">
                Target file
                <select
                  value={targetId}
                  onChange={(event) => {
                    setTargetId(event.target.value);
                    setEditedProposal(null);
                    setError("");
                  }}
                >
                  {project.files.map((file) => (
                    <option key={file.id} value={file.id}>
                      {file.name} ({file.language})
                    </option>
                  ))}
                </select>
              </label>
              {mismatch && (
                <p className="error-text">
                  This capture is {language}; the target is {target.language}.
                  Choose a matching file or correct the capture language.
                </p>
              )}
              <p className="hint">
                {suggestion.unchanged
                  ? "The candidate adds no new trailing code."
                  : `${suggestion.overlap} exact overlapping lines skipped at the boundary.`}{" "}
                Check both versions. This simple merge cannot resolve changed or
                reordered code.
              </p>
              <div className="action-row">
                <button
                  type="button"
                  className="button button--small"
                  onClick={() => setEditedProposal(suggestion.code)}
                >
                  Reset append preview
                </button>
                <button
                  type="button"
                  className="button button--small"
                  onClick={() => setEditedProposal(code)}
                >
                  Preview full replacement
                </button>
              </div>
              <div className="review-grid merge-grid">
                <section className="review-pane">
                  <h3>Current file · {target?.name}</h3>
                  <pre className="source-code">{target?.code}</pre>
                </section>
                <section className="review-pane">
                  <h3>Proposed file · editable</h3>
                  <CodeEditor
                    code={proposed}
                    onChange={setEditedProposal}
                    label="Proposed merged code"
                    fontSize={settings.fontSize}
                    wordWrap={settings.wordWrap}
                  />
                </section>
              </div>
            </>
          )}
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
        </div>
        <footer className="modal__footer">
          <button type="button" className="button" onClick={onClose}>
            Discard review
          </button>
          <button
            type="submit"
            className="button button--primary"
            disabled={mismatch}
          >
            {mode === "new" ? "Save as new file" : "Accept proposed changes"}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
