import { createPool } from '../../db/index.ts';

let _sqlOperational: boolean | null = null;
let _lastCheckTime = 0;

export async function isSqlEnabled(): Promise<boolean> {
  const hasEnv = Boolean(
    process.env.SQL_HOST || process.env.SQL_USER || process.env.SQL_DB_NAME
  );
  if (!hasEnv) return false;

  const now = Date.now();
  if (_sqlOperational !== null && now - _lastCheckTime < 30000) {
    return _sqlOperational;
  }

  try {
    const pool = createPool();
    await pool.query('SELECT 1');
    _sqlOperational = true;
    _lastCheckTime = now;
    return true;
  } catch (err: any) {
    console.warn('[SQL Mirror] SQL not reachable, running without SQL mirror:', err?.message || err);
    _sqlOperational = false;
    _lastCheckTime = now;
    return false;
  }
}

export function getSqlStatus(): 'up' | 'down' | 'disabled' {
  const hasEnv = Boolean(
    process.env.SQL_HOST || process.env.SQL_USER || process.env.SQL_DB_NAME
  );
  if (!hasEnv) return 'disabled';
  return _sqlOperational === true ? 'up' : _sqlOperational === false ? 'down' : 'up';
}
