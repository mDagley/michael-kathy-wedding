// lib/sheet-file.js
import { promises as fs } from 'node:fs';

// Records: { timestamp, name, email, attending, dietary, notes }. Email is stored lowercase.
export function createFileSheet(path) {
  const read = async () => {
    try {
      return JSON.parse(await fs.readFile(path, 'utf8'));
    } catch (e) {
      if (e.code === 'ENOENT') return [];
      throw e;
    }
  };
  const write = (rows) => fs.writeFile(path, JSON.stringify(rows, null, 2));
  return {
    async findByEmail(email) {
      const rows = await read();
      const i = rows.findIndex((r) => r.email === email);
      return i < 0 ? null : { rowIndex: i, record: rows[i] };
    },
    async append(record) {
      const rows = await read();
      rows.push(record);
      await write(rows);
    },
    async update(rowIndex, record) {
      const rows = await read();
      rows[rowIndex] = record;
      await write(rows);
    },
  };
}
