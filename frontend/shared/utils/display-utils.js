function safeDetailValue(value) {
  if (typeof formatSettingValue === "function") return formatSettingValue(value);
  return String(valueOrPlaceholder(value))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
