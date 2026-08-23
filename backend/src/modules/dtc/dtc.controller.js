import { asyncHandler } from "../../utils/async-handler.js";
import {
  createDtcRecord,
  getDtcRecord,
  getDtcRecords,
  importDtcWorkbook,
  updateDtcRecord,
  updateDtcRecordStatus,
} from "./dtc.service.js";
import {
  createDtcSchema,
  dtcIdParamsSchema,
  listDtcQuerySchema,
  updateDtcSchema,
  updateDtcStatusSchema,
} from "./dtc.validation.js";

export const listDtc = asyncHandler(async (req, res) => {
  const query = listDtcQuerySchema.parse(req.query);
  const records = await getDtcRecords(query);

  res.json({
    success: true,
    dtc_records: records,
  });
});

export const getDtcById = asyncHandler(async (req, res) => {
  const { id } = dtcIdParamsSchema.parse(req.params);
  const record = await getDtcRecord(id);

  res.json({
    success: true,
    dtc_record: record,
  });
});

export const createDtc = asyncHandler(async (req, res) => {
  const input = createDtcSchema.parse(req.body);
  const record = await createDtcRecord(input);

  res.status(201).json({
    success: true,
    dtc_record: record,
  });
});

export const updateDtc = asyncHandler(async (req, res) => {
  const { id } = dtcIdParamsSchema.parse(req.params);
  const input = updateDtcSchema.parse(req.body);
  const record = await updateDtcRecord(id, input);

  res.json({
    success: true,
    dtc_record: record,
  });
});

export const updateDtcStatus = asyncHandler(async (req, res) => {
  const { id } = dtcIdParamsSchema.parse(req.params);
  const { is_active } = updateDtcStatusSchema.parse(req.body);
  const record = await updateDtcRecordStatus(id, is_active);

  res.json({
    success: true,
    dtc_record: record,
  });
});

export const importDtc = asyncHandler(async (req, res) => {
  const summary = await importDtcWorkbook(req.file, req.user.id);

  res.status(201).json({
    success: true,
    import_summary: summary,
  });
});
