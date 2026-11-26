import { useRef, useState } from "react";
import CodeEditor from "./CodeEditor";
import TerminalPanel from "./TerminalPanel";
import useCodeRunner from "../hooks/useCodeRunner";
import { downloadFile, EXTENSIONS } from "../lib/project";
import { emptyHistory, recordEdit, redoEdit, undoEdit } from "../lib/editor";

export default function EditorPanel({
  file,
  files,
  onSelect,
  settings,
  onChange,
  notify,
}) {
  const [copying, setCopying] = useState(false);
  const [cursorState, setCursorState] = useState(null);
  const runRef = useRef(null);
  const histories = useRef(new Map());
  const [, setHistoryVersion] = useState(0);
  const runner = useCodeRunner();
  const history = (file && histories.current.get(file.id)) || emptyHistory();
  const cursor =
    cursorState?.fileId === file?.id ? cursorState : { line: 1, column: 1 };

  function saveHistory(next) {
    histories.current.set(file.id, next);
    setHistoryVersion((value) => value + 1);
  }
  function edit(code) {
    saveHistory(recordEdit(history, file.code));
    onChange(code);
  }
  function step(direction) {
    const result = (direction === "undo" ? undoEdit : redoEdit)(
      history,
      file.code,
    );
    if (!result) return;
    saveHistory(result.history);
    onChange(result.code);
  }
  function handleKeys(event) {
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (mod && key === "enter") {
      event.preventDefault();
      runRef.current?.();
    } else if (mod && key === "z") {
      event.preventDefault();
      step(event.shiftKey ? "redo" : "undo");
    } else if (mod && key === "y") {
      event.preventDefault();
      step("redo");
    }
  }
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
      <div className="file-tabs" aria-label="Open files">
        {files.map((item) => (
          <button
            key={item.id}
            className="file-tab"
            aria-current={item.id === file?.id ? "true" : undefined}
            onClick={() => onSelect(item.id)}
          >
            <span className="file-icon">{EXTENSIONS[item.language]}</span>
            {item.name}
          </button>
        ))}
      </div>
      {file ? (
        <>
          <div className="editor-body">
            <CodeEditor
              key={file.id}
              code={file.code}
              onChange={edit}
              onCursor={(position) =>
                setCursorState({ ...position, fileId: file.id })
              }
              onKeyDown={handleKeys}
              fontSize={settings.fontSize}
              wordWrap={settings.wordWrap}
              label={`Code editor: ${file.name}`}
              searchable
              actions={({ selectAll }) => (
                <div className="tool-group" aria-label="Editor actions">
                  <button
                    onClick={() => step("undo")}
                    disabled={!history.past.length}
                    title="Undo (Ctrl+Z)"
                  >
                    Undo
                  </button>
                  <button
                    onClick={() => step("redo")}
                    disabled={!history.future.length}
                    title="Redo (Ctrl+Shift+Z)"
                  >
                    Redo
                  </button>
                  <button onClick={selectAll} disabled={!file.code}>
                    Select all
                  </button>
                  <button disabled={copying} onClick={copy}>
                    Copy
                  </button>
                  <button
                    title={`Download ${file.name}`}
                    onClick={() => {
                      downloadFile(file);
                      notify(`Download started: ${file.name}`);
                    }}
                  >
                    Download
                  </button>
                </div>
              )}
            />
            <footer className="editor-footer">
              <span>
                {file.language} · {file.code.split("\n").length} lines
              </span>
              <span>
                Ln {cursor.line}, Col {cursor.column} · UTF-8
              </span>
            </footer>
          </div>
          <TerminalPanel file={file} runner={runner} runRef={runRef} />
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
