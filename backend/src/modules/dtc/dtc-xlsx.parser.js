import zlib from "node:zlib";
import { ApiError } from "../../utils/api-error.js";
import { normalizeDtcCode } from "./dtc.repository.js";

const requiredHeaders = ["ECU", "DTC1", "FTB1", "DTC Description"];
const expectedDtcSheet = "DTC";

function readUInt32(buffer, offset) {
  return buffer.readUInt32LE(offset);
}

function readUInt16(buffer, offset) {
  return buffer.readUInt16LE(offset);
}

function decodeXml(value = "") {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function parseAttributes(source = "") {
  const attributes = {};
  for (const match of source.matchAll(/([\w:]+)="([^"]*)"/g)) {
    attributes[match[1]] = match[2];
  }
  return attributes;
}

function findEndOfCentralDirectory(buffer) {
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (readUInt32(buffer, offset) === 0x06054b50) return offset;
  }

  throw new ApiError(400, "INVALID_XLSX_FILE", "The uploaded file is not a valid XLSX workbook");
}

function unzipXlsxEntries(buffer) {
  const endOffset = findEndOfCentralDirectory(buffer);
  const totalEntries = readUInt16(buffer, endOffset + 10);
  const centralDirectoryOffset = readUInt32(buffer, endOffset + 16);
  const entries = new Map();
  let offset = centralDirectoryOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (readUInt32(buffer, offset) !== 0x02014b50) {
      throw new ApiError(400, "INVALID_XLSX_FILE", "The uploaded workbook central directory is invalid");
    }

    const compressionMethod = readUInt16(buffer, offset + 10);
    const compressedSize = readUInt32(buffer, offset + 20);
    const fileNameLength = readUInt16(buffer, offset + 28);
    const extraLength = readUInt16(buffer, offset + 30);
    const commentLength = readUInt16(buffer, offset + 32);
    const localHeaderOffset = readUInt32(buffer, offset + 42);
    const fileName = buffer.toString("utf8", offset + 46, offset + 46 + fileNameLength);

    if (readUInt32(buffer, localHeaderOffset) !== 0x04034b50) {
      throw new ApiError(400, "INVALID_XLSX_FILE", "The uploaded workbook contains an invalid file entry");
    }

    const localFileNameLength = readUInt16(buffer, localHeaderOffset + 26);
    const localExtraLength = readUInt16(buffer, localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
    const compressedData = buffer.subarray(dataStart, dataStart + compressedSize);
    let data;

    if (compressionMethod === 0) data = compressedData;
    else if (compressionMethod === 8) data = zlib.inflateRawSync(compressedData);
    else throw new ApiError(400, "UNSUPPORTED_XLSX_COMPRESSION", "The workbook uses an unsupported XLSX compression method");

    entries.set(fileName.replace(/\\/g, "/"), data.toString("utf8"));
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function parseSharedStrings(xml = "") {
  const strings = [];
  for (const si of xml.matchAll(/<si[\s\S]*?<\/si>/g)) {
    let text = "";
    for (const part of si[0].matchAll(/<t(?: [^>]*)?>([\s\S]*?)<\/t>/g)) {
      text += decodeXml(part[1]);
    }
    strings.push(text);
  }
  return strings;
}

function columnNumber(cellRef) {
  const letters = (cellRef.match(/[A-Z]+/) || [""])[0];
  return [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0);
}

function rowNumber(cellRef) {
  return Number((cellRef.match(/\d+/) || [0])[0]);
}

function cellValue(cellXml, sharedStrings) {
  const attributes = parseAttributes((cellXml.match(/<c\s+([^>]*)>/) || ["", ""])[1]);
  const valueMatch = cellXml.match(/<v>([\s\S]*?)<\/v>/);
  const inlineMatch = cellXml.match(/<is>[\s\S]*?<t(?: [^>]*)?>([\s\S]*?)<\/t>[\s\S]*?<\/is>/);
  const rawValue = valueMatch ? decodeXml(valueMatch[1]) : inlineMatch ? decodeXml(inlineMatch[1]) : "";

  if (attributes.t === "s") return sharedStrings[Number(rawValue)] || "";
  return rawValue;
}

function parseSheetRows(xml, sharedStrings) {
  const rows = new Map();

  for (const match of xml.matchAll(/<c\s[^>]*r="([A-Z]+\d+)"[\s\S]*?<\/c>/g)) {
    const ref = match[1];
    const row = rowNumber(ref);
    const column = columnNumber(ref);
    if (!rows.has(row)) rows.set(row, {});
    rows.get(row)[column] = String(cellValue(match[0], sharedStrings)).trim();
  }

  return [...rows.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([number, cells]) => ({ number, cells }));
}

function workbookSheets(entries) {
  const workbookXml = entries.get("xl/workbook.xml");
  const relsXml = entries.get("xl/_rels/workbook.xml.rels");

  if (!workbookXml || !relsXml) {
    throw new ApiError(400, "INVALID_XLSX_FILE", "The workbook is missing required XLSX metadata");
  }

  const relationships = {};
  for (const match of relsXml.matchAll(/<Relationship\s+([^>]*)\/>/g)) {
    const attributes = parseAttributes(match[1]);
    relationships[attributes.Id] = attributes.Target;
  }

  const sheets = [];
  for (const match of workbookXml.matchAll(/<sheet\s+([^>]*)\/>/g)) {
    const attributes = parseAttributes(match[1]);
    const target = relationships[attributes["r:id"]];
    if (target) {
      sheets.push({
        name: attributes.name,
        path: `xl/${target.replace(/^\//, "").replace(/^xl\//, "")}`,
      });
    }
  }

  return sheets;
}

function rowValues(row) {
  const maxColumn = Math.max(0, ...Object.keys(row.cells).map(Number));
  return Array.from({ length: maxColumn }, (_, index) => row.cells[index + 1] || "");
}

function headerMap(values) {
  return values.reduce((map, header, index) => {
    if (header) map[header.trim()] = index;
    return map;
  }, {});
}

function valueAt(values, headers, header) {
  return String(values[headers[header]] || "").trim();
}

function firstLine(value) {
  return String(value || "").split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "";
}

function detectDuplicateKeys(records) {
  const seen = new Set();
  const duplicates = new Set();

  for (const record of records) {
    const key = [
      normalizeDtcCode(record.dtc_code),
      record.ftb_code || "",
      record.charger_model || "",
      record.component || "",
    ].join("|");

    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }

  return duplicates;
}

export function parseDtcWorkbook(buffer) {
  const entries = unzipXlsxEntries(buffer);
  const sharedStrings = parseSharedStrings(entries.get("xl/sharedStrings.xml") || "");
  const sheets = workbookSheets(entries);
  const sheetNames = sheets.map((sheet) => sheet.name);
  const dtcSheet = sheets.find((sheet) => sheet.name === expectedDtcSheet);

  if (!dtcSheet) {
    throw new ApiError(400, "DTC_SHEET_NOT_FOUND", "The workbook must contain a DTC sheet");
  }

  const coverSheet = sheets.find((sheet) => sheet.name.toLowerCase() === "cover");
  let sourceVersion = "";
  let chargerModel = "";

  if (coverSheet && entries.has(coverSheet.path)) {
    const coverRows = parseSheetRows(entries.get(coverSheet.path), sharedStrings);
    const versionIndex = coverRows.findIndex((row) => Object.values(row.cells).some((value) => String(value).toLowerCase() === "current version"));
    const projectRow = coverRows.find((row) => Object.values(row.cells).some((value) => String(value).toLowerCase() === "project:"));
    const versionRows = versionIndex >= 0 ? [coverRows[versionIndex], coverRows[versionIndex + 1]].filter(Boolean) : [];
    sourceVersion = versionRows.flatMap(rowValues).find((value) => /^v\d/i.test(value)) || "";
    chargerModel = projectRow ? rowValues(projectRow).find((value) => value && value !== "Project:") || "" : "";
  }

  const rows = parseSheetRows(entries.get(dtcSheet.path), sharedStrings);
  const headerRow = rows[0];
  const headers = headerMap(rowValues(headerRow));
  const missingHeaders = requiredHeaders.filter((header) => !(header in headers));

  if (missingHeaders.length) {
    throw new ApiError(400, "INVALID_DTC_HEADERS", `The DTC sheet is missing required columns: ${missingHeaders.join(", ")}`);
  }

  const records = [];
  const invalidRows = [];
  let skippedRows = 0;

  rows.slice(1).forEach((row) => {
    const values = rowValues(row);
    if (!values.some(Boolean)) {
      skippedRows += 1;
      return;
    }

    const dtcCode = valueAt(values, headers, "DTC1");
    const description = valueAt(values, headers, "DTC Description");

    if (!dtcCode || !description) {
      skippedRows += 1;
      return;
    }

    const manufacturerData = {
      message_on_can: valueAt(values, headers, "Message on CAN"),
      message_backend_side_a: valueAt(values, headers, "Message on Backend Side A"),
      message_backend_side_b: valueAt(values, headers, "Message on Backend Side B"),
      gun_status_unavailable_or_fault: valueAt(values, headers, "Gun Status Unavailable/Fault\r\n(Vehicle Charing Disable)"),
      hv_shutdown: valueAt(values, headers, "HV Shutdown"),
      comments: valueAt(values, headers, "Comments"),
      monitor_enable_conditions: valueAt(values, headers, "Monitor Enable Conditions"),
      monitor_type: valueAt(values, headers, "Monitor Type5"),
      monitor_rate: valueAt(values, headers, "Monitor                   Rate"),
    };

    records.push({
      dtc_code: dtcCode,
      ftb_code: valueAt(values, headers, "FTB1"),
      fault_title: firstLine(description),
      description,
      possible_causes: valueAt(values, headers, "Failure Criteria \r\n(Test Result NOK)"),
      recommended_actions: valueAt(values, headers, "Repair Action"),
      severity: manufacturerData.hv_shutdown || "",
      category: manufacturerData.gun_status_unavailable_or_fault || manufacturerData.monitor_type || "",
      charger_model: chargerModel || "",
      component: valueAt(values, headers, "ECU"),
      source_version: sourceVersion || "",
      source_sheet: dtcSheet.name,
      source_row: row.number,
      manufacturer_data: manufacturerData,
      is_active: true,
    });
  });

  const duplicateKeys = detectDuplicateKeys(records);

  if (duplicateKeys.size) {
    throw new ApiError(400, "DUPLICATE_DTC_CODES", `The workbook contains ${duplicateKeys.size} duplicate DTC/FTB records`);
  }

  return {
    workbook: {
      sheet_names: sheetNames,
      source_version: sourceVersion,
      charger_model: chargerModel,
      header_row: headerRow.number,
      headers: rowValues(headerRow),
      skipped_rows: skippedRows,
      invalid_rows: invalidRows,
      merged_cells: "Not parsed by importer",
    },
    records,
  };
}
