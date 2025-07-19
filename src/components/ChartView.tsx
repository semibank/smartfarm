import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
// import { format } from 'date-fns';
import { dataHistoryManager, TIME_RANGES, type SensorDataPoint } from '../utils/dataHistory';
import { type SensorCardConfig } from '../utils/cardStorage';

interface ChartViewProps {
  cards: SensorCardConfig[];
}

const ChartView: React.FC<ChartViewProps> = ({ cards }) => {
  const [selectedTimeRange, setSelectedTimeRange] = useState(TIME_RANGES.HOUR);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [selectedChartType, setSelectedChartType] = useState<'line' | 'bar' | 'pie' | 'area' | 'statistics'>('line');
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5초마다 업데이트
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  // Y축 스케일링 설정
  const [yAxisSettings, setYAxisSettings] = useState({
    autoScale: true,
    manualMin: 0,
    manualMax: 100,
    padding: 0.1 // 10% 여백
  });

  // 시간 간격 설정
  const [timeInterval] = useState(1); // 1 = 모든 포인트, 5 = 5분 간격
  const [dataAveraging, setDataAveraging] = useState(1); // 1 = 평균 없음, 5 = 5분 평균
  const [averagingMethod, setAveragingMethod] = useState<'moving' | 'interval' | 'median'>('moving'); // 평균화 방식

  // 초기 카드 선택 (처음 4개)
  useEffect(() => {
    if (cards.length > 0 && selectedCards.length === 0) {
      setSelectedCards(cards.slice(0, 4).map(card => card.id));
    }
  }, [cards, selectedCards]);

  // 주기적 업데이트
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(Date.now());
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  // Y축 범위 계산
  const getYAxisDomain = (data: any[]) => {
    if (!yAxisSettings.autoScale) {
      return [yAxisSettings.manualMin, yAxisSettings.manualMax];
    }

    if (data.length === 0) {
      return [0, 100];
    }

    const allValues: number[] = [];
    selectedCards.forEach(cardId => {
      data.forEach(point => {
        if (point[cardId] !== null && point[cardId] !== undefined) {
          allValues.push(point[cardId]);
        }
      });
    });

    if (allValues.length === 0) {
      return [0, 100];
    }

    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    
    // 범위가 너무 작으면 최소 범위 보장
    const range = max - min;
    const minRange = Math.max(range, Math.abs(min + max) * 0.1, 10);
    
    // 패딩 적용
    const padding = minRange * yAxisSettings.padding;
    return [Math.max(0, min - padding), max + padding];
  };

  // 이동평균 계산 함수
  const getMovingAverage = (data: any[], windowSize: number) => {
    if (windowSize === 1 || data.length < windowSize) {
      return data;
    }

    return data.map((point, index) => {
      const avgPoint: any = {
        timestamp: point.timestamp,
        time: point.time,
        date: point.date
      };

      let hasAllData = true;
      selectedCards.forEach(cardId => {
        const startIdx = Math.max(0, index - Math.floor(windowSize / 2));
        const endIdx = Math.min(data.length, startIdx + windowSize);
        
        const values = data
          .slice(startIdx, endIdx)
          .map(p => p[cardId])
          .filter(v => v !== null && v !== undefined);
        
        if (values.length > 0) {
          avgPoint[cardId] = values.reduce((sum, val) => sum + val, 0) / values.length;
        } else {
          hasAllData = false;
        }
      });

      return hasAllData ? avgPoint : null;
    }).filter(point => point !== null);
  };

  // 구간평균 계산 함수 (기존 방식)
  const getIntervalAverage = (data: any[], intervalMinutes: number) => {
    if (intervalMinutes === 1) {
      return data;
    }

    const intervalMs = intervalMinutes * 60 * 1000; // 분을 밀리초로 변환
    const groupedData: { [key: string]: any[] } = {};
    
    data.forEach(point => {
      const groupKey = Math.floor(point.timestamp / intervalMs) * intervalMs;
      if (!groupedData[groupKey]) {
        groupedData[groupKey] = [];
      }
      groupedData[groupKey].push(point);
    });

    return Object.keys(groupedData).map(key => {
      const group = groupedData[key];
      const timestamp = parseInt(key);
      const avgPoint: any = {
        timestamp,
        time: new Date(timestamp).toLocaleTimeString(),
        date: new Date(timestamp).toLocaleString()
      };

      let hasAllData = true;
      selectedCards.forEach(cardId => {
        const values = group
          .map(p => p[cardId])
          .filter(v => v !== null && v !== undefined);
        
        if (values.length > 0) {
          avgPoint[cardId] = values.reduce((sum, val) => sum + val, 0) / values.length;
        } else {
          hasAllData = false;
        }
      });

      return hasAllData ? avgPoint : null;
    }).filter(point => point !== null).sort((a, b) => a.timestamp - b.timestamp);
  };

  // 중앙값 계산 함수
  const getMedianData = (data: any[], intervalMinutes: number) => {
    if (intervalMinutes === 1) {
      return data;
    }

    const intervalMs = intervalMinutes * 60 * 1000;
    const groupedData: { [key: string]: any[] } = {};
    
    data.forEach(point => {
      const groupKey = Math.floor(point.timestamp / intervalMs) * intervalMs;
      if (!groupedData[groupKey]) {
        groupedData[groupKey] = [];
      }
      groupedData[groupKey].push(point);
    });

    return Object.keys(groupedData).map(key => {
      const group = groupedData[key];
      const timestamp = parseInt(key);
      const medianPoint: any = {
        timestamp,
        time: new Date(timestamp).toLocaleTimeString(),
        date: new Date(timestamp).toLocaleString()
      };

      let hasAllData = true;
      selectedCards.forEach(cardId => {
        const values = group
          .map(p => p[cardId])
          .filter(v => v !== null && v !== undefined)
          .sort((a, b) => a - b);
        
        if (values.length > 0) {
          const mid = Math.floor(values.length / 2);
          medianPoint[cardId] = values.length % 2 === 0
            ? (values[mid - 1] + values[mid]) / 2
            : values[mid];
        } else {
          hasAllData = false;
        }
      });

      return hasAllData ? medianPoint : null;
    }).filter(point => point !== null).sort((a, b) => a.timestamp - b.timestamp);
  };

  // 데이터 평균화 함수 (통합)
  const getAveragedData = (data: any[]) => {
    if (dataAveraging === 1) {
      return data;
    }

    switch (averagingMethod) {
      case 'moving':
        // 이동평균: 시간 간격을 윈도우 크기로 변환 (5분 = 5개 포인트)
        return getMovingAverage(data, dataAveraging);
      case 'interval':
        return getIntervalAverage(data, dataAveraging);
      case 'median':
        return getMedianData(data, dataAveraging);
      default:
        return data;
    }
  };

  // 차트 데이터 준비
  const getChartData = () => {
    const history = dataHistoryManager.getAllHistory(selectedTimeRange);
    
    // 선택된 카드들의 데이터만 필터링
    const filteredHistory: { [key: string]: SensorDataPoint[] } = {};
    selectedCards.forEach(cardId => {
      if (history[cardId]) {
        filteredHistory[cardId] = history[cardId];
      }
    });

    // 각 센서별로 데이터 포인트를 생성한 후 병합
    const dataPointsMap = new Map<number, any>();

    selectedCards.forEach(cardId => {
      const cardHistory = filteredHistory[cardId] || [];
      
      cardHistory.forEach(point => {
        const timestamp = point.timestamp;
        
        // 해당 타임스탬프의 데이터 포인트가 없으면 생성
        if (!dataPointsMap.has(timestamp)) {
          dataPointsMap.set(timestamp, {
            timestamp,
            time: new Date(timestamp).toLocaleTimeString(),
            date: new Date(timestamp).toLocaleString()
          });
        }
        
        const dataPoint = dataPointsMap.get(timestamp);
        dataPoint[cardId] = point.value; // 실제 데이터 값 (0 포함)
        dataPoint[`${cardId}_status`] = point.status;
      });
    });

    // 타임스탬프 순으로 정렬
    const sortedData = Array.from(dataPointsMap.values()).sort((a, b) => a.timestamp - b.timestamp);
    
    // 모든 선택된 센서에 데이터가 있는 포인트만 필터링
    const filteredData = sortedData.filter(point => {
      return selectedCards.every(cardId => 
        point[cardId] !== undefined && point[cardId] !== null
      );
    });
    
    // 데이터 평균화 적용
    return getAveragedData(filteredData);
  };

  // 통계 데이터 준비
  const getStatisticsData = () => {
    return selectedCards.map(cardId => {
      const card = cards.find(c => c.id === cardId);
      const stats = dataHistoryManager.getStatistics(cardId, selectedTimeRange);
      
      return {
        cardId,
        title: card?.title || cardId,
        unit: card?.unit || '',
        ...stats
      };
    });
  };

  // 상태 분포 데이터
  const getStatusDistributionData = () => {
    const distribution = dataHistoryManager.getStatusDistribution(selectedTimeRange);
    
    return [
      { name: '낮음', value: distribution.low, color: '#2196f3' },
      { name: '정상', value: distribution.normal, color: '#4caf50' },
      { name: '주의', value: distribution.warning, color: '#ff9800' },
      { name: '위험', value: distribution.danger, color: '#f44336' }
    ].filter(item => item.value > 0);
  };

  // 차트 색상 가져오기
  const getCardColor = (cardId: string) => {
    const colors = ['#2196f3', '#4caf50', '#ff9800', '#f44336', '#9c27b0', '#00bcd4', '#795548', '#607d8b'];
    const index = selectedCards.indexOf(cardId);
    return colors[index % colors.length];
  };

  // 라인 차트 렌더링
  const renderLineChart = () => {
    const data = getChartData();
    const yAxisDomain = getYAxisDomain(data);

    return (
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 12 }}
            interval={timeInterval === 1 ? "preserveStartEnd" : Math.floor(data.length / 10) || 1}
          />
          <YAxis 
            tick={{ fontSize: 12 }} 
            domain={yAxisDomain}
            tickFormatter={(value) => Number(value).toFixed(1)}
          />
          <Tooltip 
            labelFormatter={(label) => `시간: ${label}`}
            formatter={(value: any, name: string) => {
              const card = cards.find(c => c.id === name);
              return [`${Number(value).toFixed(2)}${card?.unit || ''}`, card?.title || name];
            }}
          />
          <Legend />
          {selectedCards.map(cardId => {
            const card = cards.find(c => c.id === cardId);
            return (
              <Line
                key={cardId}
                type="monotone"
                dataKey={cardId}
                stroke={getCardColor(cardId)}
                strokeWidth={2}
                dot={{ r: 3, fill: getCardColor(cardId) }}
                activeDot={{ r: 5, fill: getCardColor(cardId) }}
                name={card?.title || cardId}
                connectNulls={false}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    );
  };

  // 바 차트 렌더링
  const renderBarChart = () => {
    const stats = getStatisticsData();

    return (
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={stats}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="title" 
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip 
            formatter={(value: any, name: string) => [`${value}`, name]}
          />
          <Legend />
          <Bar dataKey="average" fill="#2196f3" name="평균" />
          <Bar dataKey="max" fill="#f44336" name="최대" />
          <Bar dataKey="min" fill="#4caf50" name="최소" />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  // 파이 차트 렌더링
  const renderPieChart = () => {
    const data = getStatusDistributionData();

    return (
      <ResponsiveContainer width="100%" height={400}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
            outerRadius={120}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  // 에어리어 차트 렌더링
  const renderAreaChart = () => {
    const data = getChartData();
    const yAxisDomain = getYAxisDomain(data);

    return (
      <ResponsiveContainer width="100%" height={400}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 12 }}
            interval={timeInterval === 1 ? "preserveStartEnd" : Math.floor(data.length / 10) || 1}
          />
          <YAxis 
            tick={{ fontSize: 12 }} 
            domain={yAxisDomain}
            tickFormatter={(value) => Number(value).toFixed(1)}
          />
          <Tooltip 
            labelFormatter={(label) => `시간: ${label}`}
            formatter={(value: any, name: string) => {
              const card = cards.find(c => c.id === name);
              return [`${Number(value).toFixed(2)}${card?.unit || ''}`, card?.title || name];
            }}
          />
          <Legend />
          {selectedCards.map((cardId) => {
            const card = cards.find(c => c.id === cardId);
            return (
              <Area
                key={cardId}
                type="monotone"
                dataKey={cardId}
                stackId="1"
                stroke={getCardColor(cardId)}
                fill={getCardColor(cardId)}
                fillOpacity={0.3}
                name={card?.title || cardId}
                connectNulls={false}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    );
  };

  // 통계 테이블 렌더링
  const renderStatistics = () => {
    const stats = getStatisticsData();

    return (
      <div style={{ padding: '20px' }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '20px' 
        }}>
          {stats.map(stat => (
            <div key={stat.cardId} style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              border: '1px solid #e0e0e0'
            }}>
              <h3 style={{ 
                margin: '0 0 16px 0', 
                color: '#2c3e50',
                fontSize: '18px',
                fontWeight: '600'
              }}>
                {stat.title}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '12px', color: '#666' }}>현재값</span>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2196f3' }}>
                    {stat.latest.toFixed(1)}{stat.unit}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: '#666' }}>평균</span>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4caf50' }}>
                    {stat.average.toFixed(1)}{stat.unit}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: '#666' }}>최대값</span>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#f44336' }}>
                    {stat.max.toFixed(1)}{stat.unit}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: '#666' }}>최소값</span>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#ff9800' }}>
                    {stat.min.toFixed(1)}{stat.unit}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: '12px', fontSize: '12px', color: '#666' }}>
                데이터 포인트: {stat.count}개
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      {/* 제어 패널 */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '20px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ margin: '0 0 20px 0', color: '#2c3e50' }}>📊 센서 데이터 분석</h2>
        
        {/* 시간 범위 선택 */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', alignItems: 'center' }}>
          <label style={{ fontWeight: '600', color: '#2c3e50' }}>시간 범위:</label>
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(Number(e.target.value))}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #ddd',
              fontSize: '14px'
            }}
          >
            <option value={TIME_RANGES.HOUR}>1시간</option>
            <option value={TIME_RANGES.DAY}>1일</option>
            <option value={TIME_RANGES.WEEK}>1주일</option>
            <option value={TIME_RANGES.MONTH}>1개월</option>
          </select>
        </div>

        {/* 차트 타입 선택 */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontWeight: '600', color: '#2c3e50' }}>차트 유형:</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { value: 'line', label: '📈 라인', icon: '📈' },
              { value: 'area', label: '📊 에어리어', icon: '📊' },
              { value: 'bar', label: '📊 바', icon: '📊' },
              { value: 'pie', label: '🥧 파이', icon: '🥧' },
              { value: 'statistics', label: '📋 통계', icon: '📋' }
            ].map(chart => (
              <button
                key={chart.value}
                onClick={() => setSelectedChartType(chart.value as any)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: selectedChartType === chart.value ? '2px solid #2196f3' : '1px solid #ddd',
                  backgroundColor: selectedChartType === chart.value ? '#e3f2fd' : 'white',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '500'
                }}
              >
                {chart.label}
              </button>
            ))}
          </div>
        </div>

        {/* Y축 및 데이터 설정 */}
        {(selectedChartType === 'line' || selectedChartType === 'area') && (
          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label style={{ fontWeight: '600', color: '#2c3e50' }}>Y축:</label>
              <button
                onClick={() => setYAxisSettings({...yAxisSettings, autoScale: !yAxisSettings.autoScale})}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: yAxisSettings.autoScale ? '2px solid #4caf50' : '1px solid #ddd',
                  backgroundColor: yAxisSettings.autoScale ? '#e8f5e8' : 'white',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '500'
                }}
              >
                {yAxisSettings.autoScale ? '🎯 자동 스케일' : '📐 수동 설정'}
              </button>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label style={{ fontWeight: '600', color: '#2c3e50' }}>평균화:</label>
              <select
                value={averagingMethod}
                onChange={(e) => setAveragingMethod(e.target.value as 'moving' | 'interval' | 'median')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  fontSize: '12px'
                }}
              >
                <option value="moving">🌊 이동평균</option>
                <option value="interval">📊 구간평균</option>
                <option value="median">🎯 중앙값</option>
              </select>
              
              <select
                value={dataAveraging}
                onChange={(e) => setDataAveraging(Number(e.target.value))}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  fontSize: '12px'
                }}
              >
                <option value={1}>실시간 (평균 없음)</option>
                <option value={2}>2분 {averagingMethod === 'moving' ? '이동' : averagingMethod === 'median' ? '중앙값' : '구간'}</option>
                <option value={5}>5분 {averagingMethod === 'moving' ? '이동' : averagingMethod === 'median' ? '중앙값' : '구간'}</option>
                <option value={10}>10분 {averagingMethod === 'moving' ? '이동' : averagingMethod === 'median' ? '중앙값' : '구간'}</option>
                <option value={30}>30분 {averagingMethod === 'moving' ? '이동' : averagingMethod === 'median' ? '중앙값' : '구간'}</option>
                <option value={60}>1시간 {averagingMethod === 'moving' ? '이동' : averagingMethod === 'median' ? '중앙값' : '구간'}</option>
              </select>
            </div>
            
            {!yAxisSettings.autoScale && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <label style={{ fontWeight: '600', color: '#2c3e50' }}>범위:</label>
                <input
                  type="number"
                  value={yAxisSettings.manualMin}
                  onChange={(e) => setYAxisSettings({...yAxisSettings, manualMin: Number(e.target.value)})}
                  style={{
                    width: '60px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    fontSize: '12px'
                  }}
                  placeholder="최소"
                />
                <span style={{ color: '#666' }}>~</span>
                <input
                  type="number"
                  value={yAxisSettings.manualMax}
                  onChange={(e) => setYAxisSettings({...yAxisSettings, manualMax: Number(e.target.value)})}
                  style={{
                    width: '60px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    fontSize: '12px'
                  }}
                  placeholder="최대"
                />
              </div>
            )}
          </div>
        )}

        {/* 센서 카드 선택 */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontWeight: '600', color: '#2c3e50', display: 'block', marginBottom: '8px' }}>
            센서 선택:
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {cards.map(card => (
              <label key={card.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #ddd',
                backgroundColor: selectedCards.includes(card.id) ? '#e3f2fd' : 'white',
                cursor: 'pointer',
                fontSize: '14px'
              }}>
                <input
                  type="checkbox"
                  checked={selectedCards.includes(card.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedCards([...selectedCards, card.id]);
                    } else {
                      setSelectedCards(selectedCards.filter(id => id !== card.id));
                    }
                  }}
                  style={{ margin: 0 }}
                />
                <span>{card.icon}</span>
                <span>{card.title}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 새로고침 간격 설정 및 데이터 초기화 */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ fontWeight: '600', color: '#2c3e50' }}>새로고침 간격:</label>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #ddd',
                fontSize: '14px'
              }}
            >
              <option value={1000}>1초</option>
              <option value={5000}>5초</option>
              <option value={10000}>10초</option>
              <option value={30000}>30초</option>
              <option value={60000}>1분</option>
            </select>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => {
                if (confirm('모든 센서 데이터 히스토리를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
                  dataHistoryManager.clearHistory();
                  setLastUpdate(Date.now());
                  alert('센서 데이터 히스토리가 초기화되었습니다.');
                }
              }}
              style={{
                padding: '8px 12px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#d32f2f'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f44336'}
            >
              🗑️ 전체 데이터 초기화
            </button>
            
            <button
              onClick={() => {
                const selectedCardNames = selectedCards.map(cardId => {
                  const card = cards.find(c => c.id === cardId);
                  return card?.title || cardId;
                }).join(', ');
                
                if (selectedCards.length === 0) {
                  alert('초기화할 센서를 선택해주세요.');
                  return;
                }
                
                if (confirm(`선택된 센서 데이터를 초기화하시겠습니까?\n대상: ${selectedCardNames}\n이 작업은 되돌릴 수 없습니다.`)) {
                  selectedCards.forEach(cardId => {
                    dataHistoryManager.clearCardHistory(cardId);
                  });
                  setLastUpdate(Date.now());
                  alert('선택된 센서 데이터가 초기화되었습니다.');
                }
              }}
              style={{
                padding: '8px 12px',
                backgroundColor: '#ff9800',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f57c00'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ff9800'}
            >
              🧹 선택된 센서 초기화
            </button>
          </div>
          
          <span style={{ fontSize: '12px', color: '#666' }}>
            마지막 업데이트: {new Date(lastUpdate).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* 차트 영역 */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        {selectedCards.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            color: '#666', 
            padding: '40px',
            fontSize: '16px'
          }}>
            📊 분석할 센서를 선택해주세요
          </div>
        ) : (
          <>
            {selectedChartType === 'line' && renderLineChart()}
            {selectedChartType === 'area' && renderAreaChart()}
            {selectedChartType === 'bar' && renderBarChart()}
            {selectedChartType === 'pie' && renderPieChart()}
            {selectedChartType === 'statistics' && renderStatistics()}
          </>
        )}
      </div>
    </div>
  );
};

export default ChartView;