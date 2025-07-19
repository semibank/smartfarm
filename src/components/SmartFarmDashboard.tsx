import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useMqtt } from '../hooks/useMqtt';
import SensorCardManager from './SensorCardManager';
import MqttTreeView from './MqttTreeView';
// import ChartView from './ChartView';
import type { MqttConfig } from '../types/MqttConfig';
import { loadMqttConfig, saveMqttConfig } from '../utils/mqttStorage';
import { MqttTreeParser } from '../utils/mqttTreeParser';
import type { MqttTreeNode } from '../types/MqttTree';
import { extractTopicsFromMessages, getLatestValueForTopic, isNumericTopic } from '../utils/topicUtils';
import { loadDashboardSettings, saveDashboardSettings, type DashboardSettings } from '../utils/settingsStorage';
import { loadCardConfigs, type SensorCardConfig } from '../utils/cardStorage';
import { dataHistoryManager } from '../utils/dataHistory';

interface SensorData {
  temperature: number;
  humidity: number;
  soilMoisture: number;
  lightIntensity: number;
  lastUpdated: Date;
}

type TabType = 'sensor' | 'chart' | 'automation' | 'mqtt-log' | 'settings' | 'dashboard-settings';

const SmartFarmDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('sensor');
  const [mqttConfig, setMqttConfig] = useState<MqttConfig>(loadMqttConfig());
  const [messageFilter, setMessageFilter] = useState<string>('');
  const [mqttTree, setMqttTree] = useState<MqttTreeNode | null>(null);
  const mqttTreeParserRef = useRef<MqttTreeParser>(new MqttTreeParser());
  const [sensorData, setSensorData] = useState<SensorData>({
    temperature: 0,
    humidity: 0,
    soilMoisture: 0,
    lightIntensity: 0,
    lastUpdated: new Date(0), // 초기값을 1970년으로 설정하여 초기화 상태 구분
  });
  
  // 실제 데이터가 수신되었는지 추적
  const [hasReceivedRealData, setHasReceivedRealData] = useState(false);
  
  // 페이지 로드 후 데이터 수집 지연 (브라우저 새로고침 시 초기화 방지)
  const [isInitializing, setIsInitializing] = useState(true);
  
  const [dashboardSettings, setDashboardSettings] = useState<DashboardSettings>(loadDashboardSettings());
  const [cards, setCards] = useState<SensorCardConfig[]>([]);

  // Initialize cards on component mount
  useEffect(() => {
    const loadedCards = loadCardConfigs();
    setCards(loadedCards);
    
    // 초기화 지연 타이머 설정 (3초 후 데이터 수집 시작)
    const initTimer = setTimeout(() => {
      setIsInitializing(false);
    }, 3000);
    
    return () => clearTimeout(initTimer);
  }, []);

  const mqttHookConfig = useMemo(() => ({
    brokerUrl: mqttConfig.brokerUrl,
    topics: mqttConfig.topics,
    options: {
      clientId: mqttConfig.clientId,
      clean: mqttConfig.clean,
      username: mqttConfig.username,
      password: mqttConfig.password,
      keepalive: mqttConfig.keepalive,
      connectTimeout: mqttConfig.connectTimeout,
      reconnectPeriod: mqttConfig.reconnectPeriod,
      protocolVersion: 4 as const,
    }
  }), [mqttConfig]);

  const { messages, isConnected, connectionStatus } = useMqtt(mqttHookConfig);

  const handleMqttConfigSave = (newConfig: MqttConfig) => {
    setMqttConfig(newConfig);
    saveMqttConfig(newConfig);
  };

  const filteredMessages = useMemo(() => {
    if (!messageFilter.trim()) return messages;
    
    return messages.filter(msg => 
      msg.topic.toLowerCase().includes(messageFilter.toLowerCase()) ||
      msg.message.toLowerCase().includes(messageFilter.toLowerCase())
    );
  }, [messages, messageFilter]);

  const clearFilter = () => {
    setMessageFilter('');
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'sensor':
        return renderSensorTab();
      case 'chart':
        return renderChartTab();
      case 'automation':
        return renderAutomationTab();
      case 'mqtt-log':
        return renderMqttLogTab();
      case 'settings':
        return renderSettingsTab();
      case 'dashboard-settings':
        return renderDashboardSettingsTab();
      default:
        return renderSensorTab();
    }
  };

  const renderSensorTab = () => (
    <>
      {/* Sensor Cards Manager */}
      <SensorCardManager
        sensorData={sensorData}
        messages={messages}
        getTemperatureStatus={getTemperatureStatus}
        getHumidityStatus={getHumidityStatus}
        getSoilMoistureStatus={getSoilMoistureStatus}
        getLightStatus={getLightStatus}
      />

      {/* Message Log Section */}
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        borderRadius: '24px',
        padding: '32px',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
        margin: '40px 20px 0 20px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center'
          }}>
            <div style={{
              width: '4px',
              height: '24px',
              backgroundColor: '#667eea',
              borderRadius: '2px',
              marginRight: '16px'
            }} />
            <h3 style={{ 
              margin: 0,
              fontSize: '20px',
              fontWeight: '600',
              color: '#2c3e50'
            }}>
              📊 실시간 메시지 로그
            </h3>
          </div>
          
          {/* Filter Input */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            minWidth: '300px'
          }}>
            <div style={{
              position: 'relative',
              flex: 1
            }}>
              <input
                type="text"
                placeholder="토픽이나 메시지 내용 필터링... (예: state)"
                value={messageFilter}
                onChange={(e) => setMessageFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  paddingRight: messageFilter ? '40px' : '12px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#ddd'}
              />
              {messageFilter && (
                <button
                  onClick={clearFilter}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#7f8c8d',
                    fontSize: '16px',
                    padding: '4px',
                    borderRadius: '4px'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  title="필터 클리어"
                >
                  ×
                </button>
              )}
            </div>
            {messageFilter && (
              <div style={{
                fontSize: '12px',
                color: '#7f8c8d',
                whiteSpace: 'nowrap'
              }}>
                {filteredMessages.length}/{messages.length}
              </div>
            )}
          </div>
        </div>
        
        <div style={{
          maxHeight: '400px',
          overflowY: 'auto',
          backgroundColor: '#f8fafc',
          borderRadius: '16px',
          padding: '16px',
          border: '1px solid rgba(0, 0, 0, 0.05)'
        }}>
          {filteredMessages.slice(-20).reverse().map((msg, index) => (
            <div key={index} style={{ 
              marginBottom: '12px',
              padding: '16px',
              backgroundColor: 'white',
              borderRadius: '12px',
              border: '1px solid rgba(0, 0, 0, 0.05)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
              transition: 'all 0.2s ease'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <span style={{ 
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#667eea',
                    backgroundColor: '#f1f3ff',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    display: 'inline-block',
                    marginBottom: '8px'
                  }}>
                    {msg.topic}
                  </span>
                  <div style={{ 
                    fontSize: '16px',
                    color: '#2c3e50',
                    wordBreak: 'break-all',
                    fontWeight: '500'
                  }}>
                    {msg.message}
                  </div>
                </div>
                <span style={{ 
                  color: '#7f8c8d',
                  fontSize: '12px',
                  fontWeight: '500',
                  backgroundColor: '#f8fafc',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  whiteSpace: 'nowrap'
                }}>
                  {msg.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
          {filteredMessages.length === 0 && messages.length > 0 && (
            <div style={{ 
              color: '#95a5a6',
              fontStyle: 'italic',
              textAlign: 'center',
              padding: '40px 20px',
              fontSize: '16px'
            }}>
              🔍 "{messageFilter}" 필터에 맞는 메시지가 없습니다.
            </div>
          )}
          {messages.length === 0 && (
            <div style={{ 
              color: '#95a5a6',
              fontStyle: 'italic',
              textAlign: 'center',
              padding: '40px 20px',
              fontSize: '16px'
            }}>
              📡 메시지를 기다리는 중...
            </div>
          )}
        </div>
      </div>
    </>
  );

  const renderChartTab = () => (
    <div style={{
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(20px)',
      borderRadius: '24px',
      padding: '40px',
      border: '1px solid rgba(255, 255, 255, 0.3)',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
      margin: '0 20px',
      textAlign: 'center'
    }}>
      <h3 style={{ color: '#2c3e50', marginBottom: '20px' }}>📈 차트 분석</h3>
      <p style={{ color: '#7f8c8d' }}>차트 분석 기능이 곧 추가될 예정입니다.</p>
      {/* <ChartView cards={cards} /> */}
    </div>
  );

  const renderAutomationTab = () => (
    <div style={{
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(20px)',
      borderRadius: '24px',
      padding: '40px',
      border: '1px solid rgba(255, 255, 255, 0.3)',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
      margin: '0 20px',
      textAlign: 'center'
    }}>
      <h3 style={{ color: '#2c3e50', marginBottom: '20px' }}>🤖 자동화 설정</h3>
      <p style={{ color: '#7f8c8d' }}>자동화 설정 기능이 곧 추가될 예정입니다.</p>
    </div>
  );

  const renderMqttLogTab = () => (
    <div style={{
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(20px)',
      borderRadius: '24px',
      padding: '40px',
      border: '1px solid rgba(255, 255, 255, 0.3)',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
      margin: '0 20px',
      textAlign: 'center'
    }}>
      <h3 style={{ color: '#2c3e50', marginBottom: '20px' }}>🌳 MQTT 로그</h3>
      <p style={{ color: '#7f8c8d' }}>MQTT 로그 기능이 곧 추가될 예정입니다.</p>
      <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
        <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>
          메시지 수: {messages.length}개<br/>
          토픽 수: {extractTopicsFromMessages(messages).length}개
        </p>
      </div>
    </div>
  );

  const renderSettingsTab = () => (
    <div style={{
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(20px)',
      borderRadius: '24px',
      padding: '32px',
      border: '1px solid rgba(255, 255, 255, 0.3)',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
      margin: '0 20px'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div style={{
          width: '4px',
          height: '24px',
          backgroundColor: '#667eea',
          borderRadius: '2px',
          marginRight: '16px'
        }} />
        <h3 style={{ 
          margin: 0,
          fontSize: '20px',
          fontWeight: '600',
          color: '#2c3e50'
        }}>
          ⚙️ MQTT 설정
        </h3>
      </div>
      
      <div style={{ display: 'grid', gap: '20px' }}>
        <div>
          <label style={{ 
            display: 'block',
            marginBottom: '8px',
            fontWeight: '600',
            color: '#2c3e50'
          }}>
            브로커 URL
          </label>
          <input
            type="text"
            value={mqttConfig.brokerUrl}
            onChange={(e) => setMqttConfig({...mqttConfig, brokerUrl: e.target.value})}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
        </div>
        
        <div>
          <label style={{ 
            display: 'block',
            marginBottom: '8px',
            fontWeight: '600',
            color: '#2c3e50'
          }}>
            사용자명
          </label>
          <input
            type="text"
            value={mqttConfig.username}
            onChange={(e) => setMqttConfig({...mqttConfig, username: e.target.value})}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
        </div>
        
        <div>
          <label style={{ 
            display: 'block',
            marginBottom: '8px',
            fontWeight: '600',
            color: '#2c3e50'
          }}>
            비밀번호
          </label>
          <input
            type="password"
            value={mqttConfig.password}
            onChange={(e) => setMqttConfig({...mqttConfig, password: e.target.value})}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
        </div>
        
        <div>
          <label style={{ 
            display: 'block',
            marginBottom: '8px',
            fontWeight: '600',
            color: '#2c3e50'
          }}>
            토픽 (줄바꿈으로 구분)
          </label>
          <textarea
            value={mqttConfig.topics.join('\n')}
            onChange={(e) => setMqttConfig({...mqttConfig, topics: e.target.value.split('\n').filter(t => t.trim())})}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              fontSize: '14px',
              minHeight: '100px',
              resize: 'vertical'
            }}
          />
        </div>
        
        <button
          onClick={() => handleMqttConfigSave(mqttConfig)}
          style={{
            padding: '12px 24px',
            backgroundColor: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#5a67d8'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#667eea'}
        >
          💾 설정 저장
        </button>
      </div>
    </div>
  );

  useEffect(() => {
    if (messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      const value = parseFloat(latestMessage.message);
      
      // 유효한 숫자값이고 현실적인 범위에 있는 경우에만 처리
      if (!isNaN(value) && isFinite(value)) {
        let isValidSensorData = false;
        
        // 센서 토픽별로 현실적인 범위 검증
        switch (latestMessage.topic) {
          case 'sensors/temperature':
            // 온도: -50°C ~ 80°C 범위, 0이 아닌 값
            if (value >= -50 && value <= 80 && value !== 0) {
              isValidSensorData = true;
            }
            break;
          case 'sensors/humidity':
            // 습도: 0% ~ 100% 범위, 0이 아닌 값
            if (value > 0 && value <= 100) {
              isValidSensorData = true;
            }
            break;
          case 'sensors/soil-moisture':
            // 토양수분: 0% ~ 100% 범위, 0이 아닌 값
            if (value > 0 && value <= 100) {
              isValidSensorData = true;
            }
            break;
          case 'sensors/light-intensity':
            // 조도: 0lux 이상, 하지만 초기화 상태 아님
            if (value >= 0 && (value > 0 || hasReceivedRealData)) {
              isValidSensorData = true;
            }
            break;
          default:
            // 기타 토픽은 0이 아닌 숫자값이면 유효
            if (value !== 0) {
              isValidSensorData = true;
            }
        }
        
        // 유효한 센서 데이터이고 초기화 완료 후인 경우에만 상태 업데이트
        if (isValidSensorData && !isInitializing) {
          // 실제 데이터 수신 플래그 설정
          setHasReceivedRealData(true);
          
          // 센서 데이터 업데이트
          setSensorData(prev => {
            const updated = { ...prev, lastUpdated: latestMessage.timestamp };
            
            switch (latestMessage.topic) {
              case 'sensors/temperature':
                updated.temperature = value;
                break;
              case 'sensors/humidity':
                updated.humidity = value;
                break;
              case 'sensors/soil-moisture':
                updated.soilMoisture = value;
                break;
              case 'sensors/light-intensity':
                updated.lightIntensity = value;
                break;
            }
            
            return updated;
          });
        }
      }

      // MQTT 트리 업데이트 (모든 메시지에 대해)
      mqttTreeParserRef.current.addMessage({
        topic: latestMessage.topic,
        message: latestMessage.message,
        timestamp: latestMessage.timestamp
      });
      setMqttTree(mqttTreeParserRef.current.getTree());
    }
  }, [messages, hasReceivedRealData, isInitializing]);

  // 실시간 데이터 수집 및 히스토리 관리 (최적화된 버전)
  useEffect(() => {
    // 데이터가 수신되지 않았거나 초기화 중이면 아무것도 하지 않음
    if (!hasReceivedRealData || isInitializing || cards.length === 0) {
      return;
    }

    const collectSensorData = () => {
      const validCards = cards.filter(card => {
        // MQTT 토픽이 있는 카드는 토픽 검증
        if (card.mqttTopic) {
          const rawValue = getLatestValueForTopic(messages, card.mqttTopic);
          return rawValue && rawValue.trim() !== '' && !isNaN(parseFloat(rawValue));
        }
        // 기본 센서 데이터 카드는 유효성 확인
        return card.dataSource && hasReceivedRealData;
      });

      validCards.forEach(card => {
        let currentValue: number = 0;
        let status: 'low' | 'normal' | 'warning' | 'danger' = 'normal';
        
        if (card.mqttTopic) {
          const rawValue = getLatestValueForTopic(messages, card.mqttTopic);
          currentValue = parseFloat(rawValue);
          
          // 상태 결정 (4단계 색상 시스템 사용)
          if (card.colorRanges?.danger && currentValue >= card.colorRanges.danger.min && currentValue <= card.colorRanges.danger.max) {
            status = 'danger';
          } else if (card.colorRanges?.warning && currentValue >= card.colorRanges.warning.min && currentValue <= card.colorRanges.warning.max) {
            status = 'warning';
          } else if (card.colorRanges?.low && currentValue >= card.colorRanges.low.min && currentValue <= card.colorRanges.low.max) {
            status = 'low';
          } else {
            status = 'normal';
          }
        } else {
          // 기존 센서 데이터 사용
          switch (card.dataSource) {
            case 'temperature':
              currentValue = sensorData.temperature;
              if (currentValue > -50 && currentValue < 100) {
                status = getTemperatureStatus(currentValue);
              }
              break;
            case 'humidity':
              currentValue = sensorData.humidity;
              if (currentValue >= 0 && currentValue <= 100) {
                status = getHumidityStatus(currentValue);
              }
              break;
            case 'soilMoisture':
              currentValue = sensorData.soilMoisture;
              if (currentValue >= 0 && currentValue <= 100) {
                status = getSoilMoistureStatus(currentValue);
              }
              break;
            case 'lightIntensity':
              currentValue = sensorData.lightIntensity;
              if (currentValue >= 0) {
                status = getLightStatus(currentValue);
              }
              break;
            default:
              return; // 유효하지 않은 데이터소스는 건너뛰기
          }
        }
        
        dataHistoryManager.addDataPoint(
          card.id,
          currentValue,
          status,
          card.title,
          card.unit || ''
        );
      });
    };

    // 즉시 실행
    collectSensorData();

    // 주기적으로 데이터 수집 (10초로 간격 확대)
    const interval = setInterval(collectSensorData, 10000);
    
    return () => clearInterval(interval);
  }, [cards, messages, sensorData, hasReceivedRealData, isInitializing]);

  const renderDashboardSettingsTab = () => {
    const handleSaveSettings = () => {
      saveDashboardSettings(dashboardSettings);
      alert('설정이 저장되었습니다!');
    };

    const handleResetSettings = () => {
      if (confirm('모든 설정을 기본값으로 재설정하시겠습니까?')) {
        const defaultSettings = {
          title: '스마트팜 대시보드',
          titleColor: 'white',
          titleEmoji: '🌱',
          backgroundGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        };
        setDashboardSettings(defaultSettings);
        saveDashboardSettings(defaultSettings);
      }
    };

    const gradientOptions = [
      { name: '기본 블루', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
      { name: '오션 그린', value: 'linear-gradient(135deg, #00b4db 0%, #0083b0 100%)' },
      { name: '선셋 오렌지', value: 'linear-gradient(135deg, #ff9a8b 0%, #ad4e2b 100%)' },
      { name: '포레스트 그린', value: 'linear-gradient(135deg, #4e7c30 0%, #8bc34a 100%)' },
      { name: '미드나잇 블루', value: 'linear-gradient(135deg, #2c3e50 0%, #3498db 100%)' },
      { name: '라벤더 퍼플', value: 'linear-gradient(135deg, #8360c3 0%, #2ebf91 100%)' }
    ];

    const emojiOptions = ['🌱', '🌿', '🌾', '🌱', '🍀', '🌻', '🌸', '🌺', '🌷', '🌹', '🌼', '🌵', '🎋', '🌳', '🌲', '🌴', '🌶️', '🍅', '🥒', '🥕'];

    return (
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        borderRadius: '24px',
        padding: '40px',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
        margin: '0 20px',
        maxWidth: '800px',
        marginLeft: 'auto',
        marginRight: 'auto'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '32px'
        }}>
          <div style={{
            width: '4px',
            height: '24px',
            backgroundColor: '#667eea',
            borderRadius: '2px',
            marginRight: '16px'
          }} />
          <h3 style={{ 
            margin: 0,
            fontSize: '24px',
            fontWeight: '600',
            color: '#2c3e50'
          }}>
            🎨 대시보드 설정
          </h3>
        </div>
        
        <div style={{ display: 'grid', gap: '32px' }}>
          {/* 타이틀 설정 */}
          <div style={{
            backgroundColor: '#f8fafc',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid #e2e8f0'
          }}>
            <h4 style={{ 
              margin: '0 0 20px 0',
              fontSize: '18px',
              fontWeight: '600',
              color: '#2c3e50'
            }}>
              📝 타이틀 설정
            </h4>
            
            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={{ 
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#2c3e50'
                }}>
                  대시보드 제목
                </label>
                <input
                  type="text"
                  value={dashboardSettings.title}
                  onChange={(e) => setDashboardSettings({...dashboardSettings, title: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '16px',
                    outline: 'none'
                  }}
                />
              </div>
              
              <div>
                <label style={{ 
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#2c3e50'
                }}>
                  타이틀 색상
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['white', '#2c3e50', '#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6'].map(color => (
                    <button
                      key={color}
                      onClick={() => setDashboardSettings({...dashboardSettings, titleColor: color})}
                      style={{
                        width: '40px',
                        height: '40px',
                        backgroundColor: color,
                        border: dashboardSettings.titleColor === color ? '3px solid #667eea' : '1px solid #ddd',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    />
                  ))}
                </div>
              </div>
              
              <div>
                <label style={{ 
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#2c3e50'
                }}>
                  아이콘 선택
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {emojiOptions.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => setDashboardSettings({...dashboardSettings, titleEmoji: emoji})}
                      style={{
                        padding: '8px',
                        border: dashboardSettings.titleEmoji === emoji ? '2px solid #667eea' : '1px solid #ddd',
                        borderRadius: '8px',
                        backgroundColor: dashboardSettings.titleEmoji === emoji ? '#f0f4ff' : 'white',
                        fontSize: '20px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          {/* 배경 설정 */}
          <div style={{
            backgroundColor: '#f8fafc',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid #e2e8f0'
          }}>
            <h4 style={{ 
              margin: '0 0 20px 0',
              fontSize: '18px',
              fontWeight: '600',
              color: '#2c3e50'
            }}>
              🎨 배경 스타일
            </h4>
            
            <div style={{ display: 'grid', gap: '12px' }}>
              {gradientOptions.map(option => (
                <button
                  key={option.name}
                  onClick={() => setDashboardSettings({...dashboardSettings, backgroundGradient: option.value})}
                  style={{
                    padding: '16px',
                    border: dashboardSettings.backgroundGradient === option.value ? '2px solid #667eea' : '1px solid #ddd',
                    borderRadius: '12px',
                    background: option.value,
                    color: 'white',
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
                  }}
                >
                  {option.name}
                </button>
              ))}
            </div>
          </div>
          
          {/* 미리보기 */}
          <div style={{
            backgroundColor: '#f8fafc',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid #e2e8f0'
          }}>
            <h4 style={{ 
              margin: '0 0 20px 0',
              fontSize: '18px',
              fontWeight: '600',
              color: '#2c3e50'
            }}>
              👀 미리보기
            </h4>
            
            <div style={{
              background: dashboardSettings.backgroundGradient,
              padding: '20px',
              borderRadius: '12px',
              textAlign: 'center'
            }}>
              <h1 style={{
                color: dashboardSettings.titleColor,
                fontSize: '24px',
                fontWeight: '700',
                margin: '0',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
              }}>
                {dashboardSettings.titleEmoji} {dashboardSettings.title}
              </h1>
            </div>
          </div>
          
          {/* 버튼 */}
          <div style={{
            display: 'flex',
            gap: '16px',
            justifyContent: 'flex-end'
          }}>
            <button
              onClick={handleResetSettings}
              style={{
                padding: '12px 24px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                color: '#64748b',
                transition: 'all 0.2s'
              }}
            >
              🔄 초기화
            </button>
            <button
              onClick={handleSaveSettings}
              style={{
                padding: '12px 24px',
                backgroundColor: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              💾 저장
            </button>
          </div>
        </div>
      </div>
    );
  };

  const getTemperatureStatus = (temp: number): 'low' | 'normal' | 'warning' | 'danger' => {
    if (temp < 10) return 'low';
    if (temp > 40) return 'danger';
    if (temp > 30) return 'warning';
    return 'normal';
  };

  const getHumidityStatus = (humidity: number): 'low' | 'normal' | 'warning' | 'danger' => {
    if (humidity < 20) return 'low';
    if (humidity > 80) return 'danger';
    if (humidity < 30 || humidity > 70) return 'warning';
    return 'normal';
  };

  const getSoilMoistureStatus = (moisture: number): 'low' | 'normal' | 'warning' | 'danger' => {
    if (moisture < 15) return 'low';
    if (moisture > 80) return 'danger';
    if (moisture < 25) return 'warning';
    return 'normal';
  };

  const getLightStatus = (light: number): 'low' | 'normal' | 'warning' | 'danger' => {
    if (light < 100) return 'low';
    if (light > 90000) return 'danger';
    if (light < 200) return 'warning';
    return 'normal';
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      width: '100vw',
      background: dashboardSettings.backgroundGradient,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      position: 'relative',
      overflow: 'hidden',
      margin: 0,
      padding: 0
    }}>
      {/* Background overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.1)',
        zIndex: 0
      }} />

      {/* Content */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        padding: '20px 0',
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <header style={{ 
          textAlign: 'center',
          marginBottom: '40px',
          padding: '20px 0'
        }}>
          <h1 style={{ 
            color: dashboardSettings.titleColor,
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            fontWeight: '700',
            margin: '0 0 16px 0',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
            letterSpacing: '1px'
          }}>
            {dashboardSettings.titleEmoji} {dashboardSettings.title}
          </h1>
          
          {/* Connection Status */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(10px)',
            borderRadius: '30px',
            padding: '12px 24px',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: isConnected ? '#4caf50' : '#f44336',
              boxShadow: `0 0 0 3px ${isConnected ? '#4caf50' : '#f44336'}30`,
              animation: isConnected ? 'pulse 2s infinite' : 'none'
            }} />
            <span style={{ 
              color: 'white',
              fontWeight: '600',
              fontSize: '14px',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)'
            }}>
              {isInitializing ? '시스템 초기화 중...' : connectionStatus}
            </span>
          </div>
        </header>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '40px',
          padding: '0 20px'
        }}>
          <div style={{
            display: 'flex',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '8px',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            gap: '4px'
          }}>
            {[
              { id: 'sensor', label: '🎛️ 환경제어', icon: '🎛️' },
              { id: 'chart', label: '📈 차트분석', icon: '📈' },
              { id: 'automation', label: '🤖 자동화', icon: '🤖' },
              { id: 'mqtt-log', label: '🌳 MQTT로그', icon: '🌳' },
              { id: 'settings', label: '⚙️ MQTT설정', icon: '⚙️' },
              { id: 'dashboard-settings', label: '🎨 대시보드설정', icon: '🎨' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                style={{
                  padding: '12px 20px',
                  border: 'none',
                  borderRadius: '12px',
                  backgroundColor: activeTab === tab.id ? 'rgba(255, 255, 255, 0.9)' : 'transparent',
                  color: activeTab === tab.id ? '#2c3e50' : 'white',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textShadow: activeTab === tab.id ? 'none' : '0 1px 2px rgba(0, 0, 0, 0.2)',
                  boxShadow: activeTab === tab.id ? '0 4px 12px rgba(0, 0, 0, 0.1)' : 'none'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {renderTabContent()}
      </div>

      <style>
        {`
          @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.4); }
            70% { box-shadow: 0 0 0 10px rgba(76, 175, 80, 0); }
            100% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0); }
          }
          
          /* 스크롤바 스타일링 */
          ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          
          ::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 4px;
          }
          
          ::-webkit-scrollbar-thumb {
            background: #c1c1c1;
            border-radius: 4px;
            transition: background 0.2s ease;
          }
          
          ::-webkit-scrollbar-thumb:hover {
            background: #a8a8a8;
          }
          
          ::-webkit-scrollbar-corner {
            background: #f1f1f1;
          }
          
          /* Firefox 스크롤바 */
          * {
            scrollbar-width: thin;
            scrollbar-color: #c1c1c1 #f1f1f1;
          }
          
          @media (max-width: 768px) {
            .sensor-grid {
              grid-template-columns: 1fr;
            }
          }
          
          @media (max-width: 480px) {
            .message-log {
              padding: 16px;
            }
          }
        `}
      </style>
    </div>
  );
};

export default SmartFarmDashboard;