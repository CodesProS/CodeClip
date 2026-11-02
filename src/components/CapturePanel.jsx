import { useEffect, useRef, useState } from "react";
import { EXTENSIONS, extractDemo, formatDate, SAMPLES } from "../lib/project";

export default function CapturePanel({ project, onReview }) {
  const [tab, setTab] = useState("sample");
  const [sampleId, setSampleId] = useState(SAMPLES[0].id);
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imageError, setImageError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [youtube, setYoutube] = useState("");
  const [timestamp, setTimestamp] = useState("00:00");
  const [reference, setReference] = useState("");
  const pending = useRef(null);
  const sample = SAMPLES.find((item) => item.id === sampleId);

  useEffect(() => {
    if (!imageFile) {
      setImageUrl("");
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);
  useEffect(() => () => pending.current?.abort(), []);

  function chooseImage(file) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setImageError("Choose a PNG, JPG, or WebP image.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setImageError("Choose an image smaller than 8 MB.");
      return;
    }
    setImageError("");
    setImageFile(file);
  }

  async function loadSample() {
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError("");
    try {
      const result = await extractDemo(sampleId, controller.signal);
      onReview({
        label: result.title,
        filename: result.filename,
        language: "JavaScript",
        code: result.code,
        sourceType: "demo",
        sourceCode: result.code,
      });
    } catch (problem) {
      if (problem.name !== "AbortError") setError(problem.message);
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }

  function openReference(event) {
    event.preventDefault();
    setError("");
    try {
      const url = new URL(youtube);
      const host = url.hostname.toLowerCase();
      if (
        url.protocol !== "https:" ||
        ![
          "youtube.com",
          "www.youtube.com",
          "m.youtube.com",
          "youtu.be",
        ].includes(host)
      )
        throw new Error();
      const id =
        host === "youtu.be"
          ? url.pathname.slice(1)
          : url.searchParams.get("v") ||
            url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)$/)?.[1];
      if (!/^[\w-]{11}$/.test(id || "")) throw new Error();
      const parts = timestamp.trim().match(/^(\d{1,3}):([0-5]\d)$/);
      if (!parts) {
        setError("Use a timestamp such as 03:42 (minutes:seconds).");
        return;
      }
      setReference(
        `https://www.youtube.com/watch?v=${id}&t=${Number(parts[1]) * 60 + Number(parts[2])}s`,
      );
    } catch {
      setError("Enter a valid HTTPS YouTube video URL.");
    }
  }

  function changeTab(next) {
    pending.current?.abort();
    setTab(next);
    setError("");
  }
  return (
    <section className="source-panel" aria-label="Source capture">
      <div className="section-bar">
        <div>
          <strong>Source capture</strong>
          <span>Bring a tutorial into your workspace</span>
        </div>
        <span className="status-chip">Local workspace</span>
      </div>
      <div className="source-tabs" role="group" aria-label="Capture source">
        {[
          ["sample", "Samples"],
          ["image", "Screenshot"],
          ["youtube", "YouTube reference"],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-pressed={tab === id}
            onClick={() => changeTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="capture-content">
        {tab === "sample" && (
          <>
            <label className="field">
              Choose a JavaScript sample
              <select
                value={sampleId}
                disabled={busy}
                onChange={(event) => setSampleId(event.target.value)}
              >
                {SAMPLES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="mock-screenshot">
              <div className="mock-window-bar">
                <i />
                <i />
                <i />
                <span>{sample.filename}</span>
              </div>
              <pre>{sample.code}</pre>
            </div>
            <p className="hint">
              Demo extraction uses preset code, so you can try the review
              workflow without OCR.
            </p>
            <div className="action-row">
              <button
                className="button button--primary"
                disabled={busy}
                onClick={loadSample}
              >
                {busy ? "Loading sample…" : "Review sample code"}
              </button>
              {busy && (
                <button
                  className="button"
                  onClick={() => pending.current?.abort()}
                >
                  Cancel loading
                </button>
              )}
            </div>
          </>
        )}
        {tab === "image" && (
          <>
            <label
              className="drop-zone"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                chooseImage(event.dataTransfer.files[0]);
              }}
            >
              <strong>Drop a screenshot here</strong>
              <span>or choose a file · PNG, JPG, WebP · up to 8 MB</span>
              <input
                aria-label="Choose screenshot"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  chooseImage(event.target.files[0]);
                  event.target.value = "";
                }}
              />
            </label>
            {imageError && (
              <p className="error-text" role="alert">
                {imageError}
              </p>
            )}
            {imageUrl && (
              <div className="upload-preview">
                <img
                  src={imageUrl}
                  alt={`Code screenshot: ${imageFile.name}`}
                  onError={() => {
                    setImageError(
                      "This image could not be displayed. Choose a different file.",
                    );
                    setImageFile(null);
                  }}
                />
                <span>{imageFile.name}</span>
              </div>
            )}
            <p className="hint">
              OCR is planned for a later milestone. Open the review to type or
              paste code beside your screenshot. The image preview stays in this
              session only.
            </p>
            <button
              className="button button--primary"
              disabled={!imageUrl}
              onClick={() =>
                onReview({
                  label: imageFile.name,
                  filename: `capture.${EXTENSIONS[project.language]}`,
                  language: project.language,
                  code: "",
                  sourceType: "image",
                  imageUrl,
                  reference: imageFile.name,
                })
              }
            >
              Transcribe screenshot
            </button>
          </>
        )}
        {tab === "youtube" && (
          <>
            <form className="stack" onSubmit={openReference}>
              <label className="field">
                YouTube URL
                <input
                  type="url"
                  required
                  value={youtube}
                  onChange={(event) => {
                    setYoutube(event.target.value);
                    setReference("");
                  }}
                  placeholder="https://www.youtube.com/watch?v=…"
                />
              </label>
              <label className="field">
                Timestamp (MM:SS)
                <input
                  value={timestamp}
                  onChange={(event) => {
                    setTimestamp(event.target.value);
                    setReference("");
                  }}
                  placeholder="03:42"
                />
              </label>
              <button className="button" type="submit">
                Prepare reference
              </button>
            </form>
            <p className="hint">
              Save the video link and manually add the code. Frame extraction is
              planned for later.
            </p>
            {reference && (
              <div className="reference-box">
                <a href={reference} target="_blank" rel="noreferrer">
                  Open video at {timestamp} ↗
                </a>
                <button
                  className="button button--primary"
                  onClick={() =>
                    onReview({
                      label: `YouTube at ${timestamp}`,
                      filename: `video-notes.${EXTENSIONS[project.language]}`,
                      language: project.language,
                      code: "",
                      sourceType: "youtube",
                      reference,
                    })
                  }
                >
                  Add code from video
                </button>
              </div>
            )}
          </>
        )}
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="capture-history">
        <h3>
          Capture history{" "}
          <span className="hint">{project.captures.length}</span>
        </h3>
        <p className="hint">
          Saved code and source references. Reopen a capture to review it.
        </p>
        {!project.captures.length && (
          <p className="hint">Your saved captures will appear here.</p>
        )}
        <div className="capture-history__items">
          {project.captures.map((capture) => (
            <button
              key={capture.id}
              onClick={() => onReview({ ...capture, sourceCode: capture.code })}
            >
              <span className="capture-thumb">
                {capture.sourceType === "demo"
                  ? "JS"
                  : capture.sourceType === "image"
                    ? "IMG"
                    : "VID"}
              </span>
              <span>
                <strong>{capture.label}</strong>
                <small>
                  {capture.filename} · {formatDate(capture.createdAt)}
                </small>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
