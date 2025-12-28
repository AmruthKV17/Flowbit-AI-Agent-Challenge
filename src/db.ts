import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

export const pool = new Pool({
  user: process.env.PG_USER,       
  host: process.env.PG_HOST,
  database: process.env.PG_DB, 
  password: process.env.PG_PASSWORD,    
  port: Number(process.env.PG_PORT),
});

export async function testConnection() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT NOW() as now');
    console.log('DB connected, time:', res.rows[0].now);
  } finally {
    client.release();
  }
}
