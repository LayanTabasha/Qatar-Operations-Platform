let activePreview = { fileId: "", zoom: 1, rotation: 0, mode: "fit-screen" };

function getUploadById(fileId) {
  return state.uploads.find((file) => file.id === fileId);
}

function openFilePreview(fileId) {
  const file = getUploadById(fileId);
  if (!file) return;
  if (!state.authenticated) {
    alert("Access denied. Please sign in to preview files.");
    return;
  }
  const form = document.getElementById("modal-form");
  const modal = document.querySelector(".modal");
  activePreview = { fileId, zoom: 1, rotation: 0, mode: "fit-screen" };
  modal?.classList.add("preview-modal");
  document.getElementById("modal-title").textContent = "Document Preview";
  document.getElementById("modal-eyebrow").textContent = "Embedded Viewer";
  form.innerHTML = renderDocumentPreview(file, true);
  document.getElementById("modal-backdrop").classList.remove("hidden");
  resetModalScroll();
  setTimeout(() => {
    form.innerHTML = renderDocumentPreview(file, false);
    applyPreviewTransform();
  }, 180);
}

function renderDocumentPreview(file, loading = false) {
  const type = previewType(file);
  const supportsRotate = type === "image";
  return `<div class="document-preview-shell">
    <div class="preview-info">
      <div>
        <h2>${valueOrPlaceholder(file.title || file.name)}</h2>
        <p>${valueOrPlaceholder(file.name)}</p>
      </div>
      <dl>
        <dt>Category</dt><dd>${valueOrPlaceholder(file.category)}</dd>
        <dt>Site</dt><dd>${valueOrPlaceholder(file.siteName)}</dd>
        <dt>Charger</dt><dd>${valueOrPlaceholder(file.chargerName)}</dd>
        <dt>Uploaded By</dt><dd>${valueOrPlaceholder(file.uploadedBy)}</dd>
        <dt>Upload Date</dt><dd>${formatDateTime(file.uploadedAt)}</dd>
        <dt>File Size</dt><dd>${formatFileSize(file.size || file.fileSize)}</dd>
      </dl>
    </div>
    <div class="preview-toolbar" aria-label="Preview controls">
      <button class="secondary-button" type="button" data-preview-action="zoom-out">Zoom -</button>
      <button class="secondary-button" type="button" data-preview-action="zoom-in">Zoom +</button>
      <button class="secondary-button" type="button" data-preview-action="fit-width">Fit Width</button>
      <button class="secondary-button" type="button" data-preview-action="fit-screen">Fit Screen</button>
      ${supportsRotate ? `<button class="secondary-button" type="button" data-preview-action="rotate">Rotate</button><button class="secondary-button" type="button" data-preview-action="reset">Reset</button>` : ""}
      <button class="secondary-button" type="button" data-file-download="${file.id}">Download</button>
      <button class="primary-button" type="button" id="cancel-modal">Close</button>
    </div>
    <div class="preview-stage" data-preview-stage>
      ${loading ? `<div class="preview-loading"><span></span><strong>Loading preview...</strong></div>` : previewContent(file, type)}
    </div>
  </div>`;
}

function previewType(file) {
  const type = file.type || file.mimeType || "";
  const name = (file.name || "").toLowerCase();
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("text/") || /\.(txt|csv|log|json|md)$/i.test(name)) return "text";
  if (/\.(doc|docx)$/i.test(name)) return "word";
  if (/\.(xls|xlsx)$/i.test(name)) return "excel";
  if (/\.(ppt|pptx)$/i.test(name)) return "powerpoint";
  return "unsupported";
}

function previewContent(file, type) {
  if (type === "pdf") return `<iframe class="preview-document preview-pdf" src="${file.dataUrl}#toolbar=1&navpanes=0" title="${file.name}"></iframe>`;
  if (type === "image") return `<div class="preview-image-wrap"><img class="preview-document preview-image" src="${file.dataUrl}" alt="${file.name}" /></div>`;
  if (type === "text") return `<pre class="preview-document preview-text">${escapeHtml(readTextFile(file.dataUrl))}</pre>`;
  if (["word", "excel", "powerpoint"].includes(type)) {
    return `<div class="preview-fallback">
      <h2>${officeLabel(type)} preview requires document conversion.</h2>
      <p>This static prototype cannot securely convert Office files in-browser. In production, connect a server-side conversion service or Microsoft/Google document renderer, then load the converted preview here.</p>
      <p>Download remains available for authorized users.</p>
    </div>`;
  }
  return `<div class="preview-fallback"><h2>Preview is not available for this file type.</h2><p>Download remains available for authorized users.</p></div>`;
}

function officeLabel(type) {
  return { word: "Word document", excel: "Excel workbook", powerpoint: "PowerPoint presentation" }[type] || "Office document";
}

function readTextFile(dataUrl = "") {
  const payload = dataUrl.split(",")[1] || "";
  try {
    return decodeURIComponent(escape(atob(payload)));
  } catch {
    try {
      return atob(payload);
    } catch {
      return "Preview is not available for this text file.";
    }
  }
}

function escapeHtml(value = "") {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function handlePreviewAction(action) {
  if (!activePreview.fileId) return;
  if (action === "zoom-in") activePreview.zoom = Math.min(activePreview.zoom + 0.15, 3);
  if (action === "zoom-out") activePreview.zoom = Math.max(activePreview.zoom - 0.15, 0.4);
  if (action === "fit-width") {
    activePreview.mode = "fit-width";
    activePreview.zoom = 1.15;
  }
  if (action === "fit-screen") {
    activePreview.mode = "fit-screen";
    activePreview.zoom = 1;
  }
  if (action === "rotate") activePreview.rotation = (activePreview.rotation + 90) % 360;
  if (action === "reset") activePreview = { ...activePreview, zoom: 1, rotation: 0, mode: "fit-screen" };
  applyPreviewTransform();
}

function applyPreviewTransform() {
  const image = document.querySelector(".preview-image");
  if (image) image.style.transform = `scale(${activePreview.zoom}) rotate(${activePreview.rotation}deg)`;
  const text = document.querySelector(".preview-text");
  if (text) text.style.fontSize = `${Math.round(14 * activePreview.zoom)}px`;
  const pdf = document.querySelector(".preview-pdf");
  if (pdf) pdf.style.transform = `scale(${activePreview.zoom})`;
}

function downloadFile(fileId) {
  const file = getUploadById(fileId);
  if (!file) return;
  const link = document.createElement("a");
  link.href = file.dataUrl;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
