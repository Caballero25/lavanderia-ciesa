import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('lavanderia.db');

export const initDB = async () => {
    try {
        await db.execAsync(`
      PRAGMA journal_mode = WAL;
      
      CREATE TABLE IF NOT EXISTS usuarios_sync (
        id INTEGER PRIMARY KEY NOT NULL,
        usuario TEXT UNIQUE NOT NULL,
        code TEXT UNIQUE NOT NULL,
        nombres TEXT,
        apellidos TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS entregas_pendientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT UNIQUE NOT NULL,
        fecha_registro TEXT NOT NULL,
        turno TEXT NOT NULL,
        codigo_operario TEXT NOT NULL,
        producto_expuesto INTEGER DEFAULT 1,
        mandil_limpio INTEGER DEFAULT 1,
        mandil_buen_estado INTEGER DEFAULT 1,
        observaciones TEXT,
        estado_envio TEXT DEFAULT 'PENDIENTE', -- PENDIENTE, ENVIADO, ERROR
        mensaje_error TEXT
      );
    `);
        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
};

export const getDB = () => db;
