import React, { useState, useRef, useEffect } from 'react';
import SensorCard from './SensorCard';
import SwitchCard from './SwitchCard';
import { saveCardConfigs, loadCardConfigs, type SensorCardConfig, type SwitchCardConfig, type CardConfig, CardType, createBinarySwitchCard, createTripleSwitchCard } from '../utils/cardStorage';
import { extractTopicsFromMessages, getLatestValueForTopic, isNumericTopic, guessTopicUnit, guessTopicDisplayName, guessTopicIcon, SENSOR_ICONS, SWITCH_ICONS, COMMON_UNITS, filterSwitchTopics, filterStateTopics, filterCommandTopics, findMatchingCommandTopic, createDefaultValueMapping, type MqttMessage } from '../utils/topicUtils';
import { findNextAvailablePosition, rearrangeCards, constrainToContainer, removeOverlaps, snapToGrid, resolveCollisionsDuringDrag, debounce, type CardLayout } from '../utils/cardLayoutUtils';
import { dataHistoryManager } from '../utils/dataHistory';

interface SensorCardManagerProps {
  sensorData: {
    temperature: number;
    humidity: number;
    soilMoisture: number;
    lightIntensity: number;
    lastUpdated: Date;
  };
  messages: MqttMessage[];
  publish: (topic: string, message: string) => void;
  getTemperatureStatus: (temp: number) => 'low' | 'normal' | 'warning' | 'danger';
  getHumidityStatus: (humidity: number) => 'low' | 'normal' | 'warning' | 'danger';
  getSoilMoistureStatus: (moisture: number) => 'low' | 'normal' | 'warning' | 'danger';
  getLightStatus: (light: number) => 'low' | 'normal' | 'warning' | 'danger';
}

