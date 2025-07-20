import { useEffect, useRef, useState } from 'react';
import mqtt, { MqttClient } from 'mqtt';

interface MqttMessage {
  topic: string;
  message: string;
  timestamp: Date;
}

interface UseMqttOptions {
  brokerUrl: string;
  topics: string[];
  options?: mqtt.IClientOptions;
}

export const useMqtt = ({ brokerUrl, topics, options }: UseMqttOptions) => {
  const [client, setClient] = useState<MqttClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<MqttMessage[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>('Disconnected');
  const messagesRef = useRef<MqttMessage[]>([]);

  useEffect(() => {
    if (client) {
      client.end();
      setClient(null);
    }

    // brokerUrl이 비어있거나 유효하지 않으면 연결하지 않음
    if (!brokerUrl || !brokerUrl.trim()) {
      setConnectionStatus('No broker URL configured');
      return;
    }

    // 기본적인 URL 유효성 검사
    try {
      new URL(brokerUrl);
    } catch (error) {
      setConnectionStatus('Invalid broker URL');
      return;
    }

    const mqttClient = mqtt.connect(brokerUrl, {
      ...options,
      protocol: 'wss',
    });

    mqttClient.on('connect', () => {
      console.log('MQTT Connected');
      setIsConnected(true);
      setConnectionStatus('Connected');
      setClient(mqttClient);
      
      // 연결 후 약간의 지연을 두고 구독
      setTimeout(() => {
        topics.forEach(topic => {
          if (mqttClient.connected) {
            mqttClient.subscribe(topic, (err) => {
              if (err) {
                console.error(`Failed to subscribe to ${topic}:`, err);
              } else {
                console.log(`Subscribed to ${topic}`);
              }
            });
          }
        });
      }, 100);
    });

    mqttClient.on('message', (topic, message) => {
      const newMessage: MqttMessage = {
        topic,
        message: message.toString(),
        timestamp: new Date(),
      };
      
      messagesRef.current.push(newMessage);
      setMessages([...messagesRef.current]);
    });

    mqttClient.on('error', (error) => {
      console.error('MQTT connection error:', error);
      setConnectionStatus(`Error: ${error.message}`);
    });

    mqttClient.on('close', () => {
      console.log('MQTT Connection closed');
      setIsConnected(false);
      setConnectionStatus('Disconnected');
    });

    mqttClient.on('disconnect', () => {
      console.log('MQTT Disconnected');
      setIsConnected(false);
      setConnectionStatus('Disconnected');
    });

    mqttClient.on('reconnect', () => {
      console.log('MQTT Reconnecting...');
      setConnectionStatus('Reconnecting...');
    });

    mqttClient.on('offline', () => {
      console.log('MQTT Offline');
      setConnectionStatus('Offline');
    });

    return () => {
      if (mqttClient) {
        mqttClient.end(true);
      }
    };
  }, [brokerUrl]);

  const publish = (topic: string, message: string) => {
    console.log(`🚀 MQTT Publish 요청:`, {
      topic,
      message,
      clientConnected: !!client,
      isConnected,
      timestamp: new Date().toISOString()
    });
    
    if (!client) {
      console.error(`❌ MQTT client가 없음`);
      return;
    }
    
    if (!isConnected) {
      console.error(`❌ MQTT 연결되지 않음`);
      return;
    }
    
    try {
      client.publish(topic, message, (error) => {
        if (error) {
          console.error(`❌ MQTT Publish 실패:`, error);
        } else {
          console.log(`✅ MQTT Publish 성공: ${topic} = "${message}"`);
        }
      });
    } catch (error) {
      console.error(`❌ MQTT Publish 예외:`, error);
    }
  };

  const subscribe = (topic: string) => {
    if (client && isConnected) {
      client.subscribe(topic);
    }
  };

  const unsubscribe = (topic: string) => {
    if (client && isConnected) {
      client.unsubscribe(topic);
    }
  };

  return {
    client,
    isConnected,
    messages,
    connectionStatus,
    publish,
    subscribe,
    unsubscribe,
  };
};