interface MqttMessage {
  topic: string;
  message: string;
  timestamp: Date;
}

export const extractTopicsFromMessages = (messages: MqttMessage[]): string[] => {
  const topicSet = new Set<string>();
  messages.forEach(msg => {
    if (msg.topic) {
      topicSet.add(msg.topic);
    }
  });
  return Array.from(topicSet).sort();
};

export const getLatestValueForTopic = (messages: MqttMessage[], topic: string): string => {
  const topicMessages = messages.filter(msg => msg.topic === topic);
  if (topicMessages.length === 0) return '0';
  
  const latestMessage = topicMessages[topicMessages.length - 1];
  return latestMessage.message;
};

export const isNumericTopic = (messages: MqttMessage[], topic: string): boolean => {
  const topicMessages = messages.filter(msg => msg.topic === topic);
  if (topicMessages.length === 0) return false;
  
  // Check if most recent messages are numeric
  const recentMessages = topicMessages.slice(-5);
  const numericCount = recentMessages.filter(msg => {
    const parsed = parseFloat(msg.message);
    return !isNaN(parsed) && isFinite(parsed);
  }).length;
  
  return numericCount >= Math.ceil(recentMessages.length * 0.8); // 80% or more are numeric
};

export const guessTopicUnit = (topic: string): string => {
  const topicLower = topic.toLowerCase();
  
  if (topicLower.includes('temp')) return '°C';
  if (topicLower.includes('humid')) return '%';
  if (topicLower.includes('moisture') || topicLower.includes('soil')) return '%';
  if (topicLower.includes('light') || topicLower.includes('lux')) return 'lux';
  if (topicLower.includes('pressure')) return 'hPa';
  if (topicLower.includes('volt')) return 'V';
  if (topicLower.includes('current')) return 'A';
  if (topicLower.includes('power')) return 'W';
  if (topicLower.includes('speed')) return 'm/s';
  if (topicLower.includes('distance')) return 'cm';
  if (topicLower.includes('ph')) return 'pH';
  if (topicLower.includes('ppm')) return 'ppm';
  
  return '';
};

export const guessTopicIcon = (topic: string): string => {
  const topicLower = topic.toLowerCase();
  
  // Common sensor type icons
  const sensorIcons: { [key: string]: string } = {
    'temp': '🌡️',
    'temperature': '🌡️',
    'humid': '💧', 
    'humidity': '💧',
    'moisture': '🌱',
    'soil': '🌱',
    'light': '☀️',
    'lux': '☀️',
    'pressure': '📊',
    'ph': '🧪',
    'co2': '🌬️',
    'oxygen': '💨',
    'nitrogen': '🍃',
    'phosphorus': '🧪',
    'potassium': '⚡',
    'voltage': '⚡',
    'current': '⚡',
    'power': '⚡',
    'speed': '💨',
    'distance': '📏',
    'level': '📊',
    'flow': '💧',
    'rpm': '🔄',
    'fan': '🔄',
    'pump': '🔄',
    'motor': '⚙️',
    'valve': '🔧',
    'switch': '🔘',
    'relay': '🔘',
    'led': '💡',
    'heater': '🔥',
    'cooler': '❄️',
    'door': '🚪',
    'window': '🧩',
    'alarm': '🚨',
    'sensor': '📊',
    'monitor': '📺',
    'control': '🎮',
    'timer': '⏰',
    'clock': '🕰️'
  };
  
  // Check if any sensor type matches
  for (const [key, value] of Object.entries(sensorIcons)) {
    if (topicLower.includes(key)) {
      return value;
    }
  }
  
  return '📊'; // Default sensor icon
};

