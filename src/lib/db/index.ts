import { Pool } from '@neondatabase/serverless';

// Create a connection pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

export { pool };

// Helper function to run queries with parameters
export async function query<T>(
  queryText: string,
  params?: unknown[]
): Promise<T[]> {
  try {
    const result = await pool.query(queryText, params);
    return result.rows as T[];
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Helper for single row queries
export async function queryOne<T>(
  queryText: string,
  params?: unknown[]
): Promise<T | null> {
  const results = await query<T>(queryText, params);
  return results[0] || null;
}

// Helper for insert/update/delete operations
export async function execute(
  queryText: string,
  params?: unknown[]
): Promise<{ rowCount: number }> {
  try {
    const result = await pool.query(queryText, params);
    return { rowCount: result.rowCount ?? 0 };
  } catch (error) {
    console.error('Database execute error:', error);
    throw error;
  }
}
