import { useRef, useState } from "react";

export default function CodeEditor({
  code,
  onChange,
  fontSize = 14,
  wordWrap = false,
  label = "Code editor",
  searchable = false,
}) {
  const textarea = useRef(null);
  const gutter = useRef(null);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");
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
    setResult(`Match on line ${code.slice(0, index).split("\n").length}`);
  }
  return (
    <div className="code-editor-wrap">
      {searchable && (
        <form className="code-toolbar" onSubmit={findNext}>
          <label className="find-label">
            Find
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setResult("");
              }}
              placeholder="Search this file"
            />
          </label>
          <button
            type="submit"
            className="button button--small"
            disabled={!query}
          >
            Next match
          </button>
          <button
            type="button"
            className="button button--small"
            onClick={() => {
              textarea.current.focus();
              textarea.current.select();
            }}
            disabled={!code}
          >
            Select all code
          </button>
          <span className="hint" role="status">
            {result}
          </span>
        </form>
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
