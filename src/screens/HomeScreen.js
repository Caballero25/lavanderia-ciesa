import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Alert, Keyboard, TouchableOpacity } from 'react-native';
import { Text, Button, TextInput, Appbar, ActivityIndicator, IconButton, Card, useTheme, ProgressBar, Snackbar } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncStore } from '../store/syncStore';
import DeliveryFormModal from '../components/DeliveryFormModal';
import { getDB } from '../database/db';
import dayjs from 'dayjs';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

const HomeScreen = ({ navigation }) => {
    const theme = useTheme();
    const [manualCode, setManualCode] = useState('');
    const [turno, setTurno] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [currentData, setCurrentData] = useState(null); // { code, nombre, ... }
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const inputRef = useRef(null);

    // Store logic
    const { syncUsers, saveEntrega, syncEntregas, isSyncingUsers, isSyncingEntregas } = useSyncStore();

    useEffect(() => {
        loadTurno();
        syncUsers().then(() => syncEntregas()); // Sync inicial
    }, []);

    const loadTurno = async () => {
        const savedTurno = await AsyncStorage.getItem('TURNO');
        if (savedTurno) setTurno(savedTurno);
    };

    const saveTurno = async (t) => {
        await AsyncStorage.setItem('TURNO', t);
        setTurno(t);
    };

    const handleSubmit = () => {
        if (!manualCode.trim() || !turno) return;

        const rawData = manualCode.trim();

        // Lógica de parsing para el formato específico mencionado: "1712345678 3678 PRODUCCION MANTA"
        // O cualquier código simple.
        let codeToSearch = rawData;
        const parts = rawData.split(' ');
        if (parts.length >= 2) {
            // Heurística simple: Si hay espacios, asumimos que el segundo elemento podría ser el código de operario
            // Ajustar según la estructura real del QR de la empresa.
            // Ejemplo: "CEDULA CODIGO ..."
            codeToSearch = parts[1];
        }

        processCode(codeToSearch);
        setManualCode('');
        // Mantener el foco
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const processCode = async (code) => {
        // Buscar usuario en DB local
        const db = getDB();
        let nombreFound = null;
        try {
            // Buscar por code OR usuario
            const result = await db.getAllAsync(
                `SELECT * FROM usuarios_sync WHERE code = ? OR usuario = ? LIMIT 1`,
                [code, code]
            );
            if (result.length > 0) {
                const u = result[0];
                nombreFound = `${u.nombres || ''} ${u.apellidos || ''}`.trim();
            }
        } catch (e) {
            console.error("Error buscando usuario local:", e);
        }

        setCurrentData({
            code: code,
            nombre: nombreFound || 'Desconocido'
        });
        setModalVisible(true);
        Keyboard.dismiss();
    };

    const onSaveEntrega = async (formData) => {
        setModalVisible(false);

        const entregaData = {
            uuid: uuidv4(),
            fecha_registro: dayjs().format('YYYY-MM-DD'), // Fecha local
            turno,
            codigo_operario: currentData.code,
            producto_expuesto: formData.producto_expuesto,
            mandil_limpio: formData.mandil_limpio,
            mandil_buen_estado: formData.mandil_buen_estado,
            observaciones: formData.observaciones
        };

        const result = await saveEntrega(entregaData);
        if (result.success) {
            setSnackbarMessage("Registro guardado (Sincronización en segundo plano)");
            setSnackbarVisible(true);
        } else {
            Alert.alert("Error", "No se pudo guardar localmente: " + result.error);
        }

        // Re-enfocar para siguiente escaneo
        setTimeout(() => inputRef.current?.focus(), 500);
    };

    // Keypad Logic
    const handleKeyPress = (key) => {
        setManualCode(prev => prev + key);
        // Ensure input keeps focus for scanner
        inputRef.current?.focus();
    };

    const handleBackspace = () => {
        setManualCode(prev => prev.slice(0, -1));
        inputRef.current?.focus();
    };

    const handleLongBackspace = () => {
        setManualCode('');
        inputRef.current?.focus();
    };

    const KeypadButton = ({ label, onPress, onLongPress, icon, color }) => (
        <TouchableOpacity
            style={[styles.keypadButton, { backgroundColor: color || theme.colors.elevation.level1 }]}
            onPress={onPress}
            onLongPress={onLongPress}
            activeOpacity={0.7}
        >
            {icon ? <IconButton icon={icon} size={32} /> : <Text style={styles.keypadText}>{label}</Text>}
        </TouchableOpacity>
    );

    if (!turno) {
        return (
            <View style={styles.centerContainer}>
                <Card style={{ padding: 20, margin: 20, backgroundColor: 'white', elevation: 4 }}>
                    <Text variant="headlineMedium" style={{ marginBottom: 30, textAlign: 'center', color: theme.colors.primary, fontWeight: 'bold' }}>
                        Seleccione Turno
                    </Text>
                    <Button
                        mode="contained"
                        onPress={() => saveTurno('DIURNO')}
                        style={styles.turnoBtn}
                        contentStyle={{ height: 60 }}
                        icon="weather-sunny"
                    >
                        DIURNO
                    </Button>
                    <Button
                        mode="contained"
                        onPress={() => saveTurno('NOCTURNO')}
                        style={styles.turnoBtn}
                        contentStyle={{ height: 60 }}
                        buttonColor={theme.colors.secondary}
                        icon="weather-night"
                    >
                        NOCTURNO
                    </Button>
                </Card>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <Appbar.Header elevated style={{ backgroundColor: theme.colors.primary }}>
                <Appbar.Content title="Entrega Mandiles" subtitle={`Turno: ${turno}`} color={theme.colors.onPrimary} />
                <Appbar.Action icon="sync" color={theme.colors.onPrimary} onPress={() => navigation.navigate('SyncPanel')} />
                <Appbar.Action icon="cog" color={theme.colors.onPrimary} onPress={() => Alert.alert("Cambiar Turno", "¿Desea cambiar el turno?", [
                    { text: "Cancelar" },
                    { text: "Sí", onPress: () => setTurno(null) }
                ])} />
            </Appbar.Header>

            {(isSyncingUsers || isSyncingEntregas) && <ProgressBar indeterminate color={theme.colors.tertiary} />}

            <View style={styles.displayContainer}>
                {/* Hidden Input for Scanner Interception */}
                <TextInput
                    ref={inputRef}
                    value={manualCode}
                    onChangeText={setManualCode}
                    onSubmitEditing={handleSubmit}
                    autoFocus={true}
                    showSoftInputOnFocus={false}
                    caretHidden={false}
                    style={styles.hiddenInput} // Visible but styled to look like display
                    mode="flat"
                    underlineColor="transparent"
                    activeUnderlineColor="transparent"
                    selectionColor={theme.colors.primary}
                    contentStyle={{ fontSize: 32, textAlign: 'center', fontWeight: 'bold' }}
                />
                <Text style={styles.helperText}>Escanee el código QR o use el teclado</Text>
            </View>

            <View style={styles.keypadContainer}>
                <View style={styles.keypadRow}>
                    {[1, 2, 3].map(num => (
                        <KeypadButton key={num} label={num.toString()} onPress={() => handleKeyPress(num.toString())} />
                    ))}
                </View>
                <View style={styles.keypadRow}>
                    {[4, 5, 6].map(num => (
                        <KeypadButton key={num} label={num.toString()} onPress={() => handleKeyPress(num.toString())} />
                    ))}
                </View>
                <View style={styles.keypadRow}>
                    {[7, 8, 9].map(num => (
                        <KeypadButton key={num} label={num.toString()} onPress={() => handleKeyPress(num.toString())} />
                    ))}
                </View>
                <View style={styles.keypadRow}>
                    <KeypadButton
                        icon="backspace-outline"
                        onPress={handleBackspace}
                        onLongPress={handleLongBackspace}
                        color="#ffebee"
                    />
                    <KeypadButton label="0" onPress={() => handleKeyPress('0')} />
                    <KeypadButton
                        icon="send"
                        onPress={handleSubmit}
                        color={theme.colors.primaryContainer}
                    />
                </View>
            </View>

            <DeliveryFormModal
                visible={modalVisible}
                onDismiss={() => {
                    setModalVisible(false);
                    setTimeout(() => inputRef.current?.focus(), 100);
                }}
                onSave={onSaveEntrega}
                initialData={currentData}
            />

            <Snackbar
                visible={snackbarVisible}
                onDismiss={() => setSnackbarVisible(false)}
                duration={3000}
                style={{ backgroundColor: theme.colors.primaryContainer }}
            >
                <Text style={{ color: theme.colors.onPrimaryContainer }}>{snackbarMessage}</Text>
            </Snackbar>
        </View>

    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'column'
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        padding: 0,
        backgroundColor: '#F5F7FA'
    },
    turnoBtn: {
        marginBottom: 20,
        justifyContent: 'center',
        borderRadius: 12
    },
    displayContainer: {
        flex: 1.2,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: 'white',
        margin: 16,
        borderRadius: 16,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4
    },
    hiddenInput: {
        width: '100%',
        backgroundColor: 'transparent',
    },
    helperText: {
        marginTop: 10,
        color: '#6c757d',
        fontSize: 14
    },
    keypadContainer: {
        flex: 2,
        padding: 10,
        justifyContent: 'flex-end',
        paddingBottom: 20
    },
    keypadRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
        flex: 1
    },
    keypadButton: {
        flex: 1,
        marginHorizontal: 6,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
        elevation: 2,
        backgroundColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.41,
    },
    keypadText: {
        fontSize: 32,
        fontWeight: '500',
        color: '#333'
    }
});

export default HomeScreen;
