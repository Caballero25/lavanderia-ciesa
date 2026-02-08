import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, Alert, RefreshControl } from 'react-native';
import { Appbar, IconButton, Text, useTheme, Dialog, Portal, Button, Card, SegmentedButtons, Chip, Surface, Snackbar } from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getDB } from '../database/db';
import { useSyncStore } from '../store/syncStore';
import dayjs from 'dayjs';
import DateTimePicker from '@react-native-community/datetimepicker';

const SyncPanelScreen = () => {
    const theme = useTheme();
    const navigation = useNavigation();
    const { syncEntregas, deleteEntrega, syncEntrega, isSyncingEntregas } = useSyncStore();

    // State
    const [entregas, setEntregas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [filterDate, setFilterDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [filterTurno, setFilterTurno] = useState('TODOS');

    // Dialogs & Feedback
    const [errorDialogVisible, setErrorDialogVisible] = useState(false);
    const [selectedError, setSelectedError] = useState('');
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');

    const loadData = async () => {
        setLoading(true);
        try {
            const db = getDB();
            const dateStr = dayjs(filterDate).format('YYYY-MM-DD');

            let query = `SELECT * FROM entregas_pendientes WHERE fecha_registro = ?`;
            const params = [dateStr];

            if (filterTurno !== 'TODOS') {
                query += ` AND turno = ?`;
                params.push(filterTurno);
            }

            query += ` ORDER BY id DESC`;

            const result = await db.getAllAsync(query, params);
            setEntregas(result);
        } catch (error) {
            console.error("Error loading sync data:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [filterDate, filterTurno]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const handleDelete = (id) => {
        Alert.alert(
            "Eliminar Registro",
            "¿Estás seguro de que deseas eliminar este registro localmente?",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Eliminar",
                    style: "destructive",
                    onPress: async () => {
                        await deleteEntrega(id);
                        loadData();
                    }
                }
            ]
        );
    };

    const handleSync = async (id = null) => {
        if (id) {
            // Reintentar UNO
            const result = await syncEntrega(id);
            if (result.success) {
                setSnackbarMessage("Registro sincronizado correctamente");
            } else {
                setSnackbarMessage("Error al sincronizar: " + result.error);
            }
            setSnackbarVisible(true);
        } else {
            // Reintentar TODOS (Fecha seleccionada)
            const dateStr = dayjs(filterDate).format('YYYY-MM-DD');
            const stats = await syncEntregas(dateStr);

            if (stats.total > 0) {
                Alert.alert(
                    "Resultado Sincronización",
                    `Total: ${stats.total}\nExitosos: ${stats.sent}\nFallidos: ${stats.failed}`
                );
            } else {
                setSnackbarMessage("No hay registros pendientes para esta fecha");
                setSnackbarVisible(true);
            }
        }
        loadData();
    };

    const onChangeDate = (event, selectedDate) => {
        setShowDatePicker(false);
        if (selectedDate) {
            setFilterDate(selectedDate);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'ENVIADO': return theme.colors.primary;
            case 'ERROR': return theme.colors.error;
            default: return theme.colors.tertiary;
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'ENVIADO': return 'Sincronizado';
            case 'ERROR': return 'Error al enviar';
            default: return 'Pendiente';
        }
    };

    const renderItem = ({ item }) => {
        const isSynced = item.estado_envio === 'ENVIADO';
        const isError = item.estado_envio === 'ERROR';
        const statusColor = getStatusColor(item.estado_envio);

        return (
            <Card style={[styles.card, { borderLeftColor: statusColor, borderLeftWidth: 6 }]} mode="elevated">
                <Card.Content>
                    <View style={styles.cardHeader}>
                        <View>
                            <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>Op: {item.codigo_operario}</Text>
                            <Text variant="bodySmall" style={{ color: 'gray' }}>Turno: {item.turno}</Text>
                        </View>
                        <Chip
                            icon={isSynced ? 'check' : (isError ? 'alert-circle' : 'clock')}
                            style={{ backgroundColor: theme.colors.surfaceVariant }}
                            textStyle={{ color: statusColor, fontWeight: 'bold' }}
                        >
                            {getStatusLabel(item.estado_envio)}
                        </Chip>
                    </View>

                    {item.observaciones ? (
                        <Text variant="bodyMedium" style={{ marginTop: 8 }}>Obs: {item.observaciones}</Text>
                    ) : null}

                    {isError && (
                        <View style={{ flexDirection: 'row', marginTop: 10 }}>
                            <Button
                                mode="contained-tonal"
                                textColor={theme.colors.error}
                                compact
                                onPress={() => {
                                    setSelectedError(item.mensaje_error);
                                    setErrorDialogVisible(true);
                                }}
                                style={{ marginRight: 10 }}
                            >
                                Ver Error
                            </Button>
                            <Button
                                mode="contained"
                                compact
                                onPress={() => handleSync(item.id)}
                            >
                                Reintentar
                            </Button>
                        </View>
                    )}
                </Card.Content>

                {!isSynced && (
                    <Card.Actions style={{ justifyContent: 'flex-end' }}>
                        <Button
                            icon="delete"
                            textColor="gray"
                            onPress={() => handleDelete(item.id)}
                        >
                            Eliminar
                        </Button>
                    </Card.Actions>
                )}
            </Card>
        );
    };

    const pendingCount = entregas.filter(e => e.estado_envio !== 'ENVIADO').length;
    const syncedCount = entregas.filter(e => e.estado_envio === 'ENVIADO').length;

    return (
        <View style={styles.container}>
            <Appbar.Header elevated>
                <Appbar.BackAction onPress={() => navigation.goBack()} />
                <Appbar.Content title="Reporte Entregas" />
                <Appbar.Action icon="sync" onPress={() => handleSync()} disabled={isSyncingEntregas} />
            </Appbar.Header>

            <View style={styles.filterContainer}>
                <View style={styles.dateRow}>
                    <IconButton
                        icon="chevron-left"
                        mode="contained-tonal"
                        onPress={() => setFilterDate(d => dayjs(d).subtract(1, 'day').toDate())}
                    />
                    <Button
                        mode="outlined"
                        icon="calendar"
                        onPress={() => setShowDatePicker(true)}
                        style={{ flex: 1, marginHorizontal: 10 }}
                    >
                        {dayjs(filterDate).format('DD/MM/YYYY')}
                    </Button>
                    <IconButton
                        icon="chevron-right"
                        mode="contained-tonal"
                        onPress={() => setFilterDate(d => dayjs(d).add(1, 'day').toDate())}
                        disabled={dayjs(filterDate).isSame(dayjs(), 'day', 'day')}
                    />
                    {showDatePicker && (
                        <DateTimePicker
                            value={filterDate}
                            mode="date"
                            display="default"
                            onChange={onChangeDate}
                            maximumDate={new Date()}
                        />
                    )}
                </View>

                <SegmentedButtons
                    value={filterTurno}
                    onValueChange={setFilterTurno}
                    buttons={[
                        { value: 'TODOS', label: 'Todos' },
                        { value: 'DIURNO', label: 'Diurno' },
                        { value: 'NOCTURNO', label: 'Nocturno' },
                    ]}
                    style={styles.segmentedBtn}
                    density="small"
                />
            </View>

            <Surface style={styles.statsContainer} elevation={1}>
                <Text style={styles.statText}>Total: <Text style={{ fontWeight: 'bold' }}>{entregas.length}</Text></Text>
                <Text style={styles.statText}> | </Text>
                <Text style={[styles.statText, { color: theme.colors.primary }]}>Enviados: <Text style={{ fontWeight: 'bold' }}>{syncedCount}</Text></Text>
                <Text style={styles.statText}> | </Text>
                <Text style={[styles.statText, { color: theme.colors.tertiary }]}>Pendientes: <Text style={{ fontWeight: 'bold' }}>{pendingCount}</Text></Text>
            </Surface>

            <FlatList
                data={entregas}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderItem}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text variant="bodyLarge" style={{ color: 'gray' }}>No se encontraron registros para esta fecha/turno.</Text>
                    </View>
                }
            />

            <Portal>
                <Dialog visible={errorDialogVisible} onDismiss={() => setErrorDialogVisible(false)}>
                    <Dialog.Title>Error de Sincronización</Dialog.Title>
                    <Dialog.Content>
                        <Text>{selectedError}</Text>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setErrorDialogVisible(false)}>Cerrar</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            <Snackbar
                visible={snackbarVisible}
                onDismiss={() => setSnackbarVisible(false)}
                duration={3000}
                style={{ backgroundColor: theme.colors.inverseSurface }}
            >
                {snackbarMessage}
            </Snackbar>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    filterContainer: {
        padding: 15,
        backgroundColor: 'white',
        elevation: 2
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10
    },
    segmentedBtn: {
        marginTop: 5
    },
    statsContainer: {
        flexDirection: 'row',
        padding: 10,
        justifyContent: 'center',
        backgroundColor: '#fff',
        marginHorizontal: 15,
        marginTop: 10,
        borderRadius: 8,
        alignItems: 'center'
    },
    statText: {
        fontSize: 14
    },
    listContent: {
        padding: 15,
        paddingBottom: 30
    },
    card: {
        marginBottom: 12,
        backgroundColor: 'white'
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
    },
    emptyContainer: {
        alignItems: 'center',
        padding: 40
    }
});

export default SyncPanelScreen;