export const guessTopicDisplayName = (topic: string): string => {
  const topicLower = topic.toLowerCase();
  const parts = topic.split('/');
  const lastPart = parts[parts.length - 1];
  
  // Common sensor type names
  const sensorTypes: { [key: string]: string } = {
    'temp': '온도',
    'temperature': '온도',
    'humid': '습도', 
    'humidity': '습도',
    'moisture': '토양 수분',
    'soil': '토양 수분',
    'light': '조도',
    'lux': '조도',
    'pressure': '압력',
    'ph': 'pH',
    'co2': 'CO2',
    'oxygen': '산소',
    'nitrogen': '질소',
    'phosphorus': '인',
    'potassium': '칼륨',
    'voltage': '전압',
    'current': '전류',
    'power': '전력',
    'speed': '속도',
    'distance': '거리',
    'level': '레벨',
    'flow': '유량',
    'rpm': 'RPM',
    'fan': '팬',
    'pump': '펀프',
    'motor': '모터',
    'valve': '밸브',
    'switch': '스위치',
    'relay': '릴레이',
    'led': 'LED',
    'heater': '히터',
    'cooler': '쿨러',
    'door': '문',
    'window': '창문',
    'alarm': '알람',
    'sensor': '센서',
    'monitor': '모니터',
    'control': '제어',
    'timer': '타이머',
    'clock': '시계'
  };
  
  // Check if any sensor type matches
  for (const [key, value] of Object.entries(sensorTypes)) {
    if (topicLower.includes(key)) {
      return value;
    }
  }
  
  // Fallback: use the last part of the topic with some formatting
  const formatted = lastPart
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
  
  return formatted;
};

// Common sensor icons for selection
export const SENSOR_ICONS = [
  '🌡️', '💧', '🌱', '☀️', '📊', '🧪', '🌬️', '💨', '🍃',
  '⚡', '🔥', '❄️', '🔄', '⚙️', '🔧', '🔘', '💡', '🚪',
  '🧩', '🚨', '📺', '🎮', '⏰', '🕰️', '📏', '📊', '📝',
  '💰', '💱', '💲', '💳', '💴', '💵', '💶', '💷', '💸',
  '💹', '💺', '💻', '💼', '💽', '💾', '💿', '📀', '📁',
  '📂', '📃', '📄', '📅', '📆', '📇', '📈', '📉', '📊',
  '📋', '📌', '📍', '📎', '📏', '📐', '📑', '📒', '📓',
  '📔', '📕', '📖', '📗', '📘', '📙', '📚', '📛', '📜'
];

// 스위치 카드 전용 아이콘
export const SWITCH_ICONS = [
  // 조명 관련
  '💡', '🔆', '🌟', '✨', '🔅', '💫', '🌠', '🕯️',
  
  // 전원 및 전기
  '⚡', '🔌', '🔋', '⚡', '🔘', '🔴', '🟢', '🟡',
  
  // 히터 및 냉각
  '🔥', '🌡️', '♨️', '🥵', '❄️', '🧊', '🥶', '🌨️',
  
  // 펌프 및 급수
  '💧', '🚿', '🚰', '⛲', '💦', '🌊', '🌀', '♻️',
  
  // 팬 및 환기
  '🌪️', '💨', '🌬️', '🍃', '🔄', '↩️', '↪️', '🔃',
  
  // 창문 및 도어
  '🚪', '🪟', '🏠', '🏡', '🔓', '🔒', '🗝️', '🔑',
  
  // 모터 및 기계
  '⚙️', '🔧', '🔩', '🛠️', '🔨', '⚒️', '🧰', '⛏️',
  
  // 농업 장비
  '🚜', '🌾', '🌿', '🌱', '🪴', '🌳', '🍀', '🌽',
  
  // 알람 및 경고
  '🚨', '⚠️', '🔔', '📢', '📯', '🚩', '⛔', '🛑',
  
  // 기타 제어
  '🎛️', '🎚️', '📟', '📱', '⌚', '🕹️', '🎮', '📡'
];

