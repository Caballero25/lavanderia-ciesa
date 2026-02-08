import { create } from 'zustand';
import { getDB } from '../database/db';
import api from '../services/api';
import dayjs from 'dayjs';
import * as SQLite from 'expo-sqlite';

// Helper para ejecutar transacciones
const executeSql = async (sql, params = []) => {
    const db = getDB();
    return await db.runAsync(sql, params);
};

const getAllSql = async (sql, params = []) => {
    const db = getDB();
    return await db.getAllAsync(sql, params);
};

export const useSyncStore = create((set, get) => ({
    isSyncingUsers: false,
    isSyncingEntregas: false,
    uploadStatus: null, // { type: 'success' | 'error', message: string }

    // Sincronizar Usuarios (Bajada)
    syncUsers: async () => {
        set({ isSyncingUsers: true });
        try {
            const response = await api.get('/lavanderia/entrega-mandiles/usuarios-sync');
            const users = response.data.data; // { sms: 'ok', data: [...] }

            if (!users || !Array.isArray(users)) {
                throw new Error('Formato de respuesta inválido');
            }

            const db = getDB();
            // Usar transacción para inserción masiva
            await db.withTransactionAsync(async () => {
                // Opcional: Limpiar tabla antes de insertar si queremos full sync limpio
                // await db.execAsync('DELETE FROM usuarios_sync'); 

                for (const user of users) {
                    await db.runAsync(
                        `INSERT OR REPLACE INTO usuarios_sync (id, usuario, code, nombres, apellidos, updated_at)
             VALUES (?, ?, ?, ?, ?, ?);`,
                        [
                            user.pre_usuario_id, // Usamos ID del backend como ID local también
                            user.usuario,
                            user.code,
                            user.nombres,
                            user.apellidos,
                            user.updated_at
                        ]
                    );
                }
            });

            console.log(`Sincronizados ${users.length} usuarios.`);
            set({ isSyncingUsers: false });
            return { success: true, count: users.length };
        } catch (error) {
            console.error('Error syncing users:', error);
            set({ isSyncingUsers: false });
            return { success: false, error: error.message };
        }
    },

    // Guardar Entrega (Local + Intento de Subida)
    saveEntrega: async (entregaData) => {
        try {
            const {
                uuid,
                fecha_registro,
                turno,
                codigo_operario,
                producto_expuesto,
                mandil_limpio,
                mandil_buen_estado,
                observaciones
            } = entregaData;

            // 1. Guardar en SQLite
            const result = await executeSql(
                `INSERT INTO entregas_pendientes (
          uuid, fecha_registro, turno, codigo_operario, 
          producto_expuesto, mandil_limpio, mandil_buen_estado, observaciones, 
          estado_envio
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE');`,
                [
                    uuid, fecha_registro, turno, codigo_operario,
                    producto_expuesto ? 1 : 0,
                    mandil_limpio ? 1 : 0,
                    mandil_buen_estado ? 1 : 0,
                    observaciones
                ]
            );

            const insertId = result.lastInsertRowId;
            console.log('Entrega guardada localmente, ID:', insertId);

            // 2. Intentar subir inmediatamente
            get().syncEntregas(); // Ejecutar en background (no await)

            return { success: true, id: insertId };
        } catch (error) {
            console.error('Error saving entrega locally:', error);
            return { success: false, error: error.message };
        }
    },

    // Sincronizar Entregas Pendientes (Subida)
    syncEntregas: async (dateFilter = null) => {
        if (get().isSyncingEntregas) return { total: 0, sent: 0, failed: 0 };
        set({ isSyncingEntregas: true });

        let stats = { total: 0, sent: 0, failed: 0 };

        try {
            // Construir query
            let query = `SELECT * FROM entregas_pendientes WHERE estado_envio != 'ENVIADO'`;
            const params = [];

            if (dateFilter) {
                query += ` AND fecha_registro = ?`;
                params.push(dateFilter);
            }

            const pendientes = await getAllSql(query, params);

            if (pendientes.length === 0) {
                set({ isSyncingEntregas: false });
                return stats;
            }

            console.log(`Sincronizando ${pendientes.length} entregas${dateFilter ? ` del ${dateFilter}` : ''}...`);
            stats.total = pendientes.length;

            for (const item of pendientes) {
                try {
                    // Mapear al formato que espera el backend
                    const payload = {
                        fecha_registro: item.fecha_registro,
                        turno: item.turno,
                        codigo_operario: item.codigo_operario,
                        producto_expuesto: item.producto_expuesto === 1,
                        mandil_limpio: item.mandil_limpio === 1,
                        mandil_buen_estado: item.mandil_buen_estado === 1,
                        observaciones: item.observaciones,
                    };

                    await api.post('/lavanderia/entrega-mandiles', payload);

                    await executeSql(
                        `UPDATE entregas_pendientes SET estado_envio = 'ENVIADO', mensaje_error = NULL WHERE id = ?`,
                        [item.id]
                    );
                    stats.sent++;
                } catch (apiError) {
                    console.log(`Error enviando entrega ${item.id}:`, apiError.message);
                    await executeSql(
                        `UPDATE entregas_pendientes SET estado_envio = 'ERROR', mensaje_error = ? WHERE id = ?`,
                        [apiError.message, item.id]
                    );
                    stats.failed++;
                }
            }

            set({ isSyncingEntregas: false });
            return stats;
        } catch (error) {
            console.log('Error global syncing entregas:', error);
            set({ isSyncingEntregas: false });
            return stats;
        }
    },

    // Reintentar UNA SOLA entrega
    syncEntrega: async (id) => {
        set({ isSyncingEntregas: true });
        try {
            const result = await getAllSql(`SELECT * FROM entregas_pendientes WHERE id = ?`, [id]);
            if (result.length === 0) {
                set({ isSyncingEntregas: false });
                return { success: false, error: 'Registro no encontrado' };
            }
            const item = result[0];

            const payload = {
                fecha_registro: item.fecha_registro,
                turno: item.turno,
                codigo_operario: item.codigo_operario,
                producto_expuesto: item.producto_expuesto === 1,
                mandil_limpio: item.mandil_limpio === 1,
                mandil_buen_estado: item.mandil_buen_estado === 1,
                observaciones: item.observaciones,
            };

            await api.post('/lavanderia/entrega-mandiles', payload);

            await executeSql(
                `UPDATE entregas_pendientes SET estado_envio = 'ENVIADO', mensaje_error = NULL WHERE id = ?`,
                [item.id]
            );

            set({ isSyncingEntregas: false });
            return { success: true };

        } catch (error) {
            await executeSql(
                `UPDATE entregas_pendientes SET estado_envio = 'ERROR', mensaje_error = ? WHERE id = ?`,
                [error.message, id]
            );
            set({ isSyncingEntregas: false });
            return { success: false, error: error.message };
        }
    },

    deleteEntrega: async (id) => {
        try {
            await executeSql(`DELETE FROM entregas_pendientes WHERE id = ?`, [id]);
            return { success: true };
        } catch (error) {
            console.error('Error deleting entrega:', error);
            return { success: false, error: error.message };
        }
    }
}));
