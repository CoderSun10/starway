const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { pool } = require('./db');
const { runMigrations } = require('./migrate');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const schedulesRouter = require('./routes/schedules');
const tasksRouter = require('./routes/tasks');
const sessionsRouter = require('./routes/sessions');
const statsRouter = require('./routes/stats');
const settingsRouter = require('./routes/settings');
const budgetPeriodsRouter = require('./routes/budgetPeriods');
const expensesRouter = require('./routes/expenses');

const app = express();
const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '0.0.0.0';

app.use(cors());
// 确保请求体按 UTF-8 解析
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// 所有 JSON 响应强制 UTF-8
app.use((req, res, next) => {
  const oldJson = res.json.bind(res);
  res.json = (body) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return oldJson(body);
  };
  next();
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      success: true,
      message: '星程 API OK',
      time: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      message: '数据库连接失败',
      error: err.message,
    });
  }
});

app.get('/api', (req, res) => {
  res.json({
    success: true,
    name: '星程 API',
    version: '1.0.0',
    endpoints: [
      'GET/POST /api/schedules',
      'GET/PUT/DELETE /api/schedules/:id',
      'GET/PATCH/DELETE /api/tasks',
      'GET/POST /api/sessions',
      'GET /api/stats/overview',
      'GET /api/stats/daily',
      'GET /api/stats/by-schedule',
      'GET /api/stats/by-task',
      'GET /api/stats/schedule/:id',
      'GET/PUT /api/settings',
      'GET/POST /api/budget-periods',
      'GET/PUT/DELETE /api/budget-periods/:id',
      'GET/POST /api/expenses',
      'GET/PUT/DELETE /api/expenses/:id',
      'GET /api/stats/day-summary',
    ],
  });
});

app.use('/api/schedules', schedulesRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/budget-periods', budgetPeriodsRouter);
app.use('/api/expenses', expensesRouter);

app.use(notFound);
app.use(errorHandler);

async function boot() {
  try {
    await runMigrations();
  } catch (err) {
    console.error('[migrate] aborted:', err.message);
    process.exit(1);
  }
  app.listen(PORT, HOST, () => {
    console.log(`星程 API running at http://${HOST}:${PORT}`);
    console.log(`Health: http://127.0.0.1:${PORT}/health`);
  });
}

boot();
