import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Modal, Portal, Text, Button, Switch, TextInput, Card, ProgressBar, useTheme } from 'react-native-paper';

const DeliveryFormModal = ({ visible, onDismiss, onSave, initialData }) => {
    const theme = useTheme();
    const [productoExpuesto, setProductoExpuesto] = useState(true);
    const [mandilLimpio, setMandilLimpio] = useState(true);
    const [mandilBuenEstado, setMandilBuenEstado] = useState(true);
    const [observaciones, setObservaciones] = useState('');

    const [timerProgress, setTimerProgress] = useState(0);
    const [isTimerActive, setIsTimerActive] = useState(true);
    const timerRef = useRef(null);
    const progressIntervalRef = useRef(null);
    const [secondsLeft, setSecondsLeft] = useState(7);

    // Reset state on open
    useEffect(() => {
        if (visible) {
            setProductoExpuesto(true);
            setMandilLimpio(true);
            setMandilBuenEstado(true);
            setObservaciones('');
            startTimer();
        } else {
            clearTimers();
        }
    }, [visible]);

    const clearTimers = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        setIsTimerActive(false);
        setTimerProgress(0);
        setSecondsLeft(7);
    };

    const startTimer = () => {
        setIsTimerActive(true);
        setSecondsLeft(7);
        setTimerProgress(0);

        // Auto-save after 7 seconds
        timerRef.current = setTimeout(() => {
            handleSave();
        }, 7000);

        // Update progress bar
        const interval = 100; // 100ms
        const totalSteps = 7000 / interval;
        let currentStep = 0;

        progressIntervalRef.current = setInterval(() => {
            currentStep++;
            setTimerProgress(currentStep / totalSteps);
            setSecondsLeft(Math.ceil(7 - (currentStep * interval / 1000)));
            if (currentStep >= totalSteps) clearInterval(progressIntervalRef.current);
        }, interval);
    };

    const stopTimer = () => {
        if (isTimerActive) {
            clearTimers();
        }
    };

    const handleUserInteraction = () => {
        stopTimer();
    };

    const handleSave = () => {
        clearTimers();
        onSave({
            producto_expuesto: productoExpuesto,
            mandil_limpio: mandilLimpio,
            mandil_buen_estado: mandilBuenEstado,
            observaciones
        });
    };

    const handleBackdropPress = () => {
        handleUserInteraction();
    };

    if (!visible) return null;

    return (
        <Portal>
            <Modal visible={visible} onDismiss={handleBackdropPress} contentContainerStyle={styles.container}>
                <Card onTouchStart={handleUserInteraction} style={{ borderRadius: 16 }}>
                    <Card.Title
                        title="Confirmar Entrega"
                        subtitle={initialData?.nombre || initialData?.code || 'Desconocido'}
                        titleStyle={{ color: theme.colors.primary, fontWeight: 'bold' }}
                    />
                    <Card.Content>
                        {isTimerActive && (
                            <View style={[styles.timerContainer, { backgroundColor: theme.colors.elevation.level1 }]}>
                                <Text style={[styles.timerText, { color: theme.colors.primary }]}>Guardando en {secondsLeft}s...</Text>
                                <ProgressBar progress={timerProgress} color={theme.colors.primary} style={{ borderRadius: 4, height: 6 }} />
                                <Text style={{ fontSize: 12, color: theme.colors.outline, marginTop: 8, textAlign: 'center' }}>
                                    Toca para detener
                                </Text>
                            </View>
                        )}

                        <View style={styles.inputContainer}>
                            <View style={styles.row}>
                                <Text variant="bodyLarge">Producto Expuesto</Text>
                                <Switch value={productoExpuesto} onValueChange={setProductoExpuesto} color={theme.colors.primary} />
                            </View>
                            <View style={styles.row}>
                                <Text variant="bodyLarge">Mandil Limpio</Text>
                                <Switch value={mandilLimpio} onValueChange={setMandilLimpio} color={theme.colors.primary} />
                            </View>
                            <View style={styles.row}>
                                <Text variant="bodyLarge">Mandil Buen Estado</Text>
                                <Switch value={mandilBuenEstado} onValueChange={setMandilBuenEstado} color={theme.colors.primary} />
                            </View>
                        </View>

                        <TextInput
                            label="Observaciones (Opcional)"
                            value={observaciones}
                            onChangeText={setObservaciones}
                            mode="outlined"
                            style={styles.input}
                            outlineColor={theme.colors.outline}
                            activeOutlineColor={theme.colors.primary}
                        />
                    </Card.Content>
                    <Card.Actions style={{ padding: 16 }}>
                        <Button onPress={onDismiss} textColor={theme.colors.error}>Cancelar</Button>
                        <Button mode="contained" onPress={handleSave} style={{ marginLeft: 10, paddingHorizontal: 20 }}>Enviar</Button>
                    </Card.Actions>
                </Card>
            </Modal>
        </Portal>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 20,
        justifyContent: 'center'
    },
    inputContainer: {
        marginVertical: 10
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
        paddingBottom: 8,
        borderBottomWidth: 0.5,
        borderBottomColor: '#e0e0e0'
    },
    input: {
        marginTop: 10,
        backgroundColor: 'white'
    },
    timerContainer: {
        marginBottom: 20,
        backgroundColor: '#f0f0f0',
        padding: 10,
        borderRadius: 8
    },
    timerText: {
        marginBottom: 5,
        fontWeight: 'bold',
        textAlign: 'center'
    }
});

export default DeliveryFormModal;
