const express = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// GET /api/settings
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await query('SELECT setting_key, setting_value FROM app_settings');
    const data = {};
    for (const r of rows) {
      data[r.setting_key] = r.setting_value;
    }
    if (!data.timezone_mode) {
      data.timezone_mode = 'Asia/Shanghai';
    }
    res.json({ success: true, data });
  })
);

// PUT /api/settings
router.put(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const allowed = ['timezone_mode'];
    for (const key of allowed) {
      if (body[key] !== undefined) {
        let value = String(body[key]);
        if (key === 'timezone_mode') {
          if (value !== 'Asia/Shanghai' && value !== 'device') {
            const err = new Error('timezone_mode 只能是 Asia/Shanghai 或 device');
            err.status = 400;
            throw err;
          }
        }
        await query(
          `INSERT INTO app_settings (setting_key, setting_value)
           VALUES (?, ?)
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
          [key, value]
        );
      }
    }
    const rows = await query('SELECT setting_key, setting_value FROM app_settings');
    const data = {};
    for (const r of rows) data[r.setting_key] = r.setting_value;
    res.json({ success: true, data });
  })
);

module.exports = router;
