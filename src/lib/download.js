import JSZip from "jszip";
import { downloadBlob, validateName } from "./project.js";

export function buildProjectZip(project) {
  const zip = new JSZip();
  const checked = [];
  for (const file of project.files) {
    const error = validateName(file.name, checked, null, true);
    if (error)
      throw new Error(`Rename ${file.name} before exporting: ${error}`);
    checked.push(file);
    zip.file(file.name, file.code);
  }
  return zip;
}

export async function downloadProject(project) {
  const blob = await buildProjectZip(project).generateAsync({ type: "blob" });
  const name =
    project.name.replace(/[^a-z0-9_-]/gi, "-").slice(0, 80) ||
    "codeclip-project";
  downloadBlob(blob, `${name}.zip`);
}
