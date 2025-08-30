import { Platform } from 'react-native';

// 👇 cámbiala a tu IP actual
const LAN_IP = '192.168.1.197';
const PORT = '4000';

// En Web usamos localhost (el backend corre en el mismo PC).
// En nativo (teléfono/emulador) usamos la IP LAN (o 10.0.2.2 si prefieres emulador Android).
export const API_BASE_URL =
  Platform.OS === 'web'
    ? `http://localhost:${PORT}`
    : `http://${LAN_IP}:${PORT}`;
