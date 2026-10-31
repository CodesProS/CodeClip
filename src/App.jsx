import { useEffect, useMemo, useRef, useState } from "react";

/*
 * Data shapes used throughout this file (kept as a reference now that the
 * project is plain JavaScript):
 *
 * Project (dashboard card):  { id, name, language, updated }
 * File:                      { name, code }
 * Project data:              { files: File[], selectedFile, captureHistory: Capture[] }
 * Capture (history item):    { id, label, filename, time, code, demoId, sourceType }
 *   - demoId:     "greeting" | "updated" | "farewell" | "addition"
 *   - sourceType: "upload" | "youtube"
 *
 * `modal` holds the name of the open dialog ("create", "capture", "review",
 * "merge", "settings", "rename", "delete", "guide", "download", ...) or null.
 */

const STORAGE_KEY = "codeclip.prototype.v1";

const GREET_CODE = `def greet(name):
    return f"Hello, {name}!"

print(greet("Ada"))`;

const UPDATED_GREET_CODE = `def greet(name):
    return f"Hello, {name}!"

print(greet("VP"))`;

const FAREWELL_CODE = `def farewell(name):
    return f"Goodbye, {name}!"

print(farewell("VP"))`;

const ADDITION_CODE = `a = 4
b = 6
print(a + b)`;

const SAMPLE_MERGED_CODE = `${UPDATED_GREET_CODE}

def farewell(name):
    return f"Goodbye, {name}!"

print(farewell("VP"))`;

const DEMO_CAPTURES = [
  {
    id: "greeting",
    title: "Greeting",
    filename: "greeting.py",
    detail: 'greet("Ada")',
    code: GREET_CODE,
  },
  {
    id: "updated",
    title: "Updated greeting",
    filename: "updated-greeting.py",
    detail: 'greet("VP")',
    code: UPDATED_GREET_CODE,
  },
  {
    id: "farewell",
    title: "Additional code",
    filename: "farewell.py",
    detail: "farewell(name)",
    code: FAREWELL_CODE,
  },
  {
    id: "addition",
    title: "Addition",
    filename: "addition.py",
    detail: "print(a + b)",
    code: ADDITION_CODE,
  },
];

const getDemoCapture = (id) =>
  DEMO_CAPTURES.find((capture) => capture.id === id) ?? DEMO_CAPTURES[0];

const SAMPLE_PROJECT = {
  id: 1,
  name: "Python Tutorial",
  language: "Python",
  updated: "Today, 10:24 AM",
};

const STARTER_HISTORY = [
  {
    id: 1,
    label: "Greeting",
    filename: "greeting.py",
    time: "10:24",
    code: GREET_CODE,
    demoId: "greeting",
    sourceType: "upload",
  },
];

const STARTER_DATA = {
  files: [{ name: "main.py", code: GREET_CODE }],
  selectedFile: "main.py",
  captureHistory: STARTER_HISTORY,
};

function loadStored() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.projects) && parsed.data && typeof parsed.data === "object") {
        return parsed;
      }
    }
  } catch {
    // Storage unavailable or corrupt; fall back to the starter project.
  }
  return { projects: [SAMPLE_PROJECT], data: { [SAMPLE_PROJECT.id]: STARTER_DATA } };
}

const nameTaken = (files, name, ignore) =>
  files.some((file) => file.name !== ignore && file.name.toLowerCase() === name.toLowerCase());

function nextUntitledName(files) {
  let index = files.length + 1;
  while (nameTaken(files, `untitled-${index}.py`)) index += 1;
  return `untitled-${index}.py`;
}

