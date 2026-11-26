import { useEffect, useRef, useState } from "react";
import { LANGUAGES } from "../lib/project";
import { RUNNABLE_LANGUAGES } from "../lib/runner";

const STATUS_LABELS = {
  ready: "Ready",
  loading: "Loading",
  running: "Running",
  done: "Finished",
  error: "Error",
  stopped: "Stopped",
};

export default function TerminalPanel({ file, runner, runRef }) {
  const runnable = (language) => RUNNABLE_LANGUAGES.includes(language);
  const [language, setLanguage] = useState(() =>
    runnable(file.language) ? file.language : "JavaScript",
  );
  const [showInput, setShowInput] = useState(false);
  const [stdin, setStdin] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const log = useRef(null);
  const mismatch = language !== file.language;

  useEffect(() => {
    setLanguage(runnable(file.language) ? file.language : "JavaScript");
  }, [file.id, file.language]);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [runner.output]);

  function run() {
    if (runner.busy || !file.code.trim() || !runnable(language)) return;
    setCollapsed(false);
    runner.run({ language, code: file.code, stdin, filename: file.name });
  }
  // Lets the editor start a run with Ctrl+Enter.
  runRef.current = run;

  return (
    <section className="terminal" aria-label="Run code">
      <header className="terminal__head">
        <div>
          <h2>Run Code</h2>
          <p className="hint">Runs JavaScript and Python in your browser</p>
        </div>
        <span className={`run-status run-status--${runner.status}`}>
          <i aria-hidden="true" />
          {STATUS_LABELS[runner.status]}
        </span>
      </header>
      <div className="terminal__controls">
        <label className="terminal__language">
          <span>Language</span>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            {LANGUAGES.filter((item) => item !== "Text").map((item) => (
              <option key={item} value={item} disabled={!runnable(item)}>
                {item}
                {runnable(item) ? "" : " (not available yet)"}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button button--primary terminal__run"
          onClick={run}
          disabled={runner.busy || !file.code.trim() || !runnable(language)}
          title="Run (Ctrl+Enter in the editor)"
        >
          Run
        </button>
        <button
          className="button"
          onClick={runner.stop}
          disabled={!runner.busy}
        >
          Stop
        </button>
        <button
          className="text-button terminal__input-toggle"
          aria-expanded={showInput}
          aria-controls="program-input"
          onClick={() => setShowInput((value) => !value)}
        >
          {showInput ? "− Program input" : "+ Program input"}
        </button>
      </div>
      {(mismatch || !runnable(file.language)) && (
        <p className="terminal__note" role="note">
          {runnable(file.language)
            ? `This file is ${file.language}; it will run as ${language}.`
            : `${file.language} files cannot run in the browser yet. Only JavaScript and Python are supported.`}
        </p>
      )}
      {showInput && (
        <label className="terminal__stdin" id="program-input">
          <span>
            Program input — one line per <code>input()</code> or{" "}
            <code>prompt()</code> call
          </span>
          <textarea
            value={stdin}
            rows={3}
            spellCheck={false}
            onChange={(event) => setStdin(event.target.value)}
          />
        </label>
      )}
      <div className="terminal__console-bar">
        <strong>Output console</strong>
        <button
          className="text-button"
          aria-expanded={!collapsed}
          aria-controls="terminal-output"
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? "Expand" : "Collapse"}
        </button>
        <button
          className="text-button terminal__clear"
          onClick={runner.clear}
          disabled={!runner.output.length}
        >
          Clear output
        </button>
      </div>
      {!collapsed && (
        <div
          ref={log}
          id="terminal-output"
          className="terminal__output"
          role="log"
          aria-label="Program output"
          tabIndex={0}
        >
          {runner.output.length ? (
            runner.output.map((line) => (
              <div key={line.id} className={`out out--${line.stream}`}>
                {line.text}
              </div>
            ))
          ) : (
            <div className="out out--system">
              No output yet. Choose a language and run the current file.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