// 스위치 토픽 필터링 패턴
export const SWITCH_DEVICE_PATTERNS = [
  /\/switch\//i, /\/relay\//i, /\/light\//i, 
  /\/outlet\//i, /\/plug\//i, /\/fan\//i,
  /\/heater\//i, /\/pump\//i, /\/valve\//i,
  /\/motor\//i, /\/actuator\//i, /\/control\//i
];

export const STATE_TOPIC_PATTERNS = [
  /\/state$/i, /\/status$/i, /\/get$/i, /\/current$/i
];

export const COMMAND_TOPIC_PATTERNS = [
  /\/set$/i, /\/command$/i, /\/control$/i, /\/cmd$/i
];

// 스위치 토픽 필터링 함수
export const filterSwitchTopics = (topics: string[]): string[] => {
  return topics.filter(topic => 
    SWITCH_DEVICE_PATTERNS.some(pattern => pattern.test(topic))
  );
};

// 상태 토픽 필터링
export const filterStateTopics = (topics: string[]): string[] => {
  return topics.filter(topic => 
    STATE_TOPIC_PATTERNS.some(pattern => pattern.test(topic))
  );
};

// 제어 토픽 필터링
export const filterCommandTopics = (topics: string[]): string[] => {
  return topics.filter(topic => 
    COMMAND_TOPIC_PATTERNS.some(pattern => pattern.test(topic))
  );
};

// 토픽 페어 자동 매칭 (state ↔ command)
export const findMatchingCommandTopic = (stateTopic: string, allTopics: string[]): string | null => {
  // state 토픽에서 패턴 제거하고 base path 추출
  const basePath = stateTopic.replace(/\/(state|status|get|current)$/i, '');
  
  // 가능한 command 토픽들 생성
  const possibleCommands = [
    `${basePath}/set`,
    `${basePath}/command`,
    `${basePath}/control`,
    `${basePath}/cmd`
  ];
  
  // 실제로 존재하는 토픽 찾기
  for (const cmdTopic of possibleCommands) {
    if (allTopics.some(topic => topic.toLowerCase() === cmdTopic.toLowerCase())) {
      return cmdTopic;
    }
  }
  
  return null;
};

// 기본 값 매핑 생성
export const createDefaultValueMapping = (switchType: 'BINARY' | 'TRIPLE') => {
  if (switchType === 'BINARY') {
    return {
      on: 'ON',
      off: 'OFF'
    };
  } else {
    return {
      on: 'ON',
      off: 'OFF',
      state1: 'CLOSE',
      state2: 'STOP', 
      state3: 'OPEN'
    };
  }
};

// Common sensor units for selection
export const COMMON_UNITS = [
  // Temperature
  '°C', '°F', 'K',
  // Humidity & Percentage
  '%', '%RH',
  // Light
  'lux', 'lm', 'cd/m²',
  // Pressure
  'Pa', 'hPa', 'kPa', 'MPa', 'bar', 'atm', 'mmHg', 'inHg', 'psi',
  // Electrical
  'V', 'mV', 'kV', 'A', 'mA', 'μA', 'W', 'kW', 'kWh', 'Ω', 'kΩ', 'MΩ',
  // Distance & Length
  'mm', 'cm', 'm', 'km', 'in', 'ft', 'yd',
  // Volume
  'mL', 'L', 'gal', 'm³', 'ft³',
  // Weight & Mass
  'g', 'kg', 'lb', 'oz', 'ton',
  // Speed
  'm/s', 'km/h', 'mph', 'ft/s',
  // Flow
  'L/min', 'L/h', 'gal/min', 'm³/h',
  // Concentration
  'ppm', 'ppb', 'mg/L', 'μg/m³',
  // Time
  's', 'min', 'h', 'day',
  // Frequency
  'Hz', 'kHz', 'MHz', 'GHz',
  // Energy
  'J', 'kJ', 'cal', 'kcal', 'BTU',
  // Other
  'rpm', 'dB', 'pH', 'NTU', 'FNU'
];

export type { MqttMessage };