import { Router } from 'express';
import { getAllMeasurements, getLatestWeights } from '../lib/eufyData.js';
import { getExistingKeys, appendRows } from '../lib/googleSheets.js';

const router = Router();

// 体重計を使った人ごとの最新測定値。iOSショートカット(Apple Healthへの記録用)から叩く想定
router.get('/weight', async (req, res) => {
  try {
    res.json(await getLatestWeights());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Eufyクラウドの測定履歴をGoogle Sheetsへ追記する(GitHub Actionsから定期的に叩く想定)
router.post('/sync', async (req, res) => {
  const secret = process.env.SYNC_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'SYNC_SECRET is not set' });
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME || 'Sheet1';
  if (!spreadsheetId) {
    return res.status(500).json({ error: 'GOOGLE_SHEETS_SPREADSHEET_ID is not set' });
  }

  try {
    const measurements = await getAllMeasurements();
    const existingKeys = await getExistingKeys(spreadsheetId, sheetName);

    const newRows = measurements.filter((m) => !existingKeys.has(`${m.customerId}:${m.updatedAt}`));
    const rows = newRows.map((m) => [
      m.updatedAt,
      m.customerId,
      m.weight,
      m.bodyFat,
      m.muscleMass,
      m.bmi,
      m.waterPercentage,
      m.boneMass,
      m.bmr,
      m.bodyAge,
      m.visceralFat,
    ]);

    await appendRows(spreadsheetId, sheetName, rows);
    res.json({ checked: measurements.length, pushed: rows.length });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
