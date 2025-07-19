export interface MqttConfig {
  brokerUrl: string;
  topics: string[];
  clientId: string;
  clean: boolean;
  username: string;
  password: string;
  keepalive: number;
  connectTimeout: number;
  reconnectPeriod: number;
  protocolVersion: number;
}

export const getDefaultMqttConfig = (): MqttConfig => ({
  brokerUrl: '',
  topics: ['#'],
  clientId: `smartfarm_${Math.random().toString(16).substr(2, 8)}`,
  clean: true,
  username: '',
  password: '',
  keepalive: 60,
  connectTimeout: 30000,
  reconnectPeriod: 5000,
  protocolVersion: 4,
});