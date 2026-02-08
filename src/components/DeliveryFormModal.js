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
                <Card onTouchStart={handleUserInteraction}>
                    <Card.Title title="Confirmar Entrega" subtitle={initialData?.nombre || initialData?.code || 'Desconocido'} />
                    <Card.Content>
                        {isTimerActive && (
                            <View style={styles.timerContainer}>
                                <Text style={styles.timerText}>Guardando en {secondsLeft}s...</Text>
                                <ProgressBar progress={timerProgress} color={theme.colors.primary} />
                                <Text style={{ fontSize: 12, color: 'gray', marginTop: 5, textAlign: 'center' }}>
                                    Toca cualquier parte para cancelar auto-envío
                                </Text>
                            </View>
                        )}
                        {/* ... */}


                        <View style={styles.row}>
                            <Text>Producto Expuesto</Text>
                            <Switch
                                value={productoExpuesto}
                                onValueChange={setProductoExpuesto}
                            />
                        </View>
                        <View style={styles.row}>
                            <Text>Mandil Limpio</Text>
                            <Switch
                                value={mandilLimpio}
                                onValueChange={setMandilLimpio}
                            />
                        </View>
                        <View style={styles.row}>
                            <Text>Mandil Buen Estado</Text>
                            <Switch
                                value={mandilBuenEstado}
                                onValueChange={setMandilBuenEstado}
                            />
                        </View>

                        <TextInput
                            label="Observaciones (Opcional)"
                            value={observaciones}
                            onChangeText={setObservaciones}
                            mode="outlined"
                            style={styles.input}
                        />
                    </Card.Content>
                    <Card.Actions>
                        <Button onPress={onDismiss}>Cancelar</Button>
                        <Button mode="contained" onPress={handleSave}>Enviar</Button>
                    </Card.Actions>
                </Card>
            </Modal>
        </Portal>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 20,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    input: {
        marginTop: 10,
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