const SensorCardManager: React.FC<SensorCardManagerProps> = ({
  sensorData,
  messages,
  publish,
  getTemperatureStatus,
  getHumidityStatus,
  getSoilMoistureStatus,
  getLightStatus
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [cards, setCards] = useState<CardConfig[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCardTemplate, setNewCardTemplate] = useState({
    title: '',
    unit: '',
    dataSource: 'temperature',
    mqttTopic: '',
    icon: '',
    customUnit: false,
    isCalculated: false,
    calculationType: 'average' as 'average' | 'sum' | 'difference' | 'max' | 'min' | 'ratio',
    sourceCards: [] as string[],
    cardType: 'sensor' as 'sensor' | 'switch',
    switchType: 'binary' as 'binary' | 'triple',
    // 스위치 MQTT 설정
    mqttEnabled: false,
    stateTopic: '',
    commandTopic: '',
    onValue: 'ON',
    offValue: 'OFF',
    state1Value: 'CLOSE',
    state2Value: 'STOP',
    state3Value: 'OPEN'
  });
  const [selectedTopic, setSelectedTopic] = useState('');
  const [editingCard, setEditingCard] = useState<string | null>(null);
  const [editTopicModal, setEditTopicModal] = useState(false);
  const [editIconModal, setEditIconModal] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [editDisplayModal, setEditDisplayModal] = useState(false);
  const [selectedDisplayType, setSelectedDisplayType] = useState<'number' | 'gauge' | 'bar' | 'hybrid' | 'minichart' | 'target' | 'segment' | 'wave' | 'sparkline' | 'donut' | 'digital' | 'gradient'>('number');
  const [selectedMinValue, setSelectedMinValue] = useState(0);
  const [selectedMaxValue, setSelectedMaxValue] = useState(100);
  const [selectedOffset, setSelectedOffset] = useState(0);
  const [selectedColorRanges, setSelectedColorRanges] = useState({
    low: { min: 0, max: 20 },
    normal: { min: 20, max: 60 },
    warning: { min: 60, max: 80 },
    danger: { min: 80, max: 100 }
  });

  const containerRef = useRef<HTMLDivElement>(null);

  const getSensorValue = (dataSource: string, mqttTopic?: string) => {
    // If MQTT topic is specified, use it directly
    if (mqttTopic) {
      return getLatestValueForTopic(messages, mqttTopic);
    }
    
    // Fallback to legacy dataSource mapping
    switch (dataSource) {
      case 'temperature':
        return sensorData.temperature.toFixed(1);
      case 'humidity':
        return sensorData.humidity.toFixed(1);
      case 'soilMoisture':
        return sensorData.soilMoisture.toFixed(1);
      case 'lightIntensity':
        return sensorData.lightIntensity.toFixed(0);
      default:
        return '0';
    }
  };

  const getSensorStatus = (dataSource: string, mqttTopic?: string) => {
    // If MQTT topic is specified, determine status from the value
    if (mqttTopic) {
      const value = parseFloat(getLatestValueForTopic(messages, mqttTopic));
      if (isNaN(value)) return 'normal' as const;
      
      // Simple heuristic based on topic name
      const topicLower = mqttTopic.toLowerCase();
      if (topicLower.includes('temp')) {
        return getTemperatureStatus(value);
      } else if (topicLower.includes('humid')) {
        return getHumidityStatus(value);
      } else if (topicLower.includes('soil') || topicLower.includes('moisture')) {
        return getSoilMoistureStatus(value);
      } else if (topicLower.includes('light') || topicLower.includes('lux')) {
        return getLightStatus(value);
      }
      
      return 'normal' as const;
    }
    
    // Fallback to legacy dataSource mapping
    switch (dataSource) {
      case 'temperature':
        return getTemperatureStatus(sensorData.temperature);
      case 'humidity':
        return getHumidityStatus(sensorData.humidity);
      case 'soilMoisture':
        return getSoilMoistureStatus(sensorData.soilMoisture);
      case 'lightIntensity':
        return getLightStatus(sensorData.lightIntensity);
      default:
        return 'normal' as const;
    }
  };

  const handleCardEdit = (id: string, updates: Partial<CardConfig>) => {
    setCards(prevCards =>
      prevCards.map(card =>
        card.id === id ? { ...card, ...updates } : card
      )
    );
  };

  const handleSwitchStateChange = (id: string, newState: number) => {
    console.log(`🔄 스위치 상태 변경 요청 - ID: ${id}, 새 상태: ${newState}`);
    
    const card = cards.find(c => c.id === id && c.cardType === CardType.SWITCH) as SwitchCardConfig;
    
    if (!card) {
      console.error(`❌ 스위치 카드를 찾을 수 없음 - ID: ${id}`);
      return;
    }
    
    console.log(`📋 카드 정보:`, {
      title: card.title,
      type: card.switchData.type,
      currentState: card.switchData.state,
      mqtt: card.switchData.mqtt
    });
    
    if (card.switchData.mqtt && card.switchData.mqtt.commandTopic) {
      // MQTT 제어 명령 전송
      const mqtt = card.switchData.mqtt;
      let commandValue = '';
      
      if (card.switchData.type === 'BINARY') {
        commandValue = newState === 1 ? mqtt.valueMapping.on : mqtt.valueMapping.off;
        console.log(`🔀 Binary 스위치 - 상태 ${newState} -> 값 "${commandValue}"`);
      } else if (card.switchData.type === 'TRIPLE') {
        if (newState === 0) commandValue = mqtt.valueMapping.state1 || 'CLOSE';
        else if (newState === 1) commandValue = mqtt.valueMapping.state2 || 'STOP';
        else if (newState === 2) commandValue = mqtt.valueMapping.state3 || 'OPEN';
        console.log(`🔀 Triple 스위치 - 상태 ${newState} -> 값 "${commandValue}"`);
      }
      
      if (commandValue) {
        console.log(`📤 MQTT 명령 전송:`, {
          topic: mqtt.commandTopic,
          value: commandValue,
          valueType: typeof commandValue,
          timestamp: new Date().toISOString()
        });
        
        // 상태 토픽과 제어 토픽 비교 로그
        if (mqtt.stateTopic) {
          console.log(`🔄 토픽 비교:`, {
            stateTopic: mqtt.stateTopic,
            commandTopic: mqtt.commandTopic,
            topicsMatch: mqtt.stateTopic.replace(/\/(state|status|get)$/i, '') === mqtt.commandTopic.replace(/\/(set|command|cmd|control)$/i, '')
          });
        }
        
        try {
          publish(mqtt.commandTopic, commandValue);
          console.log(`✅ MQTT 명령 전송 성공`);
        } catch (error) {
          console.error(`❌ MQTT 명령 전송 실패:`, error);
        }
      } else {
        console.warn(`⚠️ 명령 값이 비어있음 - 전송하지 않음`);
      }
    } else {
      console.warn(`⚠️ MQTT 설정이 없거나 제어 토픽이 없음:`, {
        hasMqtt: !!card.switchData.mqtt,
        commandTopic: card.switchData.mqtt?.commandTopic
      });
    }
    
    // 로컬 상태 업데이트 (즉시 반영용, MQTT 응답으로 다시 업데이트됨)
    console.log(`🔄 로컬 상태 업데이트: ${card.switchData.state} -> ${newState}`);
    setCards(prevCards =>
      prevCards.map(card => {
        if (card.id === id && card.cardType === CardType.SWITCH) {
          return {
            ...card,
            switchData: {
              ...card.switchData,
              state: newState
            }
          } as SwitchCardConfig;
        }
        return card;
      })
    );
  };
  
  // Handle mouse up event to end dragging
  const handleMouseUp = () => {
    if (isDragging) {
      handleDragEnd();
    }
  };
  
  // Add global mouse up listener
  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleCardDelete = (id: string) => {
    setCards(prevCards => prevCards.filter(card => card.id !== id));
  };

  const handleCardMove = (id: string, position: { x: number; y: number }) => {
    const card = cards.find(c => c.id === id);
    if (!card) return;
    
    const snappedPosition = {
      x: snapToGrid(position.x),
      y: snapToGrid(position.y)
    };
    
    const constrainedPosition = constrainToContainer(snappedPosition, card.size);
    
    // Set dragging state
    setIsDragging(true);
    
    // Convert cards to CardLayout format
    const layouts: CardLayout[] = cards.map(card => ({
      id: card.id,
      position: card.position,
      size: card.size
    }));
    
    // Resolve collisions in real-time
    const resolvedLayouts = resolveCollisionsDuringDrag(layouts, id, constrainedPosition);
    
    // Update cards with resolved positions
    setCards(prevCards => 
      prevCards.map(card => {
        const layout = resolvedLayouts.find(l => l.id === card.id);
        return layout ? { ...card, position: layout.position } : card;
      })
    );
  };
  
  // Debounced function to end dragging state
  const endDragging = debounce(() => {
    setIsDragging(false);
  }, 300);
  
  // Handle drag end
  const handleDragEnd = () => {
    endDragging();
  };

  const handleCardResize = (id: string, size: { width: number; height: number }) => {
    console.log('Card resized:', id, size); // Debug log
    setCards(prevCards => {
      const newCards = prevCards.map(card => {
        if (card.id === id) {
          const snappedSize = {
            width: snapToGrid(Math.max(200, size.width)),
            height: snapToGrid(Math.max(120, size.height))
          };
          const constrainedPosition = constrainToContainer(card.position, snappedSize);
          return { ...card, size: snappedSize, position: constrainedPosition };
        }
        return card;
      });
      console.log('Updated cards after resize:', newCards); // Debug log
      return newCards;
    });
  };

  const handleAddCard = () => {
    // Convert existing cards to CardLayout format for position calculation
    const existingLayouts: CardLayout[] = cards.map(card => ({
      id: card.id,
      position: card.position,
      size: card.size
    }));
    
    const newCardSize = { width: 275, height: 160 };
    const newPosition = findNextAvailablePosition(existingLayouts, newCardSize);
    
    let newCard: CardConfig;
    
    if (newCardTemplate.cardType === 'switch') {
      // 스위치 카드 생성
      const cardId = `card-${Date.now()}`;
      const cardTitle = newCardTemplate.title || 
                       (newCardTemplate.switchType === 'binary' ? '새 스위치' : '새 컨트롤러');
      
      // 기본 스위치 카드 생성
      let baseCard: SwitchCardConfig;
      if (newCardTemplate.switchType === 'triple') {
        baseCard = createTripleSwitchCard(cardId, cardTitle, newPosition, newCardTemplate.icon);
      } else {
        baseCard = createBinarySwitchCard(cardId, cardTitle, newPosition, newCardTemplate.icon);
      }
      
      // MQTT 설정 추가
      if (newCardTemplate.mqttEnabled && (newCardTemplate.stateTopic || newCardTemplate.commandTopic)) {
        const valueMapping = newCardTemplate.switchType === 'binary' ? 
          {
            on: newCardTemplate.onValue,
            off: newCardTemplate.offValue
          } : 
          {
            on: newCardTemplate.onValue,
            off: newCardTemplate.offValue,
            state1: newCardTemplate.state1Value,
            state2: newCardTemplate.state2Value,
            state3: newCardTemplate.state3Value
          };
          
        baseCard.switchData.mqtt = {
          stateTopic: newCardTemplate.stateTopic,
          commandTopic: newCardTemplate.commandTopic,
          valueMapping
        };
      }
      
      newCard = baseCard;
    } else {
      // 기존 센서 카드 생성 로직
      const mqttTopic = newCardTemplate.mqttTopic || (newCardTemplate.dataSource === 'mqtt' ? selectedTopic : '');
      
      newCard = {
        id: `card-${Date.now()}`,
        cardType: CardType.SENSOR,
        title: newCardTemplate.title || (mqttTopic ? guessTopicDisplayName(mqttTopic) : 
               newCardTemplate.isCalculated ? `${newCardTemplate.calculationType} 계산` : '새 센서'),
        value: newCardTemplate.isCalculated ? 0 : getSensorValue(newCardTemplate.dataSource, mqttTopic),
        unit: newCardTemplate.unit || (mqttTopic ? guessTopicUnit(mqttTopic) : ''),
        status: getSensorStatus(newCardTemplate.dataSource, mqttTopic),
        lastUpdated: sensorData.lastUpdated,
        position: newPosition,
        size: newCardSize,
        dataSource: newCardTemplate.isCalculated ? 'calculated' : newCardTemplate.dataSource,
        mqttTopic: mqttTopic,
        icon: newCardTemplate.icon || (mqttTopic ? guessTopicIcon(mqttTopic) : 
              newCardTemplate.isCalculated ? '📊' : '📊'),
        // 계산 카드 관련 필드
        isCalculated: newCardTemplate.isCalculated,
        calculationType: newCardTemplate.calculationType,
        sourceCards: newCardTemplate.sourceCards,
        // 기본 설정
        displayType: 'number',
        minValue: 0,
        maxValue: 100,
        offset: 0,
        colorRanges: {
          low: { min: 0, max: 20 },
          normal: { min: 20, max: 60 },
          warning: { min: 60, max: 80 },
          danger: { min: 80, max: 100 }
        }
      } as SensorCardConfig;
    }

    setCards(prevCards => [...prevCards, newCard]);
    setShowAddModal(false);
    setNewCardTemplate({ 
      title: '', 
      unit: '', 
      dataSource: 'temperature', 
      mqttTopic: '', 
      icon: '', 
      customUnit: false,
      isCalculated: false,
      calculationType: 'average',
      sourceCards: [],
      cardType: 'sensor',
      switchType: 'binary',
      // 스위치 MQTT 설정 초기화
      mqttEnabled: false,
      stateTopic: '',
      commandTopic: '',
      onValue: 'ON',
      offValue: 'OFF',
      state1Value: 'CLOSE',
      state2Value: 'STOP',
      state3Value: 'OPEN'
    });
    setSelectedTopic('');
  };

  const toggleEditMode = () => {
    if (isEditing) {
      // Save when exiting edit mode
      saveCardConfigs(cards);
      console.log('Cards saved on edit mode exit:', cards); // Debug log
    }
    setIsEditing(!isEditing);
  };

  const handleSaveCards = () => {
    saveCardConfigs(cards);
    console.log('Cards manually saved:', cards); // Debug log
    alert('카드 설정이 저장되었습니다!');
  };

  const handleResetCards = () => {
    if (confirm('모든 카드를 기본 설정으로 재설정하시겠습니까?')) {
      localStorage.removeItem('smartfarm-sensor-cards');
      setCards(loadCardConfigs());
    }
  };
  
  const handleRearrangeCards = () => {
    const layouts: CardLayout[] = cards.map(card => ({
      id: card.id,
      position: card.position,
      size: card.size
    }));
    
    const rearranged = rearrangeCards(layouts);
    
    setCards(prevCards => 
      prevCards.map(card => {
        const layout = rearranged.find(l => l.id === card.id);
        return layout ? { ...card, position: layout.position } : card;
      })
    );
    
    // Auto-save after rearrangement
    setTimeout(() => {
      const updatedCards = cards.map(card => {
        const layout = rearranged.find(l => l.id === card.id);
        return layout ? { ...card, position: layout.position } : card;
      });
      saveCardConfigs(updatedCards);
    }, 100);
  };

  // Load saved cards on component mount
  useEffect(() => {
    const savedCards = loadCardConfigs();
    console.log('Loaded cards from storage:', savedCards); // Debug log
    
    // Check for overlaps and fix them
    const layouts: CardLayout[] = savedCards.map(card => ({
      id: card.id,
      position: card.position,
      size: card.size
    }));
    
    const fixedLayouts = removeOverlaps(layouts);
    const fixedCards = savedCards.map(card => {
      const layout = fixedLayouts.find(l => l.id === card.id);
      return layout ? { ...card, position: layout.position } : card;
    });
    
    setCards(fixedCards);
  }, []);

  // Auto-save when cards change (debounced with longer delay)
  useEffect(() => {
    if (cards.length > 0) {
      const timeoutId = setTimeout(() => {
        saveCardConfigs(cards);
        console.log('Cards auto-saved:', cards); // Debug log
      }, 2000); // Save after 2 seconds of inactivity
      
      return () => clearTimeout(timeoutId);
    }
  }, [cards]);

  const updatedCards = cards.map(card => {
    if (card.cardType === CardType.SWITCH) {
      // 스위치 카드 MQTT 상태 업데이트
      const mqtt = card.switchData.mqtt;
      if (mqtt && mqtt.stateTopic) {
        const latestValue = getLatestValueForTopic(messages, mqtt.stateTopic);
        
        // 값 매핑을 통해 상태 결정
        let newState = card.switchData.state;
        
        if (card.switchData.type === 'BINARY') {
          if (latestValue === mqtt.valueMapping.on) {
            newState = 1;
          } else if (latestValue === mqtt.valueMapping.off) {
            newState = 0;
          }
        } else if (card.switchData.type === 'TRIPLE') {
          if (latestValue === mqtt.valueMapping.state1) {
            newState = 0;
          } else if (latestValue === mqtt.valueMapping.state2) {
            newState = 1;
          } else if (latestValue === mqtt.valueMapping.state3) {
            newState = 2;
          }
        }
        
        return {
          ...card,
          switchData: {
            ...card.switchData,
            state: newState
          }
        };
      }
      return card;
    } else {
      // 센서 카드 업데이트 (기존 로직)
      return {
        ...card,
        value: card.dataSource ? getSensorValue(card.dataSource, card.mqttTopic) : card.value,
        status: card.dataSource ? getSensorStatus(card.dataSource, card.mqttTopic) : card.status,
        lastUpdated: sensorData.lastUpdated
      };
    }
  });
  
  // Get available topics from messages
  const availableTopics = extractTopicsFromMessages(messages);
  const numericTopics = availableTopics.filter(topic => isNumericTopic(messages, topic));
  
  const handleEditTopic = (cardId: string) => {
    const card = cards.find(c => c.id === cardId);
    if (card) {
      setEditingCard(cardId);
      
      if (card.cardType === CardType.SWITCH) {
        // 스위치 카드의 경우 기존 MQTT 설정 로드
        const mqtt = card.switchData.mqtt;
        if (mqtt) {
          setNewCardTemplate(prev => ({
            ...prev,
            stateTopic: mqtt.stateTopic || '',
            commandTopic: mqtt.commandTopic || '',
            onValue: mqtt.valueMapping.on || 'ON',
            offValue: mqtt.valueMapping.off || 'OFF',
            state1Value: mqtt.valueMapping.state1 || 'CLOSE',
            state2Value: mqtt.valueMapping.state2 || 'STOP',
            state3Value: mqtt.valueMapping.state3 || 'OPEN'
          }));
        }
      } else {
        // 센서 카드의 경우 기존 토픽 설정
        setSelectedTopic(card.mqttTopic || '');
      }
      
      setEditTopicModal(true);
    }
  };
  
  const handleEditIcon = (cardId: string) => {
    const card = cards.find(c => c.id === cardId);
    if (card) {
      setSelectedIcon(card.icon || '');
      setEditingCard(cardId);
      setEditIconModal(true);
    }
  };
  
  const handleEditDisplay = (cardId: string) => {
    const card = cards.find(c => c.id === cardId);
    if (card) {
      setSelectedDisplayType(card.displayType || 'number');
      setSelectedMinValue(card.minValue || 0);
      setSelectedMaxValue(card.maxValue || 100);
      setSelectedOffset(card.offset || 0);
      setSelectedColorRanges(card.colorRanges || {
        low: { min: 0, max: 20 },
        normal: { min: 20, max: 60 },
        warning: { min: 60, max: 80 },
        danger: { min: 80, max: 100 }
      });
      setEditingCard(cardId);
      setEditDisplayModal(true);
    }
  };
  
  const handleSaveIconEdit = (newIcon: string) => {
    if (editingCard) {
      handleCardEdit(editingCard, { icon: newIcon });
    }
    setEditIconModal(false);
    setEditingCard(null);
    setSelectedIcon('');
  };
  
  const handleSaveTopicEdit = (newTopic?: string) => {
    if (editingCard) {
      const card = cards.find(c => c.id === editingCard);
      
      if (card?.cardType === CardType.SWITCH) {
        // 스위치 카드 MQTT 설정 업데이트
        const valueMapping = {
          on: newCardTemplate.onValue,
          off: newCardTemplate.offValue,
          state1: newCardTemplate.state1Value,
          state2: newCardTemplate.state2Value,
          state3: newCardTemplate.state3Value
        };
        
        const newSwitchData = {
          ...card.switchData,
          mqtt: {
            stateTopic: newCardTemplate.stateTopic,
            commandTopic: newCardTemplate.commandTopic,
            valueMapping
          }
        };
        
        handleCardEdit(editingCard, { 
          switchData: newSwitchData
        });
      } else if (newTopic) {
        // 센서 카드 토픽 업데이트
        handleCardEdit(editingCard, { 
          mqttTopic: newTopic,
          title: guessTopicDisplayName(newTopic),
          unit: guessTopicUnit(newTopic),
          icon: guessTopicIcon(newTopic)
        });
      }
    }
    setEditTopicModal(false);
    setEditingCard(null);
  };
  
  const handleSaveDisplayEdit = () => {
    if (editingCard) {
      handleCardEdit(editingCard, { 
        displayType: selectedDisplayType,
        minValue: selectedMinValue,
        maxValue: selectedMaxValue,
        offset: selectedOffset,
        colorRanges: selectedColorRanges
      });
    }
    setEditDisplayModal(false);
    setEditingCard(null);
  };

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '600px' }}>
      {/* Control Panel */}
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 1000,
        display: 'flex',
        gap: '12px',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        padding: '16px',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.3)'
      }}>
        <button
          onClick={toggleEditMode}
          style={{
            padding: '8px 16px',
            backgroundColor: isEditing ? '#f44336' : '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {isEditing ? '✅ 편집 완료' : '✏️ 편집 모드'}
        </button>
        
        {isEditing && (
          <>
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              ➕ 카드 추가
            </button>
            <button
              onClick={handleSaveCards}
              style={{
                padding: '8px 16px',
                backgroundColor: '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              💾 저장
            </button>
            <button
              onClick={handleResetCards}
              style={{
                padding: '8px 16px',
                backgroundColor: '#ff9800',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              🔄 초기화
            </button>
            <button
              onClick={handleRearrangeCards}
              style={{
                padding: '8px 16px',
                backgroundColor: '#9c27b0',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              📊 자동정렬
            </button>
            <button
              onClick={() => {
                if (confirm('모든 센서 데이터 히스토리를 삭제하시겠습니까?\n차트 분석에 사용되는 모든 데이터가 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.')) {
                  dataHistoryManager.clearHistory();
                  alert('센서 데이터 히스토리가 초기화되었습니다.');
                }
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              🗑️ 데이터 초기화
            </button>
          </>
        )}
      </div>

      {/* Card Container */}
      <div 
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          minHeight: '600px',
          backgroundColor: isEditing ? '#f8fafc' : 'transparent',
          border: isEditing ? '2px dashed #cbd5e0' : 'none',
          borderRadius: isEditing ? '16px' : '0',
          margin: '20px',
          backgroundImage: isEditing ? 
            'radial-gradient(circle at 25px 25px, #e2e8f0 1px, transparent 1px)' : 
            'none',
          backgroundSize: isEditing ? '25px 25px' : 'auto',
          transition: 'all 0.3s ease'
        }}
      >
        {isEditing ? (
          // Edit Mode - Absolute positioned cards
          updatedCards.map(card => {
            if (card.cardType === CardType.SWITCH) {
              return (
                <SwitchCard
                  key={card.id}
                  id={card.id}
                  title={card.title}
                  switchData={card.switchData}
                  position={card.position}
                  size={card.size}
                  icon={card.icon}
                  onEdit={handleCardEdit}
                  onDelete={handleCardDelete}
                  onMove={handleCardMove}
                  onResize={handleCardResize}
                  onStateChange={handleSwitchStateChange}
                  isEditing={isEditing}
                  onEditIcon={handleEditIcon}
                  onEditTopic={handleEditTopic}
                  editingCardId={editingCard}
                />
              );
            } else {
              return (
                <SensorCard
                  key={card.id}
                  id={card.id}
                  title={card.title}
                  value={card.value}
                  unit={card.unit}
                  status={card.status}
                  lastUpdated={card.lastUpdated}
                  position={card.position}
                  size={card.size}
                  icon={card.icon}
                  onEdit={handleCardEdit}
                  onDelete={handleCardDelete}
                  onMove={handleCardMove}
                  onResize={handleCardResize}
                  isEditing={isEditing}
                  onEditTopic={handleEditTopic}
                  onEditIcon={handleEditIcon}
                  editingCardId={editingCard}
                  displayType={card.displayType}
                  minValue={card.minValue}
                  maxValue={card.maxValue}
                  onEditDisplay={handleEditDisplay}
                  offset={card.offset}
                  colorRanges={card.colorRanges}
                  calculationType={card.calculationType}
                  sourceCards={card.sourceCards}
                  isCalculated={card.isCalculated}
                  allCards={updatedCards}
                />
              );
            }
          })
        ) : (
          // Normal Mode - Absolute layout for consistency
          <div style={{
            position: 'relative',
            width: '100%',
            height: '600px',
            padding: '0 20px'
          }}>
            {updatedCards.map(card => (
              <div 
                key={card.id} 
                style={{ 
                  position: 'absolute',
                  left: `${card.position.x}px`,
                  top: `${card.position.y}px`,
                  width: `${card.size.width}px`,
                  height: `${card.size.height}px`,
                  zIndex: 1
                }}
              >
                {card.cardType === CardType.SWITCH ? (
                  <SwitchCard
                    id={card.id}
                    title={card.title}
                    switchData={card.switchData}
                    position={card.position}
                    size={card.size}
                    icon={card.icon}
                    onEdit={handleCardEdit}
                    onDelete={handleCardDelete}
                    onMove={handleCardMove}
                    onResize={handleCardResize}
                    onStateChange={handleSwitchStateChange}
                    isEditing={isEditing}
                    onEditIcon={handleEditIcon}
                    onEditTopic={handleEditTopic}
                    editingCardId={editingCard}
                  />
                ) : (
                  <SensorCard
                    id={card.id}
                    title={card.title}
                    value={card.value}
                    unit={card.unit}
                    status={card.status}
                    lastUpdated={card.lastUpdated}
                    position={card.position}
                    size={card.size}
                    icon={card.icon}
                    onEdit={handleCardEdit}
                    onDelete={handleCardDelete}
                    onMove={handleCardMove}
                    onResize={handleCardResize}
                    isEditing={isEditing}
                    onEditTopic={handleEditTopic}
                    onEditIcon={handleEditIcon}
                    editingCardId={editingCard}
                    displayType={card.displayType}
                    minValue={card.minValue}
                    maxValue={card.maxValue}
                    onEditDisplay={handleEditDisplay}
                    offset={card.offset}
                    colorRanges={card.colorRanges}
                    calculationType={card.calculationType}
                    sourceCards={card.sourceCards}
                    isCalculated={card.isCalculated}
                    allCards={updatedCards}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Card Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            width: '500px',
            maxWidth: '90vw',
            maxHeight: '85vh',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '24px 32px 0 32px',
              borderBottom: '1px solid #e2e8f0',
              paddingBottom: '16px',
              flexShrink: 0
            }}>
              <h3 style={{
                margin: '0',
                color: '#2c3e50',
                fontSize: '20px',
                fontWeight: '600'
              }}>
                새 센서 카드 추가
              </h3>
            </div>
            
            {/* Modal Body - Scrollable */}
            <div style={{ 
              flex: 1,
              overflowY: 'auto',
              padding: '24px 32px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#2c3e50'
                }}>
                  카드 제목
                </label>
                <input
                  type="text"
                  placeholder="예: 🌡️ 온도"
                  value={newCardTemplate.title}
                  onChange={(e) => setNewCardTemplate({...newCardTemplate, title: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '14px',
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
                  카드 타입
                </label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setNewCardTemplate({...newCardTemplate, cardType: 'sensor', isCalculated: false})}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: newCardTemplate.cardType === 'sensor' ? '#667eea' : '#f8fafc',
                      color: newCardTemplate.cardType === 'sensor' ? 'white' : '#64748b',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    📡 센서 카드
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCardTemplate({...newCardTemplate, cardType: 'switch'})}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: newCardTemplate.cardType === 'switch' ? '#667eea' : '#f8fafc',
                      color: newCardTemplate.cardType === 'switch' ? 'white' : '#64748b',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    🔌 스위치 카드
                  </button>
                </div>
                
                {newCardTemplate.cardType === 'sensor' && (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setNewCardTemplate({...newCardTemplate, isCalculated: false})}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: !newCardTemplate.isCalculated ? '#4caf50' : '#f8fafc',
                        color: !newCardTemplate.isCalculated ? 'white' : '#64748b',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      📊 일반 센서
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewCardTemplate({...newCardTemplate, isCalculated: true})}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: newCardTemplate.isCalculated ? '#4caf50' : '#f8fafc',
                      color: newCardTemplate.isCalculated ? 'white' : '#64748b',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    🧮 계산 카드
                  </button>
                </div>
                )}
                
                {newCardTemplate.cardType === 'sensor' && !newCardTemplate.isCalculated && (
                  <select
                    value={newCardTemplate.dataSource}
                    onChange={(e) => {
                      setNewCardTemplate({...newCardTemplate, dataSource: e.target.value});
                      if (e.target.value === 'mqtt') {
                        setSelectedTopic('');
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  >
                    <option value="temperature">온도 (기본)</option>
                    <option value="humidity">습도 (기본)</option>
                    <option value="soilMoisture">토양 수분 (기본)</option>
                    <option value="lightIntensity">조도 (기본)</option>
                    <option value="mqtt">MQTT 토픽 선택</option>
                  </select>
                )}
                
                {newCardTemplate.cardType === 'switch' && (
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '8px',
                      fontWeight: '600',
                      color: '#2c3e50'
                    }}>
                      스위치 타입
                    </label>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                      <button
                        type="button"
                        onClick={() => setNewCardTemplate({...newCardTemplate, switchType: 'binary'})}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: newCardTemplate.switchType === 'binary' ? '#2196f3' : '#f8fafc',
                          color: newCardTemplate.switchType === 'binary' ? 'white' : '#64748b',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          fontSize: '14px',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        ⚡ ON/OFF 스위치
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewCardTemplate({...newCardTemplate, switchType: 'triple'})}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: newCardTemplate.switchType === 'triple' ? '#2196f3' : '#f8fafc',
                          color: newCardTemplate.switchType === 'triple' ? 'white' : '#64748b',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          fontSize: '14px',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        🎚️ 3단계 컨트롤
                      </button>
                    </div>
                    <div style={{
                      padding: '12px',
                      backgroundColor: '#f0f4ff',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#667eea'
                    }}>
                      {newCardTemplate.switchType === 'binary' 
                        ? '💡 예: LED 조명, 펌프, 히터 등의 ON/OFF 제어'
                        : '🪟 예: 창문 개폐, 환풍기 강약 조절, 차광막 제어 등'
                      }
                    </div>
                  </div>
                )}
                
                {/* 스위치 MQTT 설정 */}
                {newCardTemplate.cardType === 'switch' && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                      <input
                        type="checkbox"
                        id="mqttEnabled"
                        checked={newCardTemplate.mqttEnabled}
                        onChange={(e) => setNewCardTemplate({...newCardTemplate, mqttEnabled: e.target.checked})}
                        style={{ marginRight: '8px' }}
                      />
                      <label htmlFor="mqttEnabled" style={{
                        fontWeight: '600',
                        color: '#2c3e50',
                        cursor: 'pointer'
                      }}>
                        🌐 MQTT 연동 사용
                      </label>
                    </div>
                    
                    {newCardTemplate.mqttEnabled && (
                      <div style={{ display: 'grid', gap: '16px' }}>
                        {/* 상태 토픽 선택 */}
                        <div>
                          <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontWeight: '600',
                            color: '#2c3e50'
                          }}>
                            📥 상태 토픽 (State Topic)
                          </label>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <select
                              value={newCardTemplate.stateTopic}
                              onChange={(e) => {
                                const selectedStateTopic = e.target.value;
                                const allTopics = extractTopicsFromMessages(messages);
                                const matchingCommand = findMatchingCommandTopic(selectedStateTopic, allTopics);
                                
                                setNewCardTemplate({
                                  ...newCardTemplate, 
                                  stateTopic: selectedStateTopic,
                                  commandTopic: matchingCommand || newCardTemplate.commandTopic
                                });
                              }}
                              style={{
                                flex: 1,
                                padding: '12px',
                                border: '1px solid #ddd',
                                borderRadius: '8px',
                                fontSize: '14px',
                                outline: 'none'
                              }}
                            >
                              <option value="">상태 토픽 선택...</option>
                              {extractTopicsFromMessages(messages).map((topic, index) => (
                                <option key={index} value={topic}>{topic}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                const customTopic = prompt('상태 토픽을 직접 입력하세요:', newCardTemplate.stateTopic);
                                if (customTopic !== null) {
                                  const allTopics = extractTopicsFromMessages(messages);
                                  const matchingCommand = findMatchingCommandTopic(customTopic, allTopics);
                                  setNewCardTemplate({
                                    ...newCardTemplate, 
                                    stateTopic: customTopic,
                                    commandTopic: matchingCommand || newCardTemplate.commandTopic
                                  });
                                }
                              }}
                              style={{
                                padding: '12px',
                                backgroundColor: '#2196f3',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '14px'
                              }}
                              title="직접 입력"
                            >
                              ✏️
                            </button>
                          </div>
                          <div style={{
                            fontSize: '12px',
                            color: '#666',
                            marginTop: '4px'
                          }}>
                            현재 스위치 상태를 구독할 토픽 (예: /state, /status) - 직접 입력도 가능
                          </div>
                        </div>
                        
                        {/* 제어 토픽 선택 */}
                        <div>
                          <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontWeight: '600',
                            color: '#2c3e50'
                          }}>
                            📤 제어 토픽 (Command Topic)
                          </label>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <select
                              value={newCardTemplate.commandTopic}
                              onChange={(e) => setNewCardTemplate({...newCardTemplate, commandTopic: e.target.value})}
                              style={{
                                flex: 1,
                                padding: '12px',
                                border: '1px solid #ddd',
                                borderRadius: '8px',
                                fontSize: '14px',
                                outline: 'none'
                              }}
                            >
                              <option value="">제어 토픽 선택...</option>
                              {extractTopicsFromMessages(messages).map((topic, index) => (
                                <option key={index} value={topic}>{topic}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                const customTopic = prompt('제어 토픽을 직접 입력하세요:', newCardTemplate.commandTopic);
                                if (customTopic !== null) {
                                  setNewCardTemplate({...newCardTemplate, commandTopic: customTopic});
                                }
                              }}
                              style={{
                                padding: '12px',
                                backgroundColor: '#4caf50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '14px'
                              }}
                              title="직접 입력"
                            >
                              ✏️
                            </button>
                          </div>
                          <div style={{
                            fontSize: '12px',
                            color: '#666',
                            marginTop: '4px'
                          }}>
                            스위치 제어 명령을 보낼 토픽 (예: /set, /command) - 직접 입력도 가능
                          </div>
                        </div>
                        
                        {/* 값 매핑 설정 */}
                        <div>
                          <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontWeight: '600',
                            color: '#2c3e50'
                          }}>
                            🔄 값 매핑 설정
                          </label>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: newCardTemplate.switchType === 'binary' ? '1fr 1fr' : '1fr 1fr 1fr',
                            gap: '8px'
                          }}>
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: '500' }}>ON 값</label>
                              <input
                                type="text"
                                value={newCardTemplate.onValue}
                                onChange={(e) => setNewCardTemplate({...newCardTemplate, onValue: e.target.value})}
                                placeholder="ON"
                                style={{
                                  width: '100%',
                                  padding: '8px',
                                  border: '1px solid #ddd',
                                  borderRadius: '4px',
                                  fontSize: '12px'
                                }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: '500' }}>OFF 값</label>
                              <input
                                type="text"
                                value={newCardTemplate.offValue}
                                onChange={(e) => setNewCardTemplate({...newCardTemplate, offValue: e.target.value})}
                                placeholder="OFF"
                                style={{
                                  width: '100%',
                                  padding: '8px',
                                  border: '1px solid #ddd',
                                  borderRadius: '4px',
                                  fontSize: '12px'
                                }}
                              />
                            </div>
                            {newCardTemplate.switchType === 'triple' && (
                              <div>
                                <label style={{ fontSize: '12px', fontWeight: '500' }}>중간 값</label>
                                <input
                                  type="text"
                                  value={newCardTemplate.state2Value}
                                  onChange={(e) => setNewCardTemplate({...newCardTemplate, state2Value: e.target.value})}
                                  placeholder="STOP"
                                  style={{
                                    width: '100%',
                                    padding: '8px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    fontSize: '12px'
                                  }}
                                />
                              </div>
                            )}
                          </div>
                          <div style={{
                            fontSize: '12px',
                            color: '#666',
                            marginTop: '4px'
                          }}>
                            MQTT 메시지에서 사용할 값 (예: ON/OFF, 1/0, true/false)
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* 계산 카드 설정 */}
              {newCardTemplate.cardType === 'sensor' && newCardTemplate.isCalculated && (
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '8px',
                      fontWeight: '600',
                      color: '#2c3e50'
                    }}>
                      계산 타입
                    </label>
                    <select
                      value={newCardTemplate.calculationType}
                      onChange={(e) => setNewCardTemplate({
                        ...newCardTemplate, 
                        calculationType: e.target.value as 'average' | 'sum' | 'difference' | 'max' | 'min' | 'ratio'
                      })}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    >
                      <option value="average">평균 (Average)</option>
                      <option value="sum">합계 (Sum)</option>
                      <option value="difference">차이 (Difference)</option>
                      <option value="max">최대값 (Max)</option>
                      <option value="min">최소값 (Min)</option>
                      <option value="ratio">비율 (Ratio)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '8px',
                      fontWeight: '600',
                      color: '#2c3e50'
                    }}>
                      참조 카드 선택
                    </label>
                    <div style={{
                      maxHeight: '200px',
                      overflowY: 'auto',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      padding: '8px'
                    }}>
                      {cards.filter(card => card.cardType === CardType.SENSOR && !card.isCalculated).map(card => (
                        <label key={card.id} style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '8px',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <input
                            type="checkbox"
                            checked={newCardTemplate.sourceCards.includes(card.id)}
                            onChange={(e) => {
                              const cardId = card.id;
                              const currentSourceCards = newCardTemplate.sourceCards;
                              if (e.target.checked) {
                                setNewCardTemplate({
                                  ...newCardTemplate,
                                  sourceCards: [...currentSourceCards, cardId]
                                });
                              } else {
                                setNewCardTemplate({
                                  ...newCardTemplate,
                                  sourceCards: currentSourceCards.filter(id => id !== cardId)
                                });
                              }
                            }}
                            style={{ marginRight: '8px' }}
                          />
                          <span style={{ fontSize: '14px' }}>
                            {card.icon} {card.title}
                          </span>
                        </label>
                      ))}
                    </div>
                    {newCardTemplate.sourceCards.length > 0 && (
                      <div style={{
                        marginTop: '8px',
                        padding: '8px',
                        backgroundColor: '#f0f4ff',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: '#667eea'
                      }}>
                        선택된 카드: {newCardTemplate.sourceCards.length}개
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {newCardTemplate.cardType === 'sensor' && newCardTemplate.dataSource === 'mqtt' && !newCardTemplate.isCalculated && (
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: '600',
                    color: '#2c3e50'
                  }}>
                    MQTT 토픽 선택
                  </label>
                  <select
                    value={selectedTopic}
                    onChange={(e) => {
                      setSelectedTopic(e.target.value);
                      if (e.target.value) {
                        setNewCardTemplate({
                          ...newCardTemplate,
                          title: guessTopicDisplayName(e.target.value),
                          unit: guessTopicUnit(e.target.value),
                          mqttTopic: e.target.value,
                          icon: guessTopicIcon(e.target.value)
                        });
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  >
                    <option value="">토픽 선택...</option>
                    {numericTopics.map(topic => (
                      <option key={topic} value={topic}>
                        {topic} ({getLatestValueForTopic(messages, topic)})
                      </option>
                    ))}
                  </select>
                  
                  {numericTopics.length === 0 && (
                    <p style={{
                      color: '#64748b',
                      fontSize: '14px',
                      fontStyle: 'italic',
                      margin: '8px 0 0 0'
                    }}>
                      사용 가능한 숫자 토픽이 없습니다. MQTT 데이터를 수신해주세요.
                    </p>
                  )}
                </div>
              )}
              
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#2c3e50'
                }}>
                  아이콘 선택
                </label>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(8, 1fr)',
                  gap: '8px',
                  padding: '12px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  maxHeight: '120px',
                  overflowY: 'auto'
                }}>
                  {(newCardTemplate.cardType === 'switch' ? SWITCH_ICONS : SENSOR_ICONS).map((iconOption, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setNewCardTemplate({...newCardTemplate, icon: iconOption})}
                      style={{
                        padding: '8px',
                        border: newCardTemplate.icon === iconOption ? '2px solid #667eea' : '1px solid #e2e8f0',
                        borderRadius: '6px',
                        backgroundColor: newCardTemplate.icon === iconOption ? '#f0f4ff' : 'white',
                        cursor: 'pointer',
                        fontSize: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s',
                        minHeight: '40px'
                      }}
                      onMouseOver={(e) => {
                        if (newCardTemplate.icon !== iconOption) {
                          e.currentTarget.style.backgroundColor = '#f5f5f5';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (newCardTemplate.icon !== iconOption) {
                          e.currentTarget.style.backgroundColor = 'white';
                        }
                      }}
                    >
                      {iconOption}
                    </button>
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
                  단위
                </label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setNewCardTemplate({...newCardTemplate, customUnit: false})}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: !newCardTemplate.customUnit ? '#667eea' : '#f8fafc',
                      color: !newCardTemplate.customUnit ? 'white' : '#64748b',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    선택
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCardTemplate({...newCardTemplate, customUnit: true})}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: newCardTemplate.customUnit ? '#667eea' : '#f8fafc',
                      color: newCardTemplate.customUnit ? 'white' : '#64748b',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    직접입력
                  </button>
                </div>
                
                {newCardTemplate.customUnit ? (
                  <input
                    type="text"
                    placeholder="예: °C, %, lux"
                    value={newCardTemplate.unit}
                    onChange={(e) => setNewCardTemplate({...newCardTemplate, unit: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                ) : (
                  <select
                    value={newCardTemplate.unit}
                    onChange={(e) => setNewCardTemplate({...newCardTemplate, unit: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  >
                    <option value="">단위 선택...</option>
                    {COMMON_UNITS.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                )}
              </div>
              
            </div>
            
            {/* Modal Footer - Fixed */}
            <div style={{
              padding: '16px 32px 24px 32px',
              borderTop: '1px solid #e2e8f0',
              flexShrink: 0,
              backgroundColor: '#fafafa'
            }}>
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    color: '#64748b'
                  }}
                >
                  취소
                </button>
                <button
                  onClick={handleAddCard}
                  disabled={
                    newCardTemplate.cardType === 'sensor' && (
                      (newCardTemplate.dataSource === 'mqtt' && !selectedTopic && !newCardTemplate.isCalculated) ||
                      (newCardTemplate.isCalculated && newCardTemplate.sourceCards.length === 0)
                    )
                  }
                  style={{
                    padding: '12px 24px',
                    backgroundColor: (
                      newCardTemplate.cardType === 'sensor' && (
                        (newCardTemplate.dataSource === 'mqtt' && !selectedTopic && !newCardTemplate.isCalculated) ||
                        (newCardTemplate.isCalculated && newCardTemplate.sourceCards.length === 0)
                      )
                    ) ? '#ccc' : '#4caf50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: (
                      newCardTemplate.cardType === 'sensor' && (
                        (newCardTemplate.dataSource === 'mqtt' && !selectedTopic && !newCardTemplate.isCalculated) ||
                        (newCardTemplate.isCalculated && newCardTemplate.sourceCards.length === 0)
                      )
                    ) ? 'not-allowed' : 'pointer'
                  }}
                >
                  추가
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Topic Modal */}
      {editTopicModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            width: '500px',
            maxWidth: '90vw',
            maxHeight: '85vh',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '24px 32px 0 32px',
              borderBottom: '1px solid #e2e8f0',
              paddingBottom: '16px',
              flexShrink: 0
            }}>
              <h3 style={{
                margin: '0',
                color: '#2c3e50',
                fontSize: '20px',
                fontWeight: '600'
              }}>
                MQTT 토픽 편집
              </h3>
            </div>
            
            {/* Modal Body - Scrollable */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px 32px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              {editingCard && cards.find(c => c.id === editingCard)?.cardType === CardType.SWITCH ? (
                // 스위치 카드 MQTT 설정
                <>
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '8px',
                      fontWeight: '600',
                      color: '#2c3e50'
                    }}>
                      상태 토픽 (State Topic)
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <input
                        type="text"
                        value={newCardTemplate.stateTopic}
                        onChange={(e) => setNewCardTemplate(prev => ({ ...prev, stateTopic: e.target.value }))}
                        placeholder="상태 토픽을 입력하세요 (예: homeassistant/switch/light1/state)"
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #ddd',
                          borderRadius: '8px',
                          fontSize: '14px',
                          outline: 'none'
                        }}
                      />
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                          추천 토픽:
                        </span>
                        {availableTopics.filter(topic => 
                          topic.toLowerCase().includes('state') || 
                          topic.toLowerCase().includes('status') || 
                          topic.toLowerCase().includes('get') ||
                          topic.toLowerCase().includes('current')
                        ).slice(0, 3).map(topic => (
                          <button
                            key={topic}
                            onClick={() => setNewCardTemplate(prev => ({ ...prev, stateTopic: topic }))}
                            style={{
                              padding: '4px 8px',
                              fontSize: '11px',
                              backgroundColor: '#f0f8ff',
                              border: '1px solid #4caf50',
                              borderRadius: '4px',
                              color: '#388e3c',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {topic.length > 30 ? `...${topic.slice(-27)}` : topic}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '8px',
                      fontWeight: '600',
                      color: '#2c3e50'
                    }}>
                      제어 토픽 (Command Topic)
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <input
                        type="text"
                        value={newCardTemplate.commandTopic}
                        onChange={(e) => setNewCardTemplate(prev => ({ ...prev, commandTopic: e.target.value }))}
                        placeholder="제어 토픽을 입력하세요 (예: homeassistant/switch/light1/set)"
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #ddd',
                          borderRadius: '8px',
                          fontSize: '14px',
                          outline: 'none'
                        }}
                      />
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                          추천 토픽:
                        </span>
                        {availableTopics.filter(topic => 
                          topic.toLowerCase().includes('set') || 
                          topic.toLowerCase().includes('command') || 
                          topic.toLowerCase().includes('control') ||
                          topic.toLowerCase().includes('cmd')
                        ).slice(0, 3).map(topic => (
                          <button
                            key={topic}
                            onClick={() => setNewCardTemplate(prev => ({ ...prev, commandTopic: topic }))}
                            style={{
                              padding: '4px 8px',
                              fontSize: '11px',
                              backgroundColor: '#f0f4ff',
                              border: '1px solid #2196f3',
                              borderRadius: '4px',
                              color: '#1976d2',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {topic.length > 30 ? `...${topic.slice(-27)}` : topic}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '8px',
                      fontWeight: '600',
                      color: '#2c3e50'
                    }}>
                      값 매핑 설정
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '12px', color: '#666' }}>ON 값</label>
                        <input
                          type="text"
                          value={newCardTemplate.onValue}
                          onChange={(e) => setNewCardTemplate(prev => ({ ...prev, onValue: e.target.value }))}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '14px'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', color: '#666' }}>OFF 값</label>
                        <input
                          type="text"
                          value={newCardTemplate.offValue}
                          onChange={(e) => setNewCardTemplate(prev => ({ ...prev, offValue: e.target.value }))}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '14px'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                // 센서 카드 토픽 설정
                <>
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '8px',
                      fontWeight: '600',
                      color: '#2c3e50'
                    }}>
                      새 토픽 선택
                    </label>
                    <select
                      value={selectedTopic}
                      onChange={(e) => setSelectedTopic(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    >
                      <option value="">토픽 선택...</option>
                      {numericTopics.map(topic => (
                        <option key={topic} value={topic}>
                          {topic} ({getLatestValueForTopic(messages, topic)})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {selectedTopic && (
                    <div style={{
                      backgroundColor: '#f8fafc',
                      padding: '12px',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}>
                      <strong>미리보기:</strong><br/>
                      제목: {guessTopicDisplayName(selectedTopic)}<br/>
                      단위: {guessTopicUnit(selectedTopic) || '없음'}<br/>
                      현재 값: {getLatestValueForTopic(messages, selectedTopic)}
                    </div>
                  )}
                </>
              )}
            </div>
            
            {/* Modal Footer - Fixed */}
            <div style={{
              padding: '16px 32px 24px 32px',
              borderTop: '1px solid #e2e8f0',
              flexShrink: 0,
              backgroundColor: '#fafafa'
            }}>
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => {
                    setEditTopicModal(false);
                    setEditingCard(null);
                    setSelectedTopic('');
                  }}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    color: '#64748b'
                  }}
                >
                  취소
                </button>
                <button
                  onClick={() => handleSaveTopicEdit(selectedTopic)}
                  disabled={
                    editingCard && cards.find(c => c.id === editingCard)?.cardType === CardType.SWITCH 
                      ? !newCardTemplate.stateTopic && !newCardTemplate.commandTopic
                      : !selectedTopic
                  }
                  style={{
                    padding: '12px 24px',
                    backgroundColor: (
                      editingCard && cards.find(c => c.id === editingCard)?.cardType === CardType.SWITCH 
                        ? !newCardTemplate.stateTopic && !newCardTemplate.commandTopic
                        : !selectedTopic
                    ) ? '#ccc' : '#2196f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: (
                      editingCard && cards.find(c => c.id === editingCard)?.cardType === CardType.SWITCH 
                        ? !newCardTemplate.stateTopic && !newCardTemplate.commandTopic
                        : !selectedTopic
                    ) ? 'not-allowed' : 'pointer'
                  }}
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Icon Modal */}
      {editIconModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            width: '500px',
            maxWidth: '90vw',
            maxHeight: '85vh',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '24px 32px 0 32px',
              borderBottom: '1px solid #e2e8f0',
              paddingBottom: '16px',
              flexShrink: 0
            }}>
              <h3 style={{
                margin: '0',
                color: '#2c3e50',
                fontSize: '20px',
                fontWeight: '600'
              }}>
                아이콘 편집
              </h3>
            </div>
            
            {/* Modal Body - Scrollable */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px 32px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#2c3e50'
                }}>
                  새 아이콘 선택
                </label>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(8, 1fr)',
                  gap: '8px',
                  padding: '12px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {(() => {
                    const currentCard = cards.find(card => card.id === editingCard);
                    const iconArray = currentCard?.cardType === CardType.SWITCH ? SWITCH_ICONS : SENSOR_ICONS;
                    return iconArray.map((iconOption, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setSelectedIcon(iconOption)}
                      style={{
                        padding: '8px',
                        border: selectedIcon === iconOption ? '2px solid #667eea' : '1px solid #e2e8f0',
                        borderRadius: '6px',
                        backgroundColor: selectedIcon === iconOption ? '#f0f4ff' : 'white',
                        cursor: 'pointer',
                        fontSize: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s',
                        minHeight: '40px'
                      }}
                      onMouseOver={(e) => {
                        if (selectedIcon !== iconOption) {
                          e.currentTarget.style.backgroundColor = '#f5f5f5';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (selectedIcon !== iconOption) {
                          e.currentTarget.style.backgroundColor = 'white';
                        }
                      }}
                    >
                      {iconOption}
                      </button>
                    ));
                  })()}
                </div>
              </div>
              
              {selectedIcon && (
                <div style={{
                  backgroundColor: '#f8fafc',
                  padding: '12px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  textAlign: 'center'
                }}>
                  <strong>선택된 아이콘:</strong> <span style={{ fontSize: '20px' }}>{selectedIcon}</span>
                </div>
              )}
            </div>
            
            {/* Modal Footer - Fixed */}
            <div style={{
              padding: '16px 32px 24px 32px',
              borderTop: '1px solid #e2e8f0',
              flexShrink: 0,
              backgroundColor: '#fafafa'
            }}>
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => {
                    setEditIconModal(false);
                    setEditingCard(null);
                    setSelectedIcon('');
                  }}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    color: '#64748b'
                  }}
                >
                  취소
                </button>
                <button
                  onClick={() => handleSaveIconEdit(selectedIcon)}
                  disabled={!selectedIcon}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: !selectedIcon ? '#ccc' : '#ff9800',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: !selectedIcon ? 'not-allowed' : 'pointer'
                  }}
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Display Modal */}
      {editDisplayModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            width: '500px',
            maxWidth: '90vw',
            maxHeight: '85vh',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '24px 32px 0 32px',
              borderBottom: '1px solid #e2e8f0',
              paddingBottom: '16px',
              flexShrink: 0
            }}>
              <h3 style={{
                margin: '0',
                color: '#2c3e50',
                fontSize: '20px',
                fontWeight: '600'
              }}>
                표시 방식 편집
              </h3>
            </div>
            
            {/* Modal Body - Scrollable */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px 32px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '12px',
                  fontWeight: '600',
                  color: '#2c3e50'
                }}>
                  표시 유형
                </label>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px'
                }}>
                  {[
                    { value: 'number', label: '숫자', icon: '🔢', desc: '기본 숫자 표시' },
                    { value: 'gauge', label: '게이지', icon: '⭕', desc: '원형 게이지' },
                    { value: 'bar', label: '바 그래프', icon: '📊', desc: '막대 그래프' },
                    { value: 'hybrid', label: '혼합형', icon: '📈', desc: '숫자 + 바' },
                    { value: 'minichart', label: '미니차트', icon: '📈', desc: '누적 그래프' },
                    { value: 'target', label: '타겟', icon: '🎯', desc: '목표 달성률' },
                    { value: 'segment', label: '세그먼트', icon: '🏷️', desc: '구간별 색상' },
                    { value: 'wave', label: '웨이브', icon: '🌊', desc: '액체 흐름' },
                    { value: 'sparkline', label: '스파크', icon: '⚡', desc: '변화 추이' },
                    { value: 'donut', label: '도넛', icon: '🍩', desc: '도넛 차트' },
                    { value: 'digital', label: '디지털', icon: '📱', desc: 'LED 스타일' },
                    { value: 'gradient', label: '그라데이션', icon: '🎨', desc: '색상 전환' }
                  ].map(type => (
                    <button
                      key={type.value}
                      onClick={() => setSelectedDisplayType(type.value as any)}
                      style={{
                        padding: '12px 8px',
                        border: selectedDisplayType === type.value ? '2px solid #667eea' : '1px solid #e2e8f0',
                        borderRadius: '8px',
                        backgroundColor: selectedDisplayType === type.value ? '#f0f4ff' : 'white',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '500',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.2s',
                        textAlign: 'center'
                      }}
                      onMouseOver={(e) => {
                        if (selectedDisplayType !== type.value) {
                          e.currentTarget.style.backgroundColor = '#f8fafc';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (selectedDisplayType !== type.value) {
                          e.currentTarget.style.backgroundColor = 'white';
                        }
                      }}
                    >
                      <span style={{ fontSize: '18px' }}>{type.icon}</span>
                      <span style={{ fontSize: '11px', fontWeight: '600' }}>{type.label}</span>
                      <span style={{ fontSize: '9px', color: '#64748b', lineHeight: '1.2' }}>{type.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              {selectedDisplayType !== 'number' && selectedDisplayType !== 'digital' && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px'
                }}>
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '8px',
                      fontWeight: '600',
                      color: '#2c3e50'
                    }}>
                      최소값
                    </label>
                    <input
                      type="number"
                      value={selectedMinValue}
                      onChange={(e) => setSelectedMinValue(Number(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '14px',
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
                      최대값
                    </label>
                    <input
                      type="number"
                      value={selectedMaxValue}
                      onChange={(e) => setSelectedMaxValue(Number(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>
              )}
              
              {/* 교정 옵셋 설정 */}
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#2c3e50'
                }}>
                  교정 옵셋
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={selectedOffset}
                  onChange={(e) => setSelectedOffset(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                  placeholder="센서값 보정을 위한 옵셋 (기본값: 0)"
                />
                <div style={{
                  fontSize: '12px',
                  color: '#64748b',
                  marginTop: '4px'
                }}>
                  표시값 = 센서값 + 옵셋
                </div>
              </div>
              
              {/* 컬러 범위 설정 */}
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#2c3e50'
                }}>
                  컬러 범위 설정 (실제 센서값 기준)
                </label>
                <div style={{
                  fontSize: '11px',
                  color: '#64748b',
                  marginBottom: '12px',
                  padding: '8px',
                  backgroundColor: '#f0f9ff',
                  border: '1px solid #e0f2fe',
                  borderRadius: '4px'
                }}>
                  💡 <strong>범위 규칙:</strong> 값이 여러 범위에 속할 수 있으며, 위험 &gt; 주의 &gt; 정상 &gt; 낮음 순으로 우선순위가 적용됩니다.
                  <br/>
                  예: 10.5는 "0~10" 범위에도 "10~20" 범위에도 속하지 않지만, 가장 가까운 범위 색상을 사용합니다.
                </div>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '100px 1fr 1fr',
                    gap: '8px',
                    alignItems: 'center'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        backgroundColor: '#2196f3',
                        borderRadius: '4px'
                      }}></div>
                      <span style={{ fontSize: '14px', fontWeight: '500' }}>낮음</span>
                    </div>
                    <input
                      type="number"
                      value={selectedColorRanges.low.min}
                      onChange={(e) => setSelectedColorRanges({
                        ...selectedColorRanges,
                        low: { ...selectedColorRanges.low, min: Number(e.target.value) }
                      })}
                      style={{
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '12px',
                        outline: 'none'
                      }}
                      placeholder="최소"
                    />
                    <input
                      type="number"
                      value={selectedColorRanges.low.max}
                      onChange={(e) => setSelectedColorRanges({
                        ...selectedColorRanges,
                        low: { ...selectedColorRanges.low, max: Number(e.target.value) }
                      })}
                      style={{
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '12px',
                        outline: 'none'
                      }}
                      placeholder="최대"
                    />
                  </div>
                  
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '100px 1fr 1fr',
                    gap: '8px',
                    alignItems: 'center'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        backgroundColor: '#4caf50',
                        borderRadius: '4px'
                      }}></div>
                      <span style={{ fontSize: '14px', fontWeight: '500' }}>정상</span>
                    </div>
                    <input
                      type="number"
                      value={selectedColorRanges.normal.min}
                      onChange={(e) => setSelectedColorRanges({
                        ...selectedColorRanges,
                        normal: { ...selectedColorRanges.normal, min: Number(e.target.value) }
                      })}
                      style={{
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '12px',
                        outline: 'none'
                      }}
                      placeholder="최소"
                    />
                    <input
                      type="number"
                      value={selectedColorRanges.normal.max}
                      onChange={(e) => setSelectedColorRanges({
                        ...selectedColorRanges,
                        normal: { ...selectedColorRanges.normal, max: Number(e.target.value) }
                      })}
                      style={{
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '12px',
                        outline: 'none'
                      }}
                      placeholder="최대"
                    />
                  </div>
                  
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '100px 1fr 1fr',
                    gap: '8px',
                    alignItems: 'center'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        backgroundColor: '#ff9800',
                        borderRadius: '4px'
                      }}></div>
                      <span style={{ fontSize: '14px', fontWeight: '500' }}>주의</span>
                    </div>
                    <input
                      type="number"
                      value={selectedColorRanges.warning.min}
                      onChange={(e) => setSelectedColorRanges({
                        ...selectedColorRanges,
                        warning: { ...selectedColorRanges.warning, min: Number(e.target.value) }
                      })}
                      style={{
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '12px',
                        outline: 'none'
                      }}
                      placeholder="최소"
                    />
                    <input
                      type="number"
                      value={selectedColorRanges.warning.max}
                      onChange={(e) => setSelectedColorRanges({
                        ...selectedColorRanges,
                        warning: { ...selectedColorRanges.warning, max: Number(e.target.value) }
                      })}
                      style={{
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '12px',
                        outline: 'none'
                      }}
                      placeholder="최대"
                    />
                  </div>
                  
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '100px 1fr 1fr',
                    gap: '8px',
                    alignItems: 'center'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        backgroundColor: '#f44336',
                        borderRadius: '4px'
                      }}></div>
                      <span style={{ fontSize: '14px', fontWeight: '500' }}>위험</span>
                    </div>
                    <input
                      type="number"
                      value={selectedColorRanges.danger.min}
                      onChange={(e) => setSelectedColorRanges({
                        ...selectedColorRanges,
                        danger: { ...selectedColorRanges.danger, min: Number(e.target.value) }
                      })}
                      style={{
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '12px',
                        outline: 'none'
                      }}
                      placeholder="최소"
                    />
                    <input
                      type="number"
                      value={selectedColorRanges.danger.max}
                      onChange={(e) => setSelectedColorRanges({
                        ...selectedColorRanges,
                        danger: { ...selectedColorRanges.danger, max: Number(e.target.value) }
                      })}
                      style={{
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '12px',
                        outline: 'none'
                      }}
                      placeholder="최대"
                    />
                  </div>
                </div>
              </div>
              
              <div style={{
                backgroundColor: '#f8fafc',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <h4 style={{
                  margin: '0 0 8px 0',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#2c3e50'
                }}>
                  💡 표시 방식 가이드
                </h4>
                <div style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>🎯 추천 조합:</strong>
                  </div>
                  <div style={{ marginBottom: '4px' }}>
                    • 온도/습도: 웨이브, 타겟, 게이지
                  </div>
                  <div style={{ marginBottom: '4px' }}>
                    • 토양 수분: 세그먼트, 웨이브, 그라데이션
                  </div>
                  <div style={{ marginBottom: '4px' }}>
                    • 조도: 디지털, 스파크, 미니차트
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    • 전력/성능: 도넛, 타겟, 바 그래프
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>⚙️ 교정 옵셋:</strong> 센서값 보정 (+/- 값)
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>🎨 컬러 범위:</strong> 실제 센서값 기준으로 색상 결정
                  </div>
                  <div style={{ marginBottom: '4px' }}>
                    • 우선순위: 위험(빨강) &gt; 주의(주황) &gt; 정상(녹색) &gt; 낮음(파랑)
                  </div>
                  <div style={{ marginBottom: '4px' }}>
                    • 범위 밖 값은 가장 가까운 범위 색상 사용
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                    예: 0~10(낮음), 11~20(정상), 21~30(주의) 설정시 &rarr; 10.5는 정상 범위에 더 가까우므로 녹색
                  </div>
                </div>
              </div>
              
            </div>
            
            {/* Modal Footer - Fixed */}
            <div style={{
              padding: '16px 32px 24px 32px',
              borderTop: '1px solid #e2e8f0',
              flexShrink: 0,
              backgroundColor: '#fafafa'
            }}>
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => {
                    setEditDisplayModal(false);
                    setEditingCard(null);
                  }}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    color: '#64748b'
                  }}
                >
                  취소
                </button>
                <button
                  onClick={handleSaveDisplayEdit}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#9c27b0',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Mode Instructions */}
      {isEditing && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          padding: '16px',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          zIndex: 1000,
          maxWidth: '300px'
        }}>
          <h4 style={{
            margin: '0 0 12px 0',
            color: '#2c3e50',
            fontSize: '16px',
            fontWeight: '600'
          }}>
            편집 모드 사용법
          </h4>
          <ul style={{
            margin: 0,
            padding: '0 0 0 16px',
            color: '#64748b',
            fontSize: '14px',
            lineHeight: '1.5'
          }}>
            <li>카드를 드래그하여 위치 변경 (25px 그리드)</li>
            <li>우하단 모서리를 드래그하여 크기 조절</li>
            <li>제목을 클릭하여 편집</li>
            <li>카드 내부 🔌 버튼으로 토픽 편집</li>
            <li>카드 내부 🎨 버튼으로 아이콘 편집</li>
            <li>카드 내부 📊 버튼으로 표시 방식 편집</li>
            <li>카드 내부 🗑️ 버튼으로 카드 삭제</li>
            <li>편집 완료 시 자동 저장됨</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default SensorCardManager;