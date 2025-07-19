// 센서 데이터 히스토리 관리
interface SensorDataPoint {
  timestamp: number;
  value: number;
  status: 'low' | 'normal' | 'warning' | 'danger';
  cardId: string;
  cardTitle: string;
  unit: string;
}

interface SensorHistory {
  [cardId: string]: SensorDataPoint[];
}

const STORAGE_KEY = 'smartfarm-sensor-history';
const MAX_HISTORY_POINTS = 1000; // 최대 1000개 포인트 저장

class DataHistoryManager {
  private history: SensorHistory = {};
  private maxPoints = MAX_HISTORY_POINTS;

  constructor() {
    this.loadHistory();
  }

  // 새로운 데이터 포인트 추가 (검증 강화)
  addDataPoint(cardId: string, value: number, status: 'low' | 'normal' | 'warning' | 'danger', cardTitle: string, unit: string) {
    // 유효성 검증
    if (!cardId || typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
      console.warn('Invalid data point rejected:', { cardId, value, status, cardTitle, unit });
      return;
    }

    // 센서별 현실적인 범위 검증
    const isValidValue = this.isValidSensorValue(cardId, value, cardTitle);
    if (!isValidValue) {
      console.warn('Sensor value out of realistic range rejected:', { cardId, value, cardTitle });
      return;
    }

    const timestamp = Date.now();
    const dataPoint: SensorDataPoint = {
      timestamp,
      value,
      status,
      cardId,
      cardTitle,
      unit
    };

    if (!this.history[cardId]) {
      this.history[cardId] = [];
    }

    this.history[cardId].push(dataPoint);

    // 최대 포인트 수 제한
    if (this.history[cardId].length > this.maxPoints) {
      this.history[cardId] = this.history[cardId].slice(-this.maxPoints);
    }

    this.saveHistory();
  }

  // 센서별 현실적인 값 범위 검증
  private isValidSensorValue(cardId: string, value: number, cardTitle: string): boolean {
    const titleLower = cardTitle.toLowerCase();
    
    // 온도 센서
    if (titleLower.includes('온도') || titleLower.includes('temp') || cardId.includes('temperature')) {
      return value >= -50 && value <= 80 && value !== 0;
    }
    
    // 습도 센서
    if (titleLower.includes('습도') || titleLower.includes('humid') || cardId.includes('humidity')) {
      return value > 0 && value <= 100;
    }
    
    // 토양수분 센서
    if (titleLower.includes('토양') || titleLower.includes('수분') || titleLower.includes('soil') || titleLower.includes('moisture')) {
      return value > 0 && value <= 100;
    }
    
    // 조도 센서
    if (titleLower.includes('조도') || titleLower.includes('광량') || titleLower.includes('light') || titleLower.includes('lux')) {
      return value >= 0 && value <= 200000; // 일반적인 조도 범위
    }
    
    // CO2 센서
    if (titleLower.includes('co2') || titleLower.includes('이산화탄소')) {
      return value >= 300 && value <= 5000; // 일반적인 CO2 범위 (ppm)
    }
    
    // 기타 센서는 0이 아닌 합리적인 값
    return value !== 0 && value >= -1000000 && value <= 1000000;
  }

  // 특정 카드의 히스토리 가져오기
  getCardHistory(cardId: string, timeRange?: number): SensorDataPoint[] {
    const cardHistory = this.history[cardId] || [];
    
    if (!timeRange) {
      return cardHistory;
    }

    const cutoffTime = Date.now() - timeRange;
    return cardHistory.filter(point => point.timestamp >= cutoffTime);
  }

  // 모든 카드의 히스토리 가져오기
  getAllHistory(timeRange?: number): SensorHistory {
    if (!timeRange) {
      return this.history;
    }

    const cutoffTime = Date.now() - timeRange;
    const filteredHistory: SensorHistory = {};

    Object.keys(this.history).forEach(cardId => {
      filteredHistory[cardId] = this.history[cardId].filter(
        point => point.timestamp >= cutoffTime
      );
    });

    return filteredHistory;
  }

  // 특정 시간 범위의 통계 계산
  getStatistics(cardId: string, timeRange: number) {
    const data = this.getCardHistory(cardId, timeRange);
    
    if (data.length === 0) {
      return {
        min: 0,
        max: 0,
        average: 0,
        latest: 0,
        count: 0
      };
    }

    const values = data.map(point => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
    const latest = values[values.length - 1];

    return {
      min,
      max,
      average,
      latest,
      count: data.length
    };
  }

  // 상태별 분포 계산
  getStatusDistribution(timeRange: number) {
    const allHistory = this.getAllHistory(timeRange);
    const statusCount = {
      low: 0,
      normal: 0,
      warning: 0,
      danger: 0
    };

    Object.values(allHistory).forEach(cardHistory => {
      cardHistory.forEach(point => {
        statusCount[point.status]++;
      });
    });

    return statusCount;
  }

  // 히스토리 저장 (디바운싱 적용)
  private saveTimeout?: NodeJS.Timeout;
  
  private saveHistory() {
    // 기존 타이머 취소
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    // 1초 후에 저장 (디바운싱)
    this.saveTimeout = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history));
      } catch (error) {
        console.error('Error saving data history:', error);
      }
    }, 1000);
  }

  // 히스토리 로드
  private loadHistory() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.history = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading data history:', error);
      this.history = {};
    }
  }

  // 히스토리 클리어
  clearHistory() {
    this.history = {};
    localStorage.removeItem(STORAGE_KEY);
  }

  // 특정 카드 히스토리 삭제
  clearCardHistory(cardId: string) {
    delete this.history[cardId];
    this.saveHistory();
  }
}

// 시간 범위 상수
export const TIME_RANGES = {
  HOUR: 60 * 60 * 1000,      // 1시간
  DAY: 24 * 60 * 60 * 1000,  // 1일
  WEEK: 7 * 24 * 60 * 60 * 1000, // 1주일
  MONTH: 30 * 24 * 60 * 60 * 1000 // 1개월
};

// 싱글톤 인스턴스
export const dataHistoryManager = new DataHistoryManager();

export type { SensorDataPoint, SensorHistory };