/**
 * Database Connection Helper
 */

import mysql from 'mysql2/promise';

export const dbConfig: mysql.ConnectionOptions = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'paca',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'univjungsi',
  charset: 'utf8mb4',
};

export async function getConnection(): Promise<mysql.Connection> {
  return mysql.createConnection(dbConfig);
}

export async function query<T extends mysql.RowDataPacket[]>(
  sql: string,
  params?: unknown[]
): Promise<T> {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute<T>(sql, params);
    return rows;
  } finally {
    await connection.end();
  }
}
