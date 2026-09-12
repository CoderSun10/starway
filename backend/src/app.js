const express = require('express');
const cors = require('cors');

const { pool } = require('./db');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { authRequired } = require('./middleware/auth');
const authRouter = require('./routes/auth');
const schedulesRouter = require('./routes/schedules');
const tasksRouter = require('./routes/tasks');
const sessionsRouter = require('./routes/sessions');
const statsRouter = require('./routes/stats');
const settingsRouter = require('./routes/settings');
const budgetPeriodsRouter = require('./routes/budgetPeriods');
const expensesRouter = require('./routes/expenses');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

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
      version: '1.1.0',
      endpoints: [
        'POST /api/auth/send-code',
        'POST /api/auth/register',
        'POST /api/auth/login',
        'POST /api/auth/reset-password',
        'GET /api/auth/me',
        'POST /api/auth/change-password',
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

  app.use('/api/auth', authRouter);
  app.use('/api/schedules', authRequired, schedulesRouter);
  app.use('/api/tasks', authRequired, tasksRouter);
  app.use('/api/sessions', authRequired, sessionsRouter);
  app.use('/api/stats', authRequired, statsRouter);
  app.use('/api/settings', authRequired, settingsRouter);
  app.use('/api/budget-periods', authRequired, budgetPeriodsRouter);
  app.use('/api/expenses', authRequired, expensesRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
