export interface MqttTreeNode {
  name: string;
  path: string;
  children: Map<string, MqttTreeNode>;
  value?: string;
  lastUpdated?: Date;
  isEndpoint: boolean;
}

export interface MqttMessage {
  topic: string;
  message: string;
  timestamp: Date;
}