import { useRef, useState } from "react";
import { cursorPosition } from "../lib/editor";

export default function CodeEditor({
  code,
  onChange,
  fontSize = 14,
  wordWrap = false,
  label = "Code editor",
  searchable = false,
  actions,
  onCursor,
  onKeyDown,
}) {
  const textarea = useRef(null);
  const gutter = useRef(null);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");
  function reportCursor(input) {
    onCursor?.(cursorPosition(input.value, input.selectionStart));
  }
  function selectAll() {
    textarea.current.focus();
    textarea.current.select();
  }
  function findNext(event) {
    event.preventDefault();
    if (!query) return;
    const input = textarea.current;
    const lower = code.toLowerCase();
    let index = lower.indexOf(query.toLowerCase(), input.selectionEnd);
    if (index === -1) index = lower.indexOf(query.toLowerCase());
    if (index === -1) {
      setResult("No matches");
      return;
    }
    input.focus();
    input.setSelectionRange(index, index + query.length);
    input.scrollTop = Math.max(
      0,
      (code.slice(0, index).split("\n").length - 3) * fontSize * 1.6,
    );
    reportCursor(input);
    setResult(`Line ${code.slice(0, index).split("\n").length}`);
  }
  return (
    <div className="code-editor-wrap">
      {searchable && (
        <div className="code-toolbar">
          <form className="find-form" onSubmit={findNext} role="search">
            <label className="find-field">
              <span>Find</span>
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setResult("");
                }}
                placeholder="Search in code"
              />
            </label>
            <button
              type="submit"
              className="find-next"
              disabled={!query}
              aria-label="Find next match"
              title="Find next (Enter)"
            >
              ↵
            </button>
            <span className="find-result" role="status">
              {result}
            </span>
          </form>
          {actions?.({ selectAll })}
        </div>
      )}
      <div className="code-editor" style={{ fontSize }}>
        {!wordWrap && (
          <div ref={gutter} className="line-numbers" aria-hidden="true">
            {code.split("\n").map((_, index) => (
              <span key={index}>{index + 1}</span>
            ))}
          </div>
        )}
        <textarea
          ref={textarea}
          aria-label={label}
          value={code}
          onChange={(event) => {
            onChange(event.target.value);
            setResult("");
          }}
          onSelect={(event) => reportCursor(event.target)}
          onKeyDown={onKeyDown}
          wrap={wordWrap ? "soft" : "off"}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          onScroll={(event) => {
            if (gutter.current)
              gutter.current.scrollTop = event.target.scrollTop;
          }}
        />
      </div>
    </div>
  );
}
