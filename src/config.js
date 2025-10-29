/**
 * Application Configuration
 * 
 * ВАЖНО: После изменения API_URL перезапустите dev-сервер
 */

// Определяем API URL в зависимости от окружения
const getApiUrl = () => {
  // Production: используйте ваш production URL
  if (import.meta.env.PROD) {
    return 'http://XX.XX.XXX.XXX:3001';
  }
  
  // Development: автоматически определяем локальный или сетевой адрес
  const hostname = window.location.hostname;
  
  // Если открыто по IP адресу (например 192.168.1.50), используем этот же IP
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return `http://${hostname}:3001`;
  }
  
  // По умолчанию localhost
  return 'http://localhost:3001';
};

export const API_URL = getApiUrl();

// Другие конфигурации
export const APP_NAME = 'Школьная Библиотека';
export const USER_NAME = 'Наймушин Георгий Дмитриевич';

// Константы для пагинации
export const DEFAULT_ITEMS_PER_PAGE = 5;
export const ITEMS_PER_PAGE_OPTIONS = [5, 10, 15, 20];

// Дебаг режим
export const DEBUG = import.meta.env.DEV;

// Логирование API запросов в dev режиме
if (DEBUG) {
  console.log('🔧 [CONFIG] API_URL:', API_URL);
  console.log('🔧 [CONFIG] Environment:', import.meta.env.MODE);
}