// Mock merge: skips blocks already present, swaps a lone call line for the same function, appends the rest.
function buildMock(target, incoming) {
  if (!target.trim()) return incoming;
  const lines = target.replace(/\s+$/, "").split("\n");
  const appended = [];
  for (const block of incoming
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)) {
    if (lines.join("\n").includes(block) || appended.includes(block)) continue;
    const fn = !block.includes("\n") && block.match(/^print\(\s*(\w+)\(/)?.[1];
    let at = -1;
    if (fn) {
      lines.forEach((line, index) => {
        if (new RegExp(`^\\s*print\\(\\s*${fn}\\(`).test(line)) at = index;
      });
    }
    if (at >= 0) lines[at] = block;
    else appended.push(block);
  }
  return [lines.join("\n"), ...appended].join("\n\n");
}

const GUIDE_STEPS = [
  "Create or open a project.",
  "Upload a screenshot OR enter a YouTube URL and timestamp.",
  "Preview the source and click Extract Code.",
  "Compare and edit the extracted code.",
  "Save as a new file OR merge into an existing file.",
  "Review changes before accepting a merge.",
  "Run the code and inspect output.",
  "Download a file or project ZIP.",
];

function Button({ children, variant = "secondary", disabled, onClick, type = "button" }) {
  return (
    <button
      className={`button button--${variant}`}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  );
}

function TopActions({ theme, onToggleTheme, onOpenGuide }) {
  return (
    <div className="top-actions">
      <button
        aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        className="theme-toggle"
        onClick={onToggleTheme}
      >
        <span aria-hidden="true">{theme === "light" ? "☼" : "◐"}</span>
        Light / Dark
      </button>
      <button className="guide-button" onClick={onOpenGuide}>
        <span aria-hidden="true">?</span>
        Demo Guide
      </button>
    </div>
  );
}

function ModalShell({ title, children, onClose, wide = false }) {
  return (
    <div className="modal-overlay" role="presentation" onMouseDown={onClose}>
      <section
        aria-label={title}
        aria-modal="true"
        className={`modal ${wide ? "modal--wide" : ""}`}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="modal__header">
          <h2>{title}</h2>
          <button aria-label="Close" className="icon-button" onClick={onClose}>
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function CodeBlock({
  code,
  editable = false,
  onChange,
  lineNumbers = true,
  fontSize = 14,
  wordWrap = false,
  highlightedLines = [],
  overlapLines = [],
}) {
  const lines = code.split("\n");

  if (editable) {
    return (
      <div className="code-editor" style={{ fontSize }}>
        {lineNumbers && (
          <div className="line-numbers" aria-hidden="true">
            {lines.map((_, index) => (
              <span key={index}>{index + 1}</span>
            ))}
          </div>
        )}
        <textarea
          aria-label="Editable code"
          className={wordWrap ? "wrap" : ""}
          onChange={(event) => onChange?.(event.target.value)}
          spellCheck={false}
          value={code}
        />
      </div>
    );
  }

  return (
    <div className="code-block" style={{ fontSize }}>
      {lines.map((line, index) => {
        const lineNumber = index + 1;
        return (
          <div
            className={`code-line ${
              highlightedLines.includes(lineNumber) ? "code-line--added" : ""
            } ${overlapLines.includes(lineNumber) ? "code-line--overlap" : ""}`}
            key={index}
          >
            {lineNumbers && <span className="code-line__number">{lineNumber}</span>}
            <code>{line || " "}</code>
            {overlapLines.includes(lineNumber) && <span className="line-label">overlap</span>}
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState("dashboard");
  const [modal, setModal] = useState(null);
  const [projectName, setProjectName] = useState("Python Tutorial");
  const [stored] = useState(loadStored);
  const [projects, setProjects] = useState(stored.projects);
  const [projectData, setProjectData] = useState(stored.data);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [mergeTarget, setMergeTarget] = useState(null);
  const [nameError, setNameError] = useState("");
  const [downloadedNames, setDownloadedNames] = useState([]);
  const [downloadKind, setDownloadKind] = useState("file");
  const [projectSearch, setProjectSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("All languages");
  const [projectSort, setProjectSort] = useState("Recently Updated");
  const [projectMenu, setProjectMenu] = useState(null);
  const [targetProject, setTargetProject] = useState(null);
  const [newProjectName, setNewProjectName] = useState("Untitled Project");
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [captureTab, setCaptureTab] = useState("upload");
  const [sourceTab, setSourceTab] = useState("upload");
  const [uploadName, setUploadName] = useState("");
  const [uploadPreview, setUploadPreview] = useState("");
  const [sourcePreviewMode, setSourcePreviewMode] = useState("demo");
  const [selectedDemoCapture, setSelectedDemoCapture] = useState("greeting");
  const [pendingCapture, setPendingCapture] = useState("greeting");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [timestamp, setTimestamp] = useState("03:42");
  const [frameReady, setFrameReady] = useState(false);
  const [reviewCode, setReviewCode] = useState(GREET_CODE);
  const [reviewFilename, setReviewFilename] = useState("main.py");
  const [language, setLanguage] = useState("Python");
  const [mergeCode, setMergeCode] = useState(GREET_CODE);
  const [theme, setTheme] = useState("light");
  const [fontSize, setFontSize] = useState(14);
  const [draftFontSize, setDraftFontSize] = useState(14);
  const [lineNumbers, setLineNumbers] = useState(true);
  const [draftLineNumbers, setDraftLineNumbers] = useState(true);
  const [wordWrap, setWordWrap] = useState(false);
  const [draftWordWrap, setDraftWordWrap] = useState(false);
  const [downloadSelection, setDownloadSelection] = useState([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [fileMenu, setFileMenu] = useState(null);
  const [dirtyFiles, setDirtyFiles] = useState([]);
  const [codeSearch, setCodeSearch] = useState("");
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [zoom, setZoom] = useState(100);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [captureHistory, setCaptureHistory] = useState(STARTER_HISTORY);
  const [activeCapture, setActiveCapture] = useState(1);
  const [sourceWidth, setSourceWidth] = useState(47);
  const [resizing, setResizing] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const [runLanguage, setRunLanguage] = useState("Python");
  const [runStatus, setRunStatus] = useState("Ready");
  const [runOutput, setRunOutput] = useState("");
  const [programInput, setProgramInput] = useState("");
  const [inputExpanded, setInputExpanded] = useState(false);
  const runTimers = useRef([]);

  const currentFile = useMemo(
    () => files.find((file) => file.name === selectedFile) ?? null,
    [files, selectedFile],
  );
  const visibleProjects = useMemo(() => {
    const query = projectSearch.trim().toLowerCase();
    const filtered = projects.filter(
      (project) =>
        (!query || project.name.toLowerCase().includes(query)) &&
        (projectFilter === "All languages" || project.language === projectFilter),
    );
    return projectSort === "Name"
      ? [...filtered].sort((a, b) => a.name.localeCompare(b.name))
      : filtered;
  }, [projectFilter, projectSearch, projectSort, projects]);

  useEffect(() => {
    if (modal !== "processing") return;
    const timer = window.setTimeout(() => {
      const capture = getDemoCapture(pendingCapture);
      setReviewCode(capture.code);
      setReviewFilename(files.length ? capture.filename : "main.py");
      setNameError("");
      setModal("review");
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [modal, files.length, pendingCapture]);

  useEffect(() => {
    return () => runTimers.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  useEffect(() => {
    if (screen !== "workspace" || activeProjectId === null) return;
    setProjectData((current) => ({
      ...current,
      [activeProjectId]: { files, selectedFile, captureHistory },
    }));
  }, [screen, activeProjectId, files, selectedFile, captureHistory]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ projects, data: projectData }));
    } catch {
      // Storage unavailable; state still lives in memory.
    }
  }, [projects, projectData]);

  function resetWorkspaceView() {
    setUploadName("");
    setUploadPreview("");
    setSourcePreviewMode("demo");
    setSelectedDemoCapture("greeting");
    setZoom(100);
    setDirtyFiles([]);
    setUndoStack([]);
    setRedoStack([]);
    setRunOutput("");
    setRunStatus("Ready");
    setNameError("");
  }

  function openExistingProject(project = projects[0] ?? SAMPLE_PROJECT) {
    const data = projectData[project.id] ?? { files: [], selectedFile: null, captureHistory: [] };
    const selected = data.files.some((file) => file.name === data.selectedFile)
      ? data.selectedFile
      : (data.files[0]?.name ?? null);
    setActiveProjectId(project.id);
    setProjectName(project.name);
    setFiles(data.files);
    setSelectedFile(selected);
    setCaptureHistory(data.captureHistory);
    setLanguage("Python");
    setRunLanguage("Python");
    resetWorkspaceView();
    setScreen("workspace");
  }

  function createProject() {
    const name = newProjectName.trim() || "Untitled Project";
    const project = {
      id: Date.now(),
      name,
      language: "Python",
      updated: "Just now",
    };
    setProjects((current) => [project, ...current]);
    setProjectData((current) => ({
      ...current,
      [project.id]: { files: [], selectedFile: null, captureHistory: [] },
    }));
    setActiveProjectId(project.id);
    setProjectName(name);
    setFiles([]);
    setSelectedFile(null);
    setCaptureHistory([]);
    resetWorkspaceView();
    setModal(null);
    setScreen("workspace");
  }

  function startExtraction(captureType = sourceTab) {
    if (captureType === "upload" && sourcePreviewMode === "upload") {
      setStatusMessage("Preview only—real extraction unavailable. Choose a demo capture.");
      window.setTimeout(() => setStatusMessage(""), 2600);
      return;
    }
    const capture = getDemoCapture(selectedDemoCapture);
    const nextId = Date.now();
    setPendingCapture(capture.id);
    setCaptureHistory((current) => [
      ...current,
      {
        id: nextId,
        label: capture.title,
        filename: capture.filename,
        time: captureType === "youtube" ? timestamp : "Just now",
        code: capture.code,
        demoId: capture.id,
        sourceType: captureType,
      },
    ]);
    setActiveCapture(nextId);
    setModal("processing");
  }

  function simulateExtractionError() {
    setPendingCapture(selectedDemoCapture);
    setModal("error");
  }

  function saveNewFile() {
    const safeName = reviewFilename.trim() || "main.py";
    if (nameTaken(files, safeName)) {
      setNameError(safeName);
      return;
    }
    setFiles((current) => [...current, { name: safeName, code: reviewCode }]);
    selectActiveFile(safeName);
    setProjects((current) =>
      current.map((project) =>
        project.id === activeProjectId ? { ...project, updated: "Just now" } : project,
      ),
    );
    setModal(null);
    setStatusMessage(`Saved — ${safeName}`);
    window.setTimeout(() => setStatusMessage(""), 1800);
  }

  function acceptMerge() {
    if (!mergeTarget || !files.some((file) => file.name === mergeTarget)) return;
    setFiles((current) =>
      current.map((file) => (file.name === mergeTarget ? { ...file, code: mergeCode } : file)),
    );
    selectActiveFile(mergeTarget);
    setUndoStack([]);
    setRedoStack([]);
    setDirtyFiles((current) => current.filter((name) => name !== mergeTarget));
    markOutputOutdated();
    setProjects((current) =>
      current.map((project) =>
        project.id === activeProjectId ? { ...project, updated: "Just now" } : project,
      ),
    );
    setModal(null);
    setStatusMessage(`Merge accepted — updated ${mergeTarget}`);
    window.setTimeout(() => setStatusMessage(""), 2200);
  }

  function updateCurrentFile(code) {
    if (!selectedFile) return;
    if (currentFile) {
      setUndoStack((current) => [...current.slice(-19), currentFile.code]);
      setRedoStack([]);
    }
    setFiles((current) =>
      current.map((file) => (file.name === selectedFile ? { ...file, code } : file)),
    );
    setDirtyFiles((current) =>
      current.includes(selectedFile) ? current : [...current, selectedFile],
    );
    markOutputOutdated();
  }

  function selectActiveFile(name) {
    if (name !== selectedFile) {
      markOutputOutdated();
      setUndoStack([]);
      setRedoStack([]);
    }
    setSelectedFile(name);
    setFileMenu(null);
  }

  function markOutputOutdated() {
    if (!runOutput || runOutput.startsWith("Outdated—run again")) return;
    clearRunTimers();
    setRunOutput((current) => `Outdated—run again\n\n${current}`);
    setRunStatus("Ready");
  }

  function undoCode() {
    if (!selectedFile || !undoStack.length) return;
    const previous = undoStack[undoStack.length - 1];
    if (currentFile) setRedoStack((current) => [...current, currentFile.code]);
    setUndoStack((current) => current.slice(0, -1));
    setFiles((current) =>
      current.map((file) => (file.name === selectedFile ? { ...file, code: previous } : file)),
    );
    markOutputOutdated();
  }

  function redoCode() {
    if (!selectedFile || !redoStack.length) return;
    const next = redoStack[redoStack.length - 1];
    if (currentFile) setUndoStack((current) => [...current, currentFile.code]);
    setRedoStack((current) => current.slice(0, -1));
    setFiles((current) =>
      current.map((file) => (file.name === selectedFile ? { ...file, code: next } : file)),
    );
    markOutputOutdated();
  }

  function prepareMerge(preferred) {
    const target =
      files.find((file) => file.name === preferred) ??
      files.find((file) => file.name === selectedFile) ??
      files[0];
    if (!target) return;
    setMergeTarget(target.name);
    setMergeCode(buildMock(target.code, reviewCode));
    setModal("merge");
  }

  async function copyCode() {
    if (!currentFile) return;
    try {
      await navigator.clipboard.writeText(currentFile.code);
      setStatusMessage("Copied code");
      window.setTimeout(() => setStatusMessage(""), 1800);
    } catch {
      setStatusMessage("Couldn't copy automatically. Select the code and copy it manually.");
      window.setTimeout(() => setStatusMessage(""), 4000);
    }
  }

  function confirmRename() {
    if (!selectedFile) return;
    const nextName = renameValue.trim();
    if (!nextName) return;
    if (nextName === selectedFile) {
      setModal(null);
      return;
    }
    if (nameTaken(files, nextName, selectedFile)) {
      setNameError(nextName);
      return;
    }
    setFiles((current) =>
      current.map((file) => (file.name === selectedFile ? { ...file, name: nextName } : file)),
    );
    setDirtyFiles((current) => current.map((name) => (name === selectedFile ? nextName : name)));
    setSelectedFile(nextName);
    setModal(null);
    setStatusMessage(`Renamed to ${nextName}`);
    window.setTimeout(() => setStatusMessage(""), 1800);
  }

  function confirmDelete() {
    if (!selectedFile) return;
    const remaining = files.filter((file) => file.name !== selectedFile);
    setFiles(remaining);
    setDirtyFiles((current) => current.filter((name) => name !== selectedFile));
    setUndoStack([]);
    setRedoStack([]);
    setSelectedFile(remaining[0]?.name ?? null);
    markOutputOutdated();
    setModal(null);
    setStatusMessage("File deleted");
    window.setTimeout(() => setStatusMessage(""), 1800);
  }

  function handleUpload(file) {
    if (!file) return;
    setUploadName(file.name);
    if (uploadPreview) URL.revokeObjectURL(uploadPreview);
    setUploadPreview(URL.createObjectURL(file));
    setSourcePreviewMode("upload");
    setZoom(100);
    setStatusMessage("Image selected — preview only, real extraction unavailable");
    window.setTimeout(() => setStatusMessage(""), 1800);
  }

  function clearRunTimers() {
    runTimers.current.forEach((timer) => window.clearTimeout(timer));
    runTimers.current = [];
  }

  function runCode() {
    clearRunTimers();
    const compiled = ["C", "C++", "Java"].includes(runLanguage);
    setRunStatus(compiled ? "Compiling" : "Running");
    setRunOutput(
      compiled
        ? `> Simulated compile for ${currentFile?.name ?? "main"}...\n`
        : `> Simulated run for ${currentFile?.name ?? "main.py"}...\n`,
    );

    const startRunning = window.setTimeout(
      () => {
        setRunStatus("Running");
        setRunOutput((current) => `${current}> Execution started\n`);
      },
      compiled ? 650 : 120,
    );

    const finish = window.setTimeout(
      () => {
        const code = currentFile?.code ?? "";
        const greetingName = [...code.matchAll(/greet\(\s*["']([^"']+)["']\s*\)/g)].at(-1)?.[1];
        const farewellName = [...code.matchAll(/farewell\(\s*["']([^"']+)["']\s*\)/g)].at(-1)?.[1];
        const additionA = code.match(/^\s*a\s*=\s*(-?\d+(?:\.\d+)?)\s*$/m)?.[1];
        const additionB = code.match(/^\s*b\s*=\s*(-?\d+(?:\.\d+)?)\s*$/m)?.[1];
        const hasAdditionPrint = /print\(\s*a\s*\+\s*b\s*\)/.test(code);
        const lines = [
          ...(greetingName ? [`Hello, ${greetingName}!`] : []),
          ...(farewellName ? [`Goodbye, ${farewellName}!`] : []),
          ...(hasAdditionPrint && additionA !== undefined && additionB !== undefined
            ? [String(Number(additionA) + Number(additionB))]
            : []),
        ];
        if (!lines.length) {
          lines.push("(No supported demo call found. Execution is simulated.)");
        }
        const inputNote = programInput.trim()
          ? [`Input: ${programInput.trim().replace(/\n/g, ", ")}`]
          : [];
        setRunOutput(
          [
            `> ${compiled ? "Simulated build completed" : "Simulated process finished"}`,
            ...inputNote,
            ...lines,
            "",
            "Exited with code 0",
          ].join("\n"),
        );
        setRunStatus("Completed");
        runTimers.current = [];
      },
      compiled ? 1500 : 1050,
    );

    runTimers.current = [startRunning, finish];
  }

  function stopCode() {
    clearRunTimers();
    setRunStatus("Ready");
    setRunOutput((current) =>
      current ? `${current.trimEnd()}\n\nExecution stopped by user.` : "",
    );
  }

  function showErrorExample() {
    clearRunTimers();
    setRunStatus("Failed");
    setRunOutput(`Traceback (most recent call last):
  File "${currentFile?.name ?? "main.py"}", line 4
    print(greet(user_name))
NameError: name 'user_name' is not defined

Exited with code 1`);
  }

  const activeDemo = getDemoCapture(selectedDemoCapture);
  const sourceCode = getDemoCapture(pendingCapture).code;
  const targetFile = files.find((file) => file.name === mergeTarget) ?? null;
  const targetCode = targetFile?.code ?? "";
  const targetLineSet = new Set(
    targetCode
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  );
  const mergeLines = mergeCode.split("\n");
  const addedMergeLines = mergeLines.flatMap((line, index) =>
    line.trim() && !targetLineSet.has(line.trim()) ? [index + 1] : [],
  );
  const overlapMergeLines = mergeLines.flatMap((line, index) =>
    line.trim() && targetLineSet.has(line.trim()) ? [index + 1] : [],
  );
  const validDownloadSelection = downloadSelection.filter((name) =>
    files.some((file) => file.name === name),
  );
  function openDownload() {
    setDownloadSelection(validDownloadSelection);
    setModal("download");
  }
  function simulateDownload(kind) {
    setDownloadKind(kind);
    setDownloadedNames(validDownloadSelection);
    setModal("downloaded");
  }
  const codeSearchMatches =
    codeSearch && currentFile
      ? currentFile.code.toLowerCase().split(codeSearch.toLowerCase()).length - 1
      : 0;
  const isGuideTarget = (step) =>
    modal === "walkthrough" && guideStep === step ? "walkthrough-target" : "";

  function startWalkthrough() {
    setGuideStep(0);
    setScreen("dashboard");
    setModal("walkthrough");
  }

  function moveWalkthrough(nextStep) {
    setGuideStep(nextStep);
    if (nextStep === 0) {
      setScreen("dashboard");
    } else if (screen !== "workspace") {
      openExistingProject(projects[0] ?? SAMPLE_PROJECT);
    }
  }

  return (
    <div className={`app app--${theme}`}>
      {screen === "dashboard" ? (
        <main className="dashboard">
          <header className="topbar">
            <div className="brand">
              <span className="brand__mark">&lt;/&gt;</span>
              <strong>CodeClip</strong>
            </div>
            <TopActions
              onOpenGuide={() => setModal("guide")}
              onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")}
              theme={theme}
            />
          </header>
          <section className="dashboard__content">
            <div className="page-heading">
              <div>
                <p className="eyebrow">My Projects</p>
                <h1>From tutorial to source code</h1>
                <p>Turn screenshots and video moments into editable, runnable files.</p>
              </div>
              <Button variant="primary" onClick={() => setModal("create")}>
                <span className={isGuideTarget(0)}>+ New Project</span>
              </Button>
            </div>
            <div className="project-controls">
              <label className="project-search">
                <span>Search</span>
                <input
                  onChange={(event) => setProjectSearch(event.target.value)}
                  placeholder="Search projects..."
                  value={projectSearch}
                />
              </label>
              <label>
                <span>Language</span>
                <select
                  onChange={(event) => setProjectFilter(event.target.value)}
                  value={projectFilter}
                >
                  <option>All languages</option>
                  <option>Python</option>
                  <option>JavaScript</option>
                </select>
              </label>
              <label>
                <span>Sort</span>
                <select
                  onChange={(event) => setProjectSort(event.target.value)}
                  value={projectSort}
                >
                  <option>Recently Updated</option>
                  <option>Name</option>
                </select>
              </label>
            </div>
            <div className="project-grid">
              {visibleProjects.map((project) => (
                <article
                  className={`project-card ${isGuideTarget(0)}`}
                  key={project.id}
                  onClick={() => openExistingProject(project)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="project-card__top">
                    <span className="language-badge">{project.language}</span>
                    <button
                      aria-label={`Project actions for ${project.name}`}
                      className="more-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setProjectMenu(projectMenu === project.id ? null : project.id);
                      }}
                    >
                      ···
                    </button>
                    {projectMenu === project.id && (
                      <div className="context-menu" onClick={(event) => event.stopPropagation()}>
                        <button
                          onClick={() => {
                            setTargetProject(project.id);
                            setRenameValue(project.name);
                            setProjectMenu(null);
                            setModal("projectRename");
                          }}
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => {
                            const copyId = Date.now();
                            setProjects((current) => [
                              ...current,
                              {
                                ...project,
                                id: copyId,
                                name: `${project.name} Copy`,
                                updated: "Just now",
                              },
                            ]);
                            setProjectData((current) => ({
                              ...current,
                              [copyId]: structuredClone(
                                current[project.id] ?? {
                                  files: [],
                                  selectedFile: null,
                                  captureHistory: [],
                                },
                              ),
                            }));
                            setProjectMenu(null);
                            setStatusMessage("Project duplicated");
                            window.setTimeout(() => setStatusMessage(""), 1800);
                          }}
                        >
                          Duplicate
                        </button>
                        <button
                          onClick={() => {
                            setTargetProject(project.id);
                            setProjectMenu(null);
                            setModal("projectDelete");
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                  <h2>{project.name}</h2>
                  <div className="mini-code">
                    <code>def greet(name):</code>
                    <code>&nbsp;&nbsp;return f"Hello, {"{name}"}!"</code>
                    <code>print(greet("Ada"))</code>
                  </div>
                  <footer>
                    <span>
                      {projectData[project.id]?.files.length ?? 0}{" "}
                      {projectData[project.id]?.files.length === 1 ? "file" : "files"}
                    </span>
                    <span>Updated {project.updated}</span>
                  </footer>
                </article>
              ))}
            </div>
            {!visibleProjects.length && (
              <div className="empty-results">
                <strong>No projects found</strong>
                <p>Try a different search term or language filter.</p>
                <button
                  onClick={() => {
                    setProjectSearch("");
                    setProjectFilter("All languages");
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
          </section>
          {statusMessage && <div className="toast">{statusMessage}</div>}
        </main>
      ) : (
        <main className="workspace">
          <header className="workspace-toolbar">
            <Button variant="ghost" onClick={() => setScreen("dashboard")}>
              ← Back to Projects
            </Button>
            <div className="workspace-toolbar__title">
              <span className="brand__mark">&lt;/&gt;</span>
              <strong>CodeClip</strong>
              <span>/</span>
              <span>{projectName}</span>
            </div>
            <div className="workspace-toolbar__actions">
              <Button
                onClick={() => {
                  setModal("settings");
                }}
              >
                Settings
              </Button>
              <span className={isGuideTarget(7)}>
                <Button variant="primary" onClick={openDownload}>
                  Download
                </Button>
              </span>
              <TopActions
                onOpenGuide={() => setModal("guide")}
                onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")}
                theme={theme}
              />
            </div>
          </header>

          <div
            className={`workspace-grid ${resizing ? "workspace-grid--resizing" : ""}`}
            style={{
              gridTemplateColumns: `${sidebarCollapsed ? 44 : 210}px minmax(0, ${sourceWidth}fr) 7px minmax(0, ${100 - sourceWidth}fr)`,
            }}
          >
            <aside className={`file-panel ${sidebarCollapsed ? "collapsed" : ""}`}>
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Project</span>
                  <h2>{projectName}</h2>
                </div>
                <button
                  aria-label={sidebarCollapsed ? "Expand file sidebar" : "Collapse file sidebar"}
                  className="sidebar-toggle"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                >
                  {sidebarCollapsed ? "›" : "‹"}
                </button>
              </div>
              <div className={`files-heading ${isGuideTarget(4)}`}>
                <strong>Files</strong>
                <button
                  onClick={() => {
                    const name = nextUntitledName(files);
                    setFiles([...files, { name, code: "" }]);
                    selectActiveFile(name);
                    setStatusMessage(`${name} created`);
                    window.setTimeout(() => setStatusMessage(""), 1800);
                  }}
                >
                  + New File
                </button>
              </div>
              <div className="file-list">
                {files.length === 0 ? (
                  <div className="empty-files">
                    <span>No files yet</span>
                    <small>Add a capture to extract code.</small>
                  </div>
                ) : (
                  files.map((file) => (
                    <div className="file-row" key={file.name}>
                      <button
                        className={selectedFile === file.name ? "active" : ""}
                        onClick={() => {
                          selectActiveFile(file.name);
                        }}
                      >
                        <span>{language.slice(0, 2).toLowerCase()}</span>
                        <span>{file.name}</span>
                        {dirtyFiles.includes(file.name) && <i title="Unsaved changes" />}
                      </button>
                      <button
                        aria-label={`Actions for ${file.name}`}
                        className="file-more"
                        onClick={() => setFileMenu(fileMenu === file.name ? null : file.name)}
                      >
                        ···
                      </button>
                      {fileMenu === file.name && (
                        <div className="context-menu file-menu">
                          <button
                            onClick={() => {
                              selectActiveFile(file.name);
                              setRenameValue(file.name);
                              setFileMenu(null);
                              setNameError("");
                              setModal("rename");
                            }}
                          >
                            Rename
                          </button>
                          <button
                            onClick={() => {
                              selectActiveFile(file.name);
                              setFileMenu(null);
                              setModal("delete");
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </aside>

            <section className="source-panel">
              <div className="section-bar">
                <div>
                  <strong>Source capture</strong>
                  <span>
                    {sourcePreviewMode === "upload"
                      ? uploadName || "Uploaded image"
                      : activeDemo.filename}
                  </span>
                </div>
                <span className="status-chip">
                  {sourcePreviewMode === "upload" ? "Preview only" : "Demo capture"}
                </span>
              </div>
              <div className={`source-tabs ${isGuideTarget(1)}`}>
                <button
                  className={sourceTab === "upload" ? "active" : ""}
                  onClick={() => setSourceTab("upload")}
                >
                  Screenshot
                </button>
                <button
                  className={sourceTab === "youtube" ? "active" : ""}
                  onClick={() => setSourceTab("youtube")}
                >
                  YouTube
                </button>
              </div>
              <div className="demo-capture-picker">
                <span>Demo captures</span>
                <div>
                  {DEMO_CAPTURES.map((capture) => (
                    <button
                      className={
                        sourcePreviewMode === "demo" && selectedDemoCapture === capture.id
                          ? "active"
                          : ""
                      }
                      key={capture.id}
                      onClick={() => {
                        setSelectedDemoCapture(capture.id);
                        setSourcePreviewMode("demo");
                        setZoom(100);
                        if (sourceTab === "youtube") setFrameReady(true);
                      }}
                    >
                      <strong>{capture.title}</strong>
                      <small>{capture.detail}</small>
                    </button>
                  ))}
                </div>
              </div>
              <div
                className={`capture-stage ${sourceTab === "youtube" ? "capture-stage--youtube" : ""}`}
              >
                {sourceTab === "youtube" ? (
                  <div className="workspace-youtube">
                    <div className="workspace-youtube__fields">
                      <label className="field">
                        <span>YouTube URL</span>
                        <input
                          onChange={(event) => {
                            setYoutubeUrl(event.target.value);
                            setFrameReady(false);
                          }}
                          placeholder="https://youtube.com/watch?v=python"
                          value={youtubeUrl}
                        />
                      </label>
                      <label className="field">
                        <span>Timestamp</span>
                        <input
                          onChange={(event) => setTimestamp(event.target.value)}
                          value={timestamp}
                        />
                      </label>
                    </div>
                    <div className="workspace-frame">
                      {frameReady ? (
                        <CodeBlock code={activeDemo.code} />
                      ) : (
                        <div>
                          <strong>Video frame preview</strong>
                          <span>Enter a URL or use the sample at {timestamp}.</span>
                        </div>
                      )}
                    </div>
                    <p className="hint">
                      Simulated preview: a sample frame is shown; no frame is fetched from the URL.
                    </p>
                    <div className="workspace-youtube__actions">
                      <Button onClick={() => setFrameReady(true)}>Preview Frame</Button>
                      <button className="text-button" onClick={simulateExtractionError}>
                        Simulate extraction error
                      </button>
                      <Button variant="primary" onClick={() => startExtraction("youtube")}>
                        Extract Code
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {sourcePreviewMode === "upload" && uploadPreview ? (
                      <div
                        className="mock-screenshot"
                        style={{ transform: `scale(${zoom / 100})` }}
                      >
                        <div className="mock-window-bar">
                          <span />
                          <span />
                          <span />
                          <small>{uploadName}</small>
                        </div>
                        <img alt="Uploaded source" className="source-image" src={uploadPreview} />
                      </div>
                    ) : (
                      <div
                        className="mock-screenshot"
                        style={{ transform: `scale(${zoom / 100})` }}
                      >
                        <div className="mock-window-bar">
                          <span />
                          <span />
                          <span />
                          <small>{activeDemo.filename}</small>
                        </div>
                        <CodeBlock code={activeDemo.code} />
                      </div>
                    )}
                    {sourcePreviewMode === "upload" && (
                      <div className="preview-only-note">
                        Preview only—real extraction unavailable. Choose a demo capture for
                        simulated extraction.
                      </div>
                    )}
                    <div className="source-actions">
                      <Button
                        onClick={() => {
                          setCaptureTab("upload");
                          setModal("capture");
                        }}
                      >
                        {uploadPreview ? "Replace Image" : "Upload Image"}
                      </Button>
                      <div className="zoom-controls">
                        <button
                          aria-label="Zoom out"
                          onClick={() => setZoom((value) => Math.max(60, value - 10))}
                        >
                          −
                        </button>
                        <span>{zoom}%</span>
                        <button
                          aria-label="Zoom in"
                          onClick={() => setZoom((value) => Math.min(140, value + 10))}
                        >
                          +
                        </button>
                      </div>
                      <button className="text-button" onClick={simulateExtractionError}>
                        Simulate extraction error
                      </button>
                      <span className={isGuideTarget(2)}>
                        <Button variant="primary" onClick={() => startExtraction("upload")}>
                          {sourcePreviewMode === "upload"
                            ? "Choose Demo to Extract"
                            : "Extract Demo Code"}
                        </Button>
                      </span>
                    </div>
                  </>
                )}
              </div>
              <div className={`capture-history ${historyOpen ? "open" : ""} ${isGuideTarget(5)}`}>
                <button
                  aria-expanded={historyOpen}
                  className="capture-history__toggle"
                  onClick={() => setHistoryOpen(!historyOpen)}
                >
                  <span>Capture History</span>
                  <span>
                    {captureHistory.length} captures {historyOpen ? "⌄" : "›"}
                  </span>
                </button>
                {historyOpen && (
                  <div className="capture-history__items">
                    {captureHistory.length ? (
                      captureHistory.map((capture, index) => (
                        <button
                          className={activeCapture === capture.id ? "active" : ""}
                          key={capture.id}
                          onClick={() => {
                            setActiveCapture(capture.id);
                            setSelectedDemoCapture(capture.demoId);
                            setSourcePreviewMode("demo");
                            setSourceTab(capture.sourceType);
                            if (capture.sourceType === "youtube") setFrameReady(true);
                          }}
                        >
                          <span className="capture-thumb">0{index + 1}</span>
                          <span>
                            <strong>{capture.label}</strong>
                            <small>
                              {capture.filename} · {capture.time}
                            </small>
                          </span>
                        </button>
                      ))
                    ) : (
                      <span className="history-empty">No captures yet</span>
                    )}
                  </div>
                )}
              </div>
            </section>

            <div
              aria-label="Resize source and editor panels"
              aria-orientation="vertical"
              className="resize-handle"
              onPointerDown={(event) => {
                setResizing(true);
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (!resizing) return;
                const sidebarWidth = sidebarCollapsed ? 44 : 210;
                const available = window.innerWidth - sidebarWidth - 7;
                const next = ((event.clientX - sidebarWidth) / available) * 100;
                setSourceWidth(Math.min(60, Math.max(30, next)));
              }}
              onPointerUp={() => setResizing(false)}
              role="separator"
            />

            <section className="editor-panel">
              <div className="editor-tabs">
                {files.length ? (
                  files.map((file) => (
                    <button
                      className={selectedFile === file.name ? "active" : ""}
                      key={file.name}
                      onClick={() => selectActiveFile(file.name)}
                    >
                      <span>{language.slice(0, 2).toUpperCase()}</span>
                      {file.name}
                      {dirtyFiles.includes(file.name) && <i aria-label="Unsaved changes" />}
                    </button>
                  ))
                ) : (
                  <span className="no-open-file">No open file</span>
                )}
              </div>
              <div className="code-toolbar">
                <label>
                  <span>Find</span>
                  <input
                    onChange={(event) => setCodeSearch(event.target.value)}
                    placeholder="Search in code"
                    value={codeSearch}
                  />
                  {codeSearch && <small>{codeSearchMatches} found</small>}
                </label>
                <div>
                  <button disabled={!undoStack.length} onClick={undoCode}>
                    Undo
                  </button>
                  <button disabled={!redoStack.length} onClick={redoCode}>
                    Redo
                  </button>
                  <button disabled={!currentFile} onClick={copyCode}>
                    Copy
                  </button>
                  <button
                    disabled={!selectedFile || !dirtyFiles.includes(selectedFile)}
                    onClick={() => {
                      if (!selectedFile) return;
                      setDirtyFiles((current) => current.filter((name) => name !== selectedFile));
                      setStatusMessage("Saved");
                      window.setTimeout(() => setStatusMessage(""), 1800);
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
              <div className={`editor-code-area ${isGuideTarget(3)}`}>
                {currentFile ? (
                  <CodeBlock
                    code={currentFile.code}
                    editable
                    fontSize={fontSize}
                    lineNumbers={lineNumbers}
                    onChange={updateCurrentFile}
                    wordWrap={wordWrap}
                  />
                ) : (
                  <div className="editor-empty">
                    <span>Extracted code will appear here.</span>
                  </div>
                )}
                <div className="editor-footer">
                  <span>{language}</span>
                  <span>Ln 1, Col 1 · UTF-8</span>
                </div>
              </div>

              <section className={`run-panel ${isGuideTarget(6)}`} aria-label="Run Code">
                <div className="run-panel__header">
                  <div>
                    <strong>Run Code</strong>
                    <span>Simulated for the supported demo code only</span>
                  </div>
                  <span className={`run-status run-status--${runStatus.toLowerCase()}`}>
                    <i />
                    {runStatus}
                  </span>
                </div>
                <div className="run-controls">
                  <label className="run-language">
                    <span>Language</span>
                    <select
                      onChange={(event) => {
                        setRunLanguage(event.target.value);
                        setLanguage(event.target.value);
                      }}
                      value={runLanguage}
                    >
                      <option>Python</option>
                      <option>JavaScript</option>
                      <option>TypeScript</option>
                      <option>C</option>
                      <option>C++</option>
                      <option>Java</option>
                    </select>
                  </label>
                  <Button
                    disabled={runStatus === "Running" || runStatus === "Compiling"}
                    variant="primary"
                    onClick={runCode}
                  >
                    {["C", "C++", "Java"].includes(runLanguage) ? "Compile & Run" : "Run"}
                  </Button>
                  <Button
                    disabled={runStatus !== "Running" && runStatus !== "Compiling"}
                    onClick={stopCode}
                  >
                    Stop
                  </Button>
                  <button
                    aria-expanded={inputExpanded}
                    className="input-toggle"
                    onClick={() => setInputExpanded(!inputExpanded)}
                  >
                    {inputExpanded ? "−" : "+"} Program Input
                  </button>
                </div>
                {inputExpanded && (
                  <label className="program-input">
                    <span>Standard input (stdin)</span>
                    <textarea
                      onChange={(event) => setProgramInput(event.target.value)}
                      placeholder={"Ada\n42"}
                      value={programInput}
                    />
                  </label>
                )}
                <div className={`console ${consoleOpen ? "open" : "collapsed"}`}>
                  <div className="console__header">
                    <button
                      aria-expanded={consoleOpen}
                      className="console__toggle"
                      onClick={() => setConsoleOpen(!consoleOpen)}
                    >
                      <strong>Output Console</strong>
                      <span>{consoleOpen ? "Collapse" : "Expand"}</span>
                    </button>
                    <div>
                      <button onClick={showErrorExample}>Show Error Example</button>
                      <button
                        onClick={() => {
                          setRunOutput("");
                          if (runStatus === "Completed" || runStatus === "Failed") {
                            setRunStatus("Ready");
                          }
                        }}
                      >
                        Clear Output
                      </button>
                    </div>
                  </div>
                  {consoleOpen && (
                    <pre>
                      {runOutput || "No output yet. Select a language and run the current file."}
                    </pre>
                  )}
                </div>
              </section>
            </section>
          </div>
          {statusMessage && <div className="toast">{statusMessage}</div>}
        </main>
      )}

      {modal === "guide" && (
        <ModalShell title="How to Use CodeClip" onClose={() => setModal(null)} wide>
          <div className="guide-body">
            <div className="guide-intro">
              <p>
                CodeClip simulates extraction and code execution for this university prototype. No
                source files are uploaded to a backend.
              </p>
            </div>
            <ol className="guide-steps">
              {GUIDE_STEPS.map((step, index) => (
                <li key={step}>
                  <span>{index + 1}</span>
                  <p>{step}</p>
                </li>
              ))}
            </ol>
          </div>
          <footer className="modal__footer">
            <Button onClick={() => setModal(null)}>Close</Button>
            <Button variant="primary" onClick={startWalkthrough}>
              Try Sample Walkthrough
            </Button>
          </footer>
        </ModalShell>
      )}

      {modal === "walkthrough" && (
        <ModalShell title="Sample Walkthrough" onClose={() => setModal(null)}>
          <div className="walkthrough">
            <div className="walkthrough__counter">
              Step {guideStep + 1} of {GUIDE_STEPS.length}
            </div>
            <h3>{GUIDE_STEPS[guideStep]}</h3>
            <p>
              {guideStep === 0 && "Open the highlighted Python Tutorial card or create a project."}
              {guideStep === 1 &&
                "Choose Screenshot or YouTube. This demo uses a matching Python screenshot."}
              {guideStep === 2 &&
                "Extraction is simulated: preview the source, then use Extract Code."}
              {guideStep === 3 && "The extracted Python remains editable before and after saving."}
              {guideStep === 4 &&
                "Create main.py, or merge the farewell function into the existing file."}
              {guideStep === 5 &&
                "The merge review marks additions and removes duplicate greet lines."}
              {guideStep === 6 &&
                "Execution is simulated locally and returns matching sample output."}
              {guideStep === 7 && "Select one file or download the complete project as a ZIP."}
            </p>
            <div className="walkthrough__sample">
              <div>
                <span>SAMPLE SOURCE</span>
                <CodeBlock code={guideStep >= 4 ? SAMPLE_MERGED_CODE : GREET_CODE} />
              </div>
              <div>
                <span>{guideStep === 6 ? "SIMULATED OUTPUT" : "MATCHING CODE"}</span>
                {guideStep === 6 ? (
                  <pre>{"Hello, Ada!\nGoodbye, Ada!\n\nExited with code 0"}</pre>
                ) : (
                  <CodeBlock code={guideStep >= 4 ? SAMPLE_MERGED_CODE : GREET_CODE} />
                )}
              </div>
            </div>
            <p className="walkthrough__hint">
              The highlighted control behind this guide is the next area to use.
            </p>
          </div>
          <footer className="modal__footer modal__footer--split">
            <Button variant="ghost" onClick={() => setModal(null)}>
              Skip
            </Button>
            <div>
              <Button disabled={guideStep === 0} onClick={() => moveWalkthrough(guideStep - 1)}>
                Back
              </Button>
              <Button
                variant="primary"
                onClick={() =>
                  guideStep === GUIDE_STEPS.length - 1
                    ? setModal(null)
                    : moveWalkthrough(guideStep + 1)
                }
              >
                {guideStep === GUIDE_STEPS.length - 1 ? "Finish" : "Next"}
              </Button>
            </div>
          </footer>
        </ModalShell>
      )}

      {modal === "create" && (
        <ModalShell title="Create Project" onClose={() => setModal(null)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              createProject();
            }}
          >
            <div className="modal__body">
              <label className="field">
                <span>Project name</span>
                <input
                  autoFocus
                  onChange={(event) => setNewProjectName(event.target.value)}
                  value={newProjectName}
                />
              </label>
              <p className="hint">You can rename this project later.</p>
            </div>
            <footer className="modal__footer">
              <Button onClick={() => setModal(null)}>Cancel</Button>
              <Button variant="primary" type="submit">
                Create
              </Button>
            </footer>
          </form>
        </ModalShell>
      )}

      {modal === "capture" && (
        <ModalShell title="Upload Image" onClose={() => setModal(null)} wide>
          <div className="modal__body capture-modal-body">
            {captureTab === "upload" ? (
              <>
                <label className="drop-zone">
                  <input
                    accept="image/*"
                    onChange={(event) => handleUpload(event.target.files?.[0])}
                    type="file"
                  />
                  <span className="drop-zone__icon">↑</span>
                  <strong>{uploadName || "Upload Screenshot"}</strong>
                  <span>PNG, JPG, or WEBP · up to 10 MB</span>
                  <i>{uploadName ? "Replace Image" : "Choose Image"}</i>
                </label>
                <div className="upload-preview">
                  <span>PREVIEW</span>
                  {uploadPreview ? (
                    <img alt="Selected upload preview" src={uploadPreview} />
                  ) : (
                    <div className="preview-placeholder preview-placeholder--empty">
                      <strong>No uploaded image selected</strong>
                      <span>Preview only—real extraction unavailable.</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <label className="field">
                  <span>YouTube URL</span>
                  <input
                    onChange={(event) => {
                      setYoutubeUrl(event.target.value);
                      setFrameReady(false);
                    }}
                    placeholder="https://youtube.com/watch?v=..."
                    value={youtubeUrl}
                  />
                </label>
                <div className="field-row">
                  <label className="field">
                    <span>Timestamp (MM:SS)</span>
                    <input
                      onChange={(event) => setTimestamp(event.target.value)}
                      value={timestamp}
                    />
                  </label>
                  <Button onClick={() => setFrameReady(true)}>Preview Frame</Button>
                </div>
                <div className="video-preview">
                  <div className="video-preview__frame">
                    {frameReady ? (
                      <CodeBlock code={activeDemo.code} />
                    ) : (
                      <span>Enter a URL to preview the frame</span>
                    )}
                  </div>
                  <span>{timestamp}</span>
                </div>
                <p className="hint">
                  Simulated preview: a sample frame is shown; no frame is fetched from the URL.
                </p>
              </>
            )}
          </div>
          <footer className="modal__footer">
            <Button onClick={() => setModal(null)}>Cancel</Button>
            <Button
              disabled={!uploadPreview}
              variant="primary"
              onClick={() => {
                setSourcePreviewMode("upload");
                setModal(null);
                setStatusMessage("Preview only—real extraction unavailable");
                window.setTimeout(() => setStatusMessage(""), 2200);
              }}
            >
              Use Image Preview
            </Button>
          </footer>
        </ModalShell>
      )}

      {modal === "processing" && (
        <ModalShell title="Extracting Code" onClose={() => setModal(null)}>
          <div className="processing">
            <div className="spinner" />
            <h3>Processing capture…</h3>
            <p>Simulating extraction from the selected demo capture.</p>
            <div className="progress-track">
              <div />
            </div>
            <button className="text-button" onClick={() => setModal("error")}>
              Simulate an extraction error
            </button>
          </div>
          <footer className="modal__footer">
            <Button onClick={() => setModal(null)}>Cancel</Button>
          </footer>
        </ModalShell>
      )}

      {modal === "error" && (
        <ModalShell title="Extraction Error" onClose={() => setModal(null)}>
          <div className="processing">
            <div className="error-mark">!</div>
            <h3>We couldn’t read this capture</h3>
            <p>Try a clearer frame or retry the extraction.</p>
          </div>
          <footer className="modal__footer">
            <Button onClick={() => setModal(null)}>Cancel</Button>
            <Button variant="primary" onClick={() => setModal("processing")}>
              Retry
            </Button>
          </footer>
        </ModalShell>
      )}

      {modal === "review" && (
        <ModalShell title="Ready for Review" onClose={() => setModal(null)} wide>
          <div className="review-meta">
            <label className="field">
              <span>Language</span>
              <select
                onChange={(event) => {
                  setLanguage(event.target.value);
                  setRunLanguage(event.target.value);
                }}
                value={language}
              >
                <option>Python</option>
                <option>JavaScript</option>
                <option>TypeScript</option>
                <option>C</option>
                <option>C++</option>
                <option>Java</option>
              </select>
            </label>
            <label className="field">
              <span>Filename</span>
              <input
                onChange={(event) => {
                  setReviewFilename(event.target.value);
                  setNameError("");
                }}
                value={reviewFilename}
              />
            </label>
          </div>
          {nameError && (
            <p className="hint" role="alert">
              {nameError} already exists in this project. Enter a different filename, or{" "}
              <button className="text-button" onClick={() => prepareMerge(nameError)}>
                Merge into File
              </button>
              .
            </p>
          )}
          <div className="review-grid">
            <div className="review-pane">
              <div className="review-pane__header">
                <strong>Source</strong>
                <span>Capture preview</span>
              </div>
              <div className="source-review">
                <CodeBlock code={sourceCode} />
              </div>
            </div>
            <div className="review-pane">
              <div className="review-pane__header">
                <strong>Editable code</strong>
                <span>Simulated extraction</span>
              </div>
              <CodeBlock code={reviewCode} editable onChange={setReviewCode} />
            </div>
          </div>
          <footer className="modal__footer modal__footer--split">
            <Button variant="ghost" onClick={() => setModal(null)}>
              Discard
            </Button>
            <div>
              <Button disabled={!files.length} onClick={() => prepareMerge()}>
                Merge into File
              </Button>
              <Button variant="primary" onClick={saveNewFile}>
                Create New File
              </Button>
            </div>
          </footer>
        </ModalShell>
      )}

      {modal === "merge" && (
        <ModalShell
          title={`Merge into ${targetFile?.name ?? "file"}`}
          onClose={() => setModal("review")}
          wide
        >
          <div className="merge-selector">
            <label className="field">
              <span>Merge into</span>
              <select
                onChange={(event) => {
                  const target = files.find((file) => file.name === event.target.value);
                  if (!target) return;
                  setMergeTarget(target.name);
                  setMergeCode(buildMock(target.code, reviewCode));
                }}
                value={targetFile?.name ?? ""}
              >
                {!targetFile && <option value="">No valid file</option>}
                {files.map((file) => (
                  <option key={file.name} value={file.name}>
                    {file.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="merge-legend">
              <span>
                <i className="legend-added" /> Added
              </span>
              <span>
                <i className="legend-overlap" /> Overlap
              </span>
            </div>
          </div>
          <div className="review-grid merge-grid">
            <div className="review-pane">
              <div className="review-pane__header">
                <strong>Current Code</strong>
                <span>{targetFile?.name ?? "No target"}</span>
              </div>
              <CodeBlock code={targetCode} />
            </div>
            <div className="review-pane">
              <div className="review-pane__header">
                <strong>Proposed Code</strong>
                <span>Simple mock merge</span>
              </div>
              <div className="proposed-wrap">
                <CodeBlock
                  code={mergeCode}
                  highlightedLines={addedMergeLines}
                  overlapLines={overlapMergeLines}
                />
                <textarea
                  aria-label="Editable proposed code"
                  onChange={(event) => setMergeCode(event.target.value)}
                  value={mergeCode}
                />
              </div>
            </div>
          </div>
          <footer className="modal__footer">
            <Button onClick={() => setModal("review")}>Cancel</Button>
            <Button disabled={!targetFile} variant="primary" onClick={acceptMerge}>
              Accept Merge
            </Button>
          </footer>
        </ModalShell>
      )}

      {modal === "projectRename" && (
        <ModalShell title="Rename Project" onClose={() => setModal(null)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const name = renameValue.trim();
              if (!name || targetProject === null) return;
              setProjects((current) =>
                current.map((project) =>
                  project.id === targetProject
                    ? { ...project, name, updated: "Just now" }
                    : project,
                ),
              );
              setModal(null);
              setStatusMessage("Project renamed");
              window.setTimeout(() => setStatusMessage(""), 1800);
            }}
          >
            <div className="modal__body">
              <label className="field">
                <span>Project name</span>
                <input
                  autoFocus
                  onChange={(event) => setRenameValue(event.target.value)}
                  value={renameValue}
                />
              </label>
            </div>
            <footer className="modal__footer">
              <Button onClick={() => setModal(null)}>Cancel</Button>
              <Button disabled={!renameValue.trim()} variant="primary" type="submit">
                Rename Project
              </Button>
            </footer>
          </form>
        </ModalShell>
      )}

      {modal === "projectDelete" && (
        <ModalShell title="Delete Project" onClose={() => setModal(null)}>
          <div className="modal__body confirm-copy">
            <strong>Delete this project?</strong>
            <p>The project card and its prototype files will be removed.</p>
          </div>
          <footer className="modal__footer">
            <Button onClick={() => setModal(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                setProjects((current) => current.filter((project) => project.id !== targetProject));
                setProjectData((current) => {
                  const { [targetProject]: _removed, ...rest } = current;
                  return rest;
                });
                if (targetProject === activeProjectId) setActiveProjectId(null);
                setModal(null);
                setStatusMessage("Project deleted");
                window.setTimeout(() => setStatusMessage(""), 1800);
              }}
            >
              Delete Project
            </Button>
          </footer>
        </ModalShell>
      )}

      {modal === "rename" && (
        <ModalShell title="Rename File" onClose={() => setModal(null)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              confirmRename();
            }}
          >
            <div className="modal__body">
              <label className="field">
                <span>Filename</span>
                <input
                  autoFocus
                  onChange={(event) => {
                    setRenameValue(event.target.value);
                    setNameError("");
                  }}
                  value={renameValue}
                />
              </label>
              {nameError ? (
                <p className="hint" role="alert">
                  {nameError} already exists. Choose a different filename.
                </p>
              ) : (
                <p className="hint">Keep the .py extension for Python files.</p>
              )}
            </div>
            <footer className="modal__footer">
              <Button onClick={() => setModal(null)}>Cancel</Button>
              <Button disabled={!renameValue.trim()} variant="primary" type="submit">
                Rename
              </Button>
            </footer>
          </form>
        </ModalShell>
      )}

      {modal === "delete" && (
        <ModalShell title="Delete File" onClose={() => setModal(null)}>
          <div className="modal__body confirm-copy">
            <strong>Delete {selectedFile}?</strong>
            <p>This removes the file from the project. This prototype action cannot be undone.</p>
          </div>
          <footer className="modal__footer">
            <Button onClick={() => setModal(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete}>
              Delete File
            </Button>
          </footer>
        </ModalShell>
      )}

      {modal === "settings" && (
        <ModalShell title="Editor Settings" onClose={() => setModal(null)}>
          <div className="modal__body settings-list">
            <label className="field">
              <span>Font size</span>
              <select
                onChange={(event) => setDraftFontSize(Number(event.target.value))}
                value={draftFontSize}
              >
                <option value="12">12 px</option>
                <option value="14">14 px</option>
                <option value="16">16 px</option>
                <option value="18">18 px</option>
              </select>
            </label>
            <label className="switch-row">
              <span>
                <strong>Line numbers</strong>
                <small>Show numbers beside code</small>
              </span>
              <input
                checked={draftLineNumbers}
                onChange={(event) => setDraftLineNumbers(event.target.checked)}
                type="checkbox"
              />
            </label>
            <label className="switch-row">
              <span>
                <strong>Word wrap</strong>
                <small>Wrap long lines in the editor</small>
              </span>
              <input
                checked={draftWordWrap}
                onChange={(event) => setDraftWordWrap(event.target.checked)}
                type="checkbox"
              />
            </label>
          </div>
          <footer className="modal__footer">
            <Button onClick={() => setModal(null)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                setFontSize(draftFontSize);
                setLineNumbers(draftLineNumbers);
                setWordWrap(draftWordWrap);
                setModal(null);
              }}
            >
              Apply
            </Button>
          </footer>
        </ModalShell>
      )}

      {modal === "download" && (
        <ModalShell title="Download Code" onClose={() => setModal(null)}>
          <div className="modal__body">
            <p className="download-intro">Select files to include in your download.</p>
            <div className="download-files">
              {files.length ? (
                files.map((file) => (
                  <label key={file.name}>
                    <input
                      checked={validDownloadSelection.includes(file.name)}
                      onChange={(event) =>
                        setDownloadSelection((current) =>
                          event.target.checked
                            ? [...current, file.name]
                            : current.filter((name) => name !== file.name),
                        )
                      }
                      type="checkbox"
                    />
                    <span className="file-type">PY</span>
                    <span>
                      <strong>{file.name}</strong>
                      <small>{file.code.split("\n").length} lines</small>
                    </span>
                  </label>
                ))
              ) : (
                <div className="empty-download">No files are available to download.</div>
              )}
            </div>
          </div>
          <footer className="modal__footer modal__footer--split">
            <Button onClick={() => setModal(null)}>Cancel</Button>
            <div>
              <Button
                disabled={validDownloadSelection.length !== 1}
                onClick={() => simulateDownload("file")}
              >
                Download File
              </Button>
              <Button
                disabled={!validDownloadSelection.length}
                variant="primary"
                onClick={() => simulateDownload("zip")}
              >
                Download Project ZIP
              </Button>
            </div>
          </footer>
        </ModalShell>
      )}

      {modal === "downloaded" && (
        <ModalShell title="Download simulated" onClose={() => setModal(null)}>
          <div className="processing">
            <div className="success-mark">✓</div>
            <h3>Download simulated</h3>
            <p>
              No file was downloaded. This prototype only simulates{" "}
              {downloadKind === "zip" ? "a project ZIP" : "a file"} download.
            </p>
            <p>Selected: {downloadedNames.join(", ")}</p>
          </div>
          <footer className="modal__footer">
            <Button variant="primary" onClick={() => setModal(null)}>
              Done
            </Button>
          </footer>
        </ModalShell>
      )}
    </div>
  );
}
