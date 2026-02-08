import { MD3LightTheme as DefaultTheme } from 'react-native-paper';

// Colores estimados del logo Conservas Isabel
const ISABEL_BLUE = '#003366'; // Azul marino profundo
const ISABEL_RED = '#E30022';  // Rojo intenso

export const theme = {
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        primary: ISABEL_BLUE,
        onPrimary: '#FFFFFF',
        primaryContainer: '#D1E4FF', // Azul muy claro para fondos de items activos
        onPrimaryContainer: ISABEL_BLUE,

        secondary: ISABEL_RED,
        onSecondary: '#FFFFFF',
        secondaryContainer: '#FFDAD6', // Rojo muy claro
        onSecondaryContainer: '#410002',

        tertiary: '#006C51', // Verde complementario (opcional, para éxitos)

        background: '#F5F7FA', // Gris muy suave, moderno
        surface: '#FFFFFF',
        surfaceVariant: '#E1E2EC',
        onSurface: '#191C1E',

        error: '#BA1A1A',

        elevation: {
            level0: 'transparent',
            level1: '#F0F4F8',
            level2: '#E8EDF2',
            level3: '#E0E6EC',
            level4: '#D8DEE6',
            level5: '#D0D6E0',
        },
    },
    roundness: 12, // Bordes más redondeados para look moderno
};
