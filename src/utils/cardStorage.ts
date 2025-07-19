interface SensorCardConfig {
  id: string;
  title: string;
  value: string | number;
  unit?: string;
  status?: 'low' | 'normal' | 'warning' | 'danger';
  lastUpdated?: Date;
  position: { x: number; y: number };
  size: { width: number; height: number };
  dataSource?: string;
  mqttTopic?: string;
  icon?: string;
  displayType?: 'number' | 'gauge' | 'bar' | 'hybrid' | 'minichart' | 'target' | 'segment' | 'wave' | 'sparkline' | 'donut' | 'digital' | 'gradient';
  minValue?: number;
  maxValue?: number;
  offset?: number;
  colorRanges?: {
    low: { min: number; max: number };
    normal: { min: number; max: number };
    warning: { min: number; max: number };
    danger: { min: number; max: number };
  };
  // 계산 카드 관련 필드
  calculationType?: 'average' | 'sum' | 'difference' | 'max' | 'min' | 'ratio';
  sourceCards?: string[]; // 참조할 카드 ID들
  isCalculated?: boolean;
}

const STORAGE_KEY = 'smartfarm-sensor-cards';

export const saveCardConfigs = (cards: SensorCardConfig[]): void => {
  try {
    const serializedCards = cards.map(card => ({
      ...card,
      lastUpdated: card.lastUpdated ? card.lastUpdated.toISOString() : undefined
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializedCards));
  } catch (error) {
    console.error('Error saving card configurations:', error);
  }
};

export const loadCardConfigs = (): SensorCardConfig[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return getDefaultCardConfigs();
    }
    
    // 임시: 4단계 컬러 시스템 적용을 위한 강제 초기화
    // 기존 데이터가 있다면 버전 확인
    const storedData = JSON.parse(stored);
    if (storedData && storedData.length > 0) {
      const firstCard = storedData[0];
      if (!firstCard.colorRanges || !firstCard.colorRanges.low) {
        console.log('기존 3단계 컬러 데이터 감지 - 4단계로 업그레이드');
        localStorage.removeItem(STORAGE_KEY);
        return getDefaultCardConfigs();
      }
    }
    
    const parsed = JSON.parse(stored);
    return parsed.map((card: any) => {
      // 기존 3단계 컬러 시스템을 4단계로 마이그레이션
      let colorRanges = card.colorRanges;
      if (colorRanges && !colorRanges.low) {
        // 3단계 -> 4단계 변환
        const minValue = card.minValue || 0;
        const maxValue = card.maxValue || 100;
        const range = maxValue - minValue;
        
        colorRanges = {
          low: { min: minValue, max: minValue + range * 0.2 },
          normal: colorRanges.normal || { min: minValue + range * 0.2, max: minValue + range * 0.6 },
          warning: colorRanges.warning || { min: minValue + range * 0.6, max: minValue + range * 0.8 },
          danger: colorRanges.danger || { min: minValue + range * 0.8, max: maxValue }
        };
      }
      
      return {
        ...card,
        lastUpdated: card.lastUpdated ? new Date(card.lastUpdated) : new Date(),
        colorRanges: colorRanges || {
          low: { min: 0, max: 20 },
          normal: { min: 20, max: 60 },
          warning: { min: 60, max: 80 },
          danger: { min: 80, max: 100 }
        }
      };
    });
  } catch (error) {
    console.error('Error loading card configurations:', error);
    // 오류 발생 시 localStorage 클리어하고 기본값 반환
    localStorage.removeItem(STORAGE_KEY);
    return getDefaultCardConfigs();
  }
};

const getDefaultCardConfigs = (): SensorCardConfig[] => {
  const now = new Date();
  return [
    {
      id: 'temp-1',
      title: '온도',
      value: '0.0',
      unit: '°C',
      status: 'normal' as const,
      lastUpdated: now,
      position: { x: 25, y: 25 },
      size: { width: 275, height: 160 },
      dataSource: 'temperature',
      icon: '🌡️',
      displayType: 'number',
      minValue: 0,
      maxValue: 50,
      offset: 0,
      colorRanges: {
        low: { min: 0, max: 10 },
        normal: { min: 10, max: 30 },
        warning: { min: 30, max: 40 },
        danger: { min: 40, max: 50 }
      }
    },
    {
      id: 'humidity-1',
      title: '습도',
      value: '0.0',
      unit: '%',
      status: 'normal' as const,
      lastUpdated: now,
      position: { x: 325, y: 25 },
      size: { width: 275, height: 160 },
      dataSource: 'humidity',
      icon: '💧',
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
    },
    {
      id: 'soil-1',
      title: '토양 수분',
      value: '0.0',
      unit: '%',
      status: 'normal' as const,
      lastUpdated: now,
      position: { x: 25, y: 210 },
      size: { width: 275, height: 160 },
      dataSource: 'soilMoisture',
      icon: '🌱',
      displayType: 'number',
      minValue: 0,
      maxValue: 100,
      offset: 0,
      colorRanges: {
        low: { min: 0, max: 20 },
        normal: { min: 30, max: 70 },
        warning: { min: 20, max: 30 },
        danger: { min: 70, max: 100 }
      }
    },
    {
      id: 'light-1',
      title: '조도',
      value: '0',
      unit: 'lux',
      status: 'normal' as const,
      lastUpdated: now,
      position: { x: 325, y: 210 },
      size: { width: 275, height: 160 },
      dataSource: 'lightIntensity',
      icon: '☀️',
      displayType: 'number',
      minValue: 0,
      maxValue: 100000,
      offset: 0,
      colorRanges: {
        low: { min: 0, max: 100 },
        normal: { min: 200, max: 80000 },
        warning: { min: 100, max: 200 },
        danger: { min: 80000, max: 100000 }
      }
    }
  ];
};

export const clearCardConfigs = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing card configurations:', error);
  }
};

export type { SensorCardConfig };