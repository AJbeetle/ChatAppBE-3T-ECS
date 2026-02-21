import { pool } from "../db";

export async function ensureRoom(roomId: string) {
  await pool.query(
    `INSERT INTO rooms(id)
     VALUES ($1)
     ON CONFLICT DO NOTHING`,
    [roomId]
  );
}

export async function insertMessage(
  roomId: string,
  connectionId: string,
  message: string
) {
  await pool.query(
    `INSERT INTO messages(room_id, connection_id, message)
     VALUES ($1,$2,$3)`,
    [roomId, connectionId, message]
  );
}

export async function getMessages(roomId: string, limit = 50) {
  const { rows } = await pool.query(
    `SELECT id, room_id, connection_id, message, created_at
     FROM messages
     WHERE room_id = $1
     ORDER BY id ASC
     LIMIT $2`,
    [roomId, limit]
  );

  return rows;
}