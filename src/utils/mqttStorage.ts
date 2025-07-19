import type { MqttConfig } from '../types/MqttConfig';
import { getDefaultMqttConfig } from '../types/MqttConfig';

const MQTT_CONFIG_KEY = 'smartfarm-mqtt-config';

export const saveMqttConfig = (config: MqttConfig): void => {
  try {
    const configToSave = {
      ...config,
      clientId: `smartfarm_${Math.random().toString(16).substr(2, 8)}`
    };
    localStorage.setItem(MQTT_CONFIG_KEY, JSON.stringify(configToSave));
  } catch (error) {
    console.error('Failed to save MQTT config:', error);
  }
};

export const loadMqttConfig = (): MqttConfig => {
  try {
    const saved = localStorage.getItem(MQTT_CONFIG_KEY);
    if (saved) {
      const config = JSON.parse(saved) as MqttConfig;
      return {
        ...config,
        clientId: `smartfarm_${Math.random().toString(16).substr(2, 8)}`
      };
    }
  } catch (error) {
    console.error('Failed to load MQTT config:', error);
  }
  return getDefaultMqttConfig();
};

export const resetMqttConfig = (): MqttConfig => {
  try {
    localStorage.removeItem(MQTT_CONFIG_KEY);
  } catch (error) {
    console.error('Failed to reset MQTT config:', error);
  }
  return getDefaultMqttConfig();
};