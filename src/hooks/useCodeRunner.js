import { useEffect, useRef, useState } from "react";
import { MAX_OUTPUT_LINES, RUN_TIMEOUT_MS } from "../lib/runner";

// status: ready | loading | running | done | error | stopped
export default function useCodeRunner() {
  const [status, setStatus] = useState("ready");
  const [output, setOutput] = useState([]);
  const workers = useRef({});
  const active = useRef(null);
  const timer = useRef(null);
  const lineId = useRef(0);

  function append(stream, text) {
    setOutput((current) =>
      [...current, { id: lineId.current++, stream, text }].slice(
        -MAX_OUTPUT_LINES,
      ),
    );
  }

  function discard(language) {
    workers.current[language]?.terminate();
    delete workers.current[language];
  }

  function finish(nextStatus) {
    clearTimeout(timer.current);
    active.current = null;
    setStatus(nextStatus);
  }

  function run({ language, code, stdin, filename }) {
    if (active.current) discard(active.current);
    clearTimeout(timer.current);
    // JavaScript gets a fresh worker so leftover timers from an earlier run
    // cannot print into this one. Python keeps its worker to avoid reloading.
    if (language === "JavaScript") discard(language);
    if (!workers.current[language]) {
      workers.current[language] = new Worker(
        new URL("../lib/runner.worker.js", import.meta.url),
        { type: "module" },
      );
    }
    const worker = workers.current[language];
    active.current = language;
    setOutput([]);
    setStatus("running");
    append("system", `$ run ${filename}`);
    worker.onmessage = ({ data }) => {
      if (worker !== workers.current[language]) return;
      if (data.type === "output") append(data.stream, data.text);
      else if (data.type === "loading") {
        setStatus("loading");
        append("system", "Loading Python (first run downloads the runtime)…");
      } else if (data.type === "started") {
        setStatus("running");
        timer.current = setTimeout(() => {
          discard(language);
          append(
            "stderr",
            `Stopped after ${RUN_TIMEOUT_MS / 1000} seconds. Check for an infinite loop.`,
          );
          finish("stopped");
        }, RUN_TIMEOUT_MS);
      } else if (data.type === "done" && active.current === language) {
        append("system", "Program finished.");
        finish("done");
      } else if (data.type === "failed" && active.current === language) {
        finish("error");
      }
    };
    worker.onerror = (event) => {
      event.preventDefault();
      append(
        "stderr",
        event.message || "The code runner stopped unexpectedly.",
      );
      discard(language);
      finish("error");
    };
    worker.postMessage({ language, code, stdin, filename });
  }

  function stop() {
    if (!active.current) return;
    discard(active.current);
    append("system", "Stopped by user.");
    finish("stopped");
  }

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      Object.values(workers.current).forEach((worker) => worker.terminate());
    },
    [],
  );

  return {
    status,
    output,
    run,
    stop,
    clear: () => setOutput([]),
    busy: status === "running" || status === "loading",
  };
}
