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
                <Text variant="headlineMedium" style={{ marginBottom: 20 }}>Seleccione Turno</Text>
                <Button mode="contained" onPress={() => saveTurno('DIURNO')} style={styles.turnoBtn} contentStyle={{ height: 60 }}>
                    DIURNO
                </Button>
                <Button mode="contained" onPress={() => saveTurno('NOCTURNO')} style={styles.turnoBtn} contentStyle={{ height: 60 }} buttonColor={theme.colors.secondary}>
                    NOCTURNO
                </Button>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Appbar.Header>
                <Appbar.Content title="Entrega Mandiles" subtitle={`Turno: ${turno}`} />
                <Appbar.Action icon="sync" onPress={() => navigation.navigate('SyncPanel')} />
                <Appbar.Action icon="cog" onPress={() => Alert.alert("Cambiar Turno", "¿Desea cambiar el turno?", [
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
        backgroundColor: '#f5f5f5',
        flexDirection: 'column'
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
    },
    turnoBtn: {
        marginBottom: 20,
        justifyContent: 'center'
    },
    displayContainer: {
        flex: 1, // Takes updated space
        justifyContent: 'center',
        alignItems: 'center',
        padding: 10,
        backgroundColor: 'white',
        elevation: 2,
        marginBottom: 2
    },
    hiddenInput: {
        width: '100%',
        backgroundColor: 'transparent',
    },
    helperText: {
        marginTop: 5,
        color: 'gray'
    },
    keypadContainer: {
        flex: 2, // Takes more space for buttons
        padding: 5,
        justifyContent: 'flex-end',
        paddingBottom: 20
    },
    keypadRow: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        marginBottom: 10,
        flex: 1
    },
    keypadButton: {
        flex: 1,
        margin: 4,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 8,
        elevation: 2,
        maxHeight: 70
    },
    keypadText: {
        fontSize: 28,
        fontWeight: 'bold'
    }
});

export default HomeScreen;
