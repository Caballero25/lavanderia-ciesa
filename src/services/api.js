import axios from 'axios';

// Cambiar por la IP de tu máquina si pruebas en dispositivo físico
// 10.0.2.2 es localhost desde el emulador de Android
const BASE_URL = 'https://sgformsv2.api.test.manaclouds.com/api';

const api = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

export default api;
