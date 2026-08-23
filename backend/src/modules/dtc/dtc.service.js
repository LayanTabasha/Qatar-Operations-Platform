import { ApiError } from "../../utils/api-error.js";
import {
  findDtcById,
  importDtcRecords,
  listDtcRecords,
  updateDtcById,
  updateDtcStatusById,
  upsertDtcRecord,
} from "./dtc.repository.js";
import { parseDtcWorkbook } from "./dtc-xlsx.parser.js";

function handleDtcWriteError(err) {
  if (err.code === "23505") {
    throw new ApiError(409, "DTC_CODE_ALREADY_EXISTS", "A DTC record already exists in this catalogue scope");
  }

  throw err;
}

export async function getDtcRecords(options) {
  return listDtcRecords(options);
}

export async function getDtcRecord(id) {
  const record = await findDtcById(id);

  if (!record) {
    throw new ApiError(404, "DTC_NOT_FOUND", "DTC record not found");
  }

  return record;
}

export async function createDtcRecord(input) {
  try {
    return await upsertDtcRecord(input);
  } catch (err) {
    handleDtcWriteError(err);
  }
}

export async function updateDtcRecord(id, input) {
  try {
    const record = await updateDtcById(id, input);

    if (!record) {
      throw new ApiError(404, "DTC_NOT_FOUND", "DTC record not found");
    }

    return record;
  } catch (err) {
    handleDtcWriteError(err);
  }
}

export async function updateDtcRecordStatus(id, isActive) {
  const record = await updateDtcStatusById(id, isActive);

  if (!record) {
    throw new ApiError(404, "DTC_NOT_FOUND", "DTC record not found");
  }

  return record;
}

export async function importDtcWorkbook(file, userId) {
  if (!file?.buffer) {
    throw new ApiError(400, "DTC_IMPORT_FILE_REQUIRED", "Choose a DTC Excel workbook before importing");
  }

  const parsed = parseDtcWorkbook(file.buffer);

  if (!parsed.records.length) {
    throw new ApiError(400, "DTC_IMPORT_EMPTY", "The DTC workbook does not contain importable records");
  }

  if (parsed.workbook.invalid_rows.length) {
    throw new ApiError(400, "DTC_IMPORT_INVALID_ROWS", "The DTC workbook contains invalid rows and was not imported");
  }

  const summary = await importDtcRecords(parsed.records, userId);

  return {
    ...summary,
    skipped_records: parsed.workbook.skipped_rows,
    invalid_records: parsed.workbook.invalid_rows.length,
    workbook: parsed.workbook,
  };
}
