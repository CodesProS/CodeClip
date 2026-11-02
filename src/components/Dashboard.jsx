import { useState } from "react";
import { formatDate, LANGUAGES, projectLanguages } from "../lib/project";

export default function Dashboard({
  projects,
  onCreate,
  onEdit,
  onDuplicate,
  onDelete,
}) {
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("All languages");
  const [sort, setSort] = useState("recent");
  const visible = projects
    .filter(
      (project) =>
        project.name.toLowerCase().includes(query.trim().toLowerCase()) &&
        (language === "All languages" ||
          projectLanguages(project).includes(language)),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : b.updatedAt - a.updatedAt,
    );
  return (
    <main id="main" tabIndex={-1} className="dashboard__content">
      <div className="page-heading">
        <div>
          <p className="eyebrow">My projects</p>
          <h1>From tutorial to source code.</h1>
          <p>Keep your captures, notes, and code in one workspace.</p>
        </div>
        <button className="button button--primary" onClick={onCreate}>
          + New project
        </button>
      </div>
      <div className="project-controls">
        <label className="field project-search">
          Search projects
          <input
            type="search"
            placeholder="Find a project…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="field">
          Language
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            {["All languages", ...LANGUAGES].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Sort by
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="recent">Recently updated</option>
            <option value="name">Project name</option>
          </select>
        </label>
      </div>
      <p className="results-count" role="status">
        {visible.length} {visible.length === 1 ? "project" : "projects"}
      </p>
      <div className="project-grid">
        {visible.map((project) => (
          <article className="project-card" key={project.id}>
            <div className="project-card__top">
              <span className="language-badge">
                {projectLanguages(project).join(" / ")}
              </span>
              <span className="hint">
                {project.files.length}{" "}
                {project.files.length === 1 ? "file" : "files"}
              </span>
            </div>
            <h2>
              <a href={`#project/${encodeURIComponent(project.id)}`}>
                {project.name}
              </a>
            </h2>
            <pre className="mini-code">
              {project.files[0]?.code.slice(0, 180) ||
                "Your next idea starts here.\nAdd a capture or create a file."}
            </pre>
            <p className="hint">Updated {formatDate(project.updatedAt)}</p>
            <footer className="card-actions">
              <a
                className="button button--primary"
                href={`#project/${encodeURIComponent(project.id)}`}
                aria-label={`Open ${project.name}`}
              >
                Open project →
              </a>
              <button
                className="text-button"
                aria-label={`Edit ${project.name}`}
                onClick={() => onEdit(project)}
              >
                Edit
              </button>
              <button
                className="text-button"
                aria-label={`Duplicate ${project.name}`}
                onClick={() => onDuplicate(project)}
              >
                Duplicate
              </button>
              <button
                className="text-button danger-text"
                aria-label={`Delete ${project.name}`}
                onClick={() => onDelete(project)}
              >
                Delete
              </button>
            </footer>
          </article>
        ))}
      </div>
      {!visible.length && (
        <div className="empty-state">
          <h2>
            {projects.length
              ? "No matching projects"
              : "Make room for your first idea."}
          </h2>
          <p>
            {projects.length
              ? "Try another search or clear your filters."
              : "Create a project, then bring in a sample or screenshot."}
          </p>
          <button
            className="button"
            onClick={() => {
              if (projects.length) {
                setQuery("");
                setLanguage("All languages");
              } else onCreate();
            }}
          >
            {projects.length ? "Clear filters" : "Create project"}
          </button>
        </div>
      )}
    </main>
  );
}
