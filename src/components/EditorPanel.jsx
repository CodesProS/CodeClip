import { useState } from "react";
import CodeEditor from "./CodeEditor";
import { downloadFile } from "../lib/project";

export default function EditorPanel({
  file,
  settings,
  onChange,
  onSettings,
  notify,
}) {
  const [copying, setCopying] = useState(false);
  async function copy() {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(file.code);
      notify("Code copied.");
    } catch {
      notify("Copy was unavailable. Select the code and copy it manually.");
    } finally {
      setCopying(false);
    }
  }
  return (
    <section className="editor-panel" aria-label="File editor">
      <div className="section-bar">
        <div>
          <strong>Code editor</strong>
          <span>{file?.name || "No file selected"}</span>
        </div>
        <button className="text-button" onClick={onSettings}>
          Editor settings
        </button>
      </div>
      {file ? (
        <>
          <div className="editor-actions">
            <span className="language-badge">{file.language}</span>
            <button
              className="button button--small"
              disabled={copying}
              onClick={copy}
            >
              Copy code
            </button>
            <button
              className="button button--small"
              onClick={() => {
                downloadFile(file);
                notify(`Download started: ${file.name}`);
              }}
            >
              Download file
            </button>
          </div>
          <CodeEditor
            key={file.id}
            code={file.code}
            onChange={onChange}
            fontSize={settings.fontSize}
            wordWrap={settings.wordWrap}
            searchable
          />
          <footer className="editor-footer">
            <span>
              {file.code.split("\n").length} lines · {file.code.length}{" "}
              characters
            </span>
            <span>UTF-8 · Plain text</span>
          </footer>
        </>
      ) : (
        <div className="empty-state">
          <strong>Your code belongs here.</strong>
          <p>Create a file or review a capture to get started.</p>
        </div>
      )}
    </section>
  );
}
