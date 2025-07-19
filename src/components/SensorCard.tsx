import React, { useState, useRef } from 'react';

interface SensorCardProps {
  id: string;
  title: string;
  value: string | number;
  unit?: string;
  status?: 'low' | 'normal' | 'warning' | 'danger';
  lastUpdated?: Date;
  icon?: string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  onEdit?: (id: string, updates: Partial<SensorCardProps>) => void;
  onDelete?: (id: string) => void;
  onMove?: (id: string, position: { x: number; y: number }) => void;
  onResize?: (id: string, size: { width: number; height: number }) => void;
  isEditing?: boolean;
  onEditTopic?: (id: string) => void;
  onEditIcon?: (id: string) => void;
  editingCardId?: string | null;
  displayType?: 'number' | 'gauge' | 'bar' | 'hybrid' | 'minichart' | 'target' | 'segment' | 'wave' | 'sparkline' | 'donut' | 'digital' | 'gradient';
  minValue?: number;
  maxValue?: number;
  onEditDisplay?: (id: string) => void;
  offset?: number;
  colorRanges?: {
    low: { min: number; max: number };
    normal: { min: number; max: number };
    warning: { min: number; max: number };
    danger: { min: number; max: number };
  };
  // 계산 카드 관련 props
  calculationType?: 'average' | 'sum' | 'difference' | 'max' | 'min' | 'ratio';
  sourceCards?: string[];
  isCalculated?: boolean;
  allCards?: any[]; // 모든 카드 데이터 (계산용)
}

const SensorCard: React.FC<SensorCardProps> = ({ 
  id,
  title, 
  value, 
  unit, 
  status = 'normal', 
  lastUpdated,
  icon,
  position = { x: 0, y: 0 },
  size = { width: 280, height: 160 },
  onEdit,
  onDelete,
  onMove,
  onResize,
  isEditing = false,
  onEditTopic,
  onEditIcon,
  editingCardId,
  displayType = 'number',
  minValue = 0,
  maxValue = 100,
  onEditDisplay,
  offset = 0,
  colorRanges = {
    low: { min: 0, max: 20 },
    normal: { min: 20, max: 60 },
    warning: { min: 60, max: 80 },
    danger: { min: 80, max: 100 }
  },
  calculationType,
  sourceCards = [],
  isCalculated = false,
  allCards = []
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [editableTitle, setEditableTitle] = useState(title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const getStatusColor = () => {
    switch (status) {
      case 'low':
        return '#2196f3';
      case 'warning':
        return '#ff9800';
      case 'danger':
        return '#f44336';
      default:
        return '#4caf50';
    }
  };

  const getStatusBackground = () => {
    switch (status) {
      case 'low':
        return 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)';
      case 'warning':
        return 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)';
      case 'danger':
        return 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)';
      default:
        return 'linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%)';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString();
  };


  const getProgressColor = () => {
    // 실제 센서값으로 색상 결정 (퍼센티지 대신)
    const actualValue = calibratedValue;
    
    // colorRanges가 undefined이거나 incomplete한 경우 방어
    if (!colorRanges || !colorRanges.low || !colorRanges.normal || !colorRanges.warning || !colorRanges.danger) {
      return '#4caf50'; // 기본 녹색
    }
    
    // 위험 범위 확인 (우선순위 1순위)
    if (actualValue >= colorRanges.danger.min && actualValue <= colorRanges.danger.max) {
      return '#f44336'; // 빨간색
    }
    
    // 주의 범위 확인 (우선순위 2순위)
    if (actualValue >= colorRanges.warning.min && actualValue <= colorRanges.warning.max) {
      return '#ff9800'; // 주황색
    }
    
    // 정상 범위 확인 (우선순위 3순위)
    if (actualValue >= colorRanges.normal.min && actualValue <= colorRanges.normal.max) {
      return '#4caf50'; // 녹색
    }
    
    // 낮음 범위 확인 (우선순위 4순위)
    if (actualValue >= colorRanges.low.min && actualValue <= colorRanges.low.max) {
      return '#2196f3'; // 파란색
    }
    
    // 어떤 범위에도 속하지 않는 경우, 가장 가까운 범위의 색상 사용
    const ranges = [
      { ...colorRanges.low, color: '#2196f3' },
      { ...colorRanges.normal, color: '#4caf50' },
      { ...colorRanges.warning, color: '#ff9800' },
      { ...colorRanges.danger, color: '#f44336' }
    ];
    
    let closestRange = ranges[0];
    let minDistance = Infinity;
    
    ranges.forEach(range => {
      const distance = Math.min(
        Math.abs(actualValue - range.min),
        Math.abs(actualValue - range.max)
      );
      if (distance < minDistance) {
        minDistance = distance;
        closestRange = range;
      }
    });
    
    return closestRange.color;
  };

  // 계산 카드 로직
  const calculateValue = (): number => {
    if (!isCalculated || !sourceCards || sourceCards.length === 0) {
      return parseFloat(value.toString()) || 0;
    }

    const sourceValues = sourceCards.map(cardId => {
      const sourceCard = allCards.find(card => card.id === cardId);
      if (!sourceCard) return 0;
      
      const sourceValue = parseFloat(sourceCard.value.toString()) || 0;
      const sourceOffset = sourceCard.offset || 0;
      return sourceValue + sourceOffset;
    }).filter(val => !isNaN(val));

    if (sourceValues.length === 0) return 0;

    switch (calculationType) {
      case 'average':
        return sourceValues.reduce((sum, val) => sum + val, 0) / sourceValues.length;
      case 'sum':
        return sourceValues.reduce((sum, val) => sum + val, 0);
      case 'difference':
        return sourceValues.length >= 2 ? Math.abs(sourceValues[0] - sourceValues[1]) : 0;
      case 'max':
        return Math.max(...sourceValues);
      case 'min':
        return Math.min(...sourceValues);
      case 'ratio':
        return sourceValues.length >= 2 && sourceValues[1] !== 0 ? 
          (sourceValues[0] / sourceValues[1]) * 100 : 0;
      default:
        return sourceValues[0] || 0;
    }
  };

  const rawValue = calculateValue();
  const calibratedValue = rawValue + offset;
  const percentage = Math.max(((calibratedValue - minValue) / (maxValue - minValue)) * 100, 0);

  const renderGauge = () => {
    const radius = 35;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = circumference;
    const displayPercentage = Math.min(percentage, 100);
    const strokeDashoffset = circumference - (displayPercentage / 100) * circumference;
    const color = getProgressColor();

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ position: 'relative', width: '80px', height: '80px' }}>
          <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
            <circle
              cx="40"
              cy="40"
              r={radius}
              fill="none"
              stroke="#e0e0e0"
              strokeWidth="6"
            />
            <circle
              cx="40"
              cy="40"
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="6"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: 'stroke-dashoffset 0.3s ease' }}
            />
          </svg>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '18px',
            fontWeight: 'bold',
            color: color
          }}>
            {Math.round(percentage)}%{percentage > 100 ? ' ⚠️' : ''}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: color }}>
            {calibratedValue.toFixed(1)}
          </div>
          {unit && <div style={{ fontSize: '14px', color: '#666' }}>{unit}</div>}
        </div>
      </div>
    );
  };

  const renderBar = () => {
    const color = getProgressColor();
    return (
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '24px', fontWeight: 'bold', color: color }}>
            {calibratedValue.toFixed(1)} {unit}
          </span>
          <span style={{ fontSize: '14px', color: '#666' }}>
            {Math.round(percentage)}%{percentage > 100 ? ' ⚠️' : ''}
          </span>
        </div>
        <div style={{
          width: '100%',
          height: '12px',
          backgroundColor: '#e0e0e0',
          borderRadius: '6px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${Math.min(percentage, 100)}%`,
            height: '100%',
            backgroundColor: color,
            borderRadius: '6px',
            transition: 'width 0.3s ease'
          }} />
        </div>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          fontSize: '12px', 
          color: '#999', 
          marginTop: '4px' 
        }}>
          <span>{minValue}</span>
          <span>{maxValue}</span>
        </div>
      </div>
    );
  };

  const renderHybrid = () => {
    const color = getProgressColor();
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: color }}>
            {calibratedValue.toFixed(1)}
          </div>
          {unit && <div style={{ fontSize: '16px', color: '#666' }}>{unit}</div>}
        </div>
        <div style={{
          width: '100%',
          height: '8px',
          backgroundColor: '#e0e0e0',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${Math.min(percentage, 100)}%`,
            height: '100%',
            backgroundColor: color,
            borderRadius: '4px',
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>
    );
  };

  const renderMiniChart = () => {
    const color = getProgressColor();
    // 가상의 히스토리 데이터 생성 (실제로는 props로 받아야 함)
    const history = Array.from({ length: 12 }, (_, i) => {
      const baseValue = calibratedValue;
      const variation = (Math.sin(i * 0.5) * 5) + (Math.random() * 3 - 1.5);
      return Math.max(0, baseValue + variation);
    });
    
    const maxHistoryValue = Math.max(...history);
    const minHistoryValue = Math.min(...history);
    const range = maxHistoryValue - minHistoryValue || 1;
    
    return (
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '28px', fontWeight: 'bold', color: color }}>
            {calibratedValue.toFixed(1)} {unit}
          </span>
          <span style={{ fontSize: '12px', color: '#666', display: 'flex', alignItems: 'center' }}>
            {calibratedValue > (history[history.length - 2] || 0) ? '↗️' : '↘️'}
            {Math.abs(calibratedValue - (history[history.length - 2] || 0)).toFixed(1)}
          </span>
        </div>
        <div style={{ height: '40px', display: 'flex', alignItems: 'end', gap: '2px' }}>
          {history.map((value, index) => {
            const height = ((value - minHistoryValue) / range) * 40;
            return (
              <div
                key={index}
                style={{
                  width: '15px',
                  height: `${height}px`,
                  backgroundColor: index === history.length - 1 ? color : '#e0e0e0',
                  borderRadius: '2px',
                  opacity: index === history.length - 1 ? 1 : 0.7,
                  transition: 'all 0.3s ease'
                }}
              />
            );
          })}
        </div>
      </div>
    );
  };

  const renderTarget = () => {
    const color = getProgressColor();
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (Math.min(percentage, 100) / 100) * circumference;
    
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ position: 'relative', width: '100px', height: '100px' }}>
          <svg width="100" height="100" style={{ transform: 'rotate(-90deg)' }}>
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="#f0f0f0"
              strokeWidth="8"
            />
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: color }}>
              {calibratedValue.toFixed(1)}
            </div>
            <div style={{ fontSize: '10px', color: '#666' }}>{unit}</div>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
            Target: {maxValue}
          </div>
          <div style={{ fontSize: '14px', fontWeight: '500', color: color }}>
            {percentage.toFixed(1)}% 달성{percentage > 100 ? ' ⚠️' : ''}
          </div>
        </div>
      </div>
    );
  };

  const renderSegment = () => {
    // colorRanges 방어 코드
    if (!colorRanges || !colorRanges.low || !colorRanges.normal || !colorRanges.warning || !colorRanges.danger) {
      return <div style={{ color: '#666' }}>컬러 범위 설정 오류</div>;
    }
    
    const segments = [
      { value: colorRanges.low.max, color: '#2196f3', label: '낮음' },
      { value: colorRanges.normal.max, color: '#4caf50', label: '정상' },
      { value: colorRanges.warning.max, color: '#ff9800', label: '주의' },
      { value: colorRanges.danger.max, color: '#f44336', label: '위험' }
    ];
    
    const totalRange = maxValue - minValue;
    
    return (
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '24px', fontWeight: 'bold', color: getProgressColor() }}>
            {calibratedValue.toFixed(1)} {unit}
          </span>
          <span style={{ fontSize: '12px', color: '#666' }}>
            {Math.round(percentage)}%{percentage > 100 ? ' ⚠️' : ''}
          </span>
        </div>
        <div style={{ display: 'flex', height: '20px', borderRadius: '10px', overflow: 'hidden' }}>
          {segments.map((segment, index) => {
            const segmentWidth = ((segment.value - (index === 0 ? minValue : segments[index - 1].value)) / totalRange) * 100;
            const isActive = calibratedValue >= (index === 0 ? minValue : segments[index - 1].value) && calibratedValue <= segment.value;
            
            return (
              <div
                key={index}
                style={{
                  width: `${segmentWidth}%`,
                  backgroundColor: segment.color,
                  opacity: isActive ? 1 : 0.3,
                  transition: 'opacity 0.3s ease',
                  position: 'relative'
                }}
              />
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#999', marginTop: '4px' }}>
          <span>{minValue}</span>
          <span>{maxValue}</span>
        </div>
      </div>
    );
  };

  const renderWave = () => {
    const color = getProgressColor();
    const waveHeight = (Math.min(percentage, 100) / 100) * 60;
    
    return (
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '24px', fontWeight: 'bold', color: color }}>
            {calibratedValue.toFixed(1)} {unit}
          </span>
          <span style={{ fontSize: '12px', color: '#666' }}>
            {Math.round(percentage)}%{percentage > 100 ? ' ⚠️' : ''}
          </span>
        </div>
        <div style={{
          width: '100%',
          height: '60px',
          backgroundColor: '#f0f0f0',
          borderRadius: '8px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: `${waveHeight}px`,
            background: `linear-gradient(180deg, ${color}40 0%, ${color} 100%)`,
            transition: 'height 0.5s ease',
            borderRadius: '0 0 8px 8px'
          }} />
          <div style={{
            position: 'absolute',
            bottom: `${waveHeight - 10}px`,
            left: 0,
            right: 0,
            height: '20px',
            background: `linear-gradient(90deg, ${color}00 0%, ${color}80 50%, ${color}00 100%)`,
            animation: 'wave 2s ease-in-out infinite',
            transform: 'translateY(50%)'
          }} />
        </div>
      </div>
    );
  };

  const renderSparkline = () => {
    const color = getProgressColor();
    const history = Array.from({ length: 20 }, (_, i) => {
      const baseValue = calibratedValue;
      const variation = (Math.sin(i * 0.3) * 3) + (Math.random() * 2 - 1);
      return Math.max(0, baseValue + variation);
    });
    
    const maxHistoryValue = Math.max(...history);
    const minHistoryValue = Math.min(...history);
    const range = maxHistoryValue - minHistoryValue || 1;
    
    const pathData = history.map((value, index) => {
      const x = (index / (history.length - 1)) * 150;
      const y = 30 - ((value - minHistoryValue) / range) * 30;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
    
    return (
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '28px', fontWeight: 'bold', color: color }}>
            {calibratedValue.toFixed(1)}
          </span>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: '#666' }}>{unit}</div>
            <div style={{ fontSize: '12px', color: color, display: 'flex', alignItems: 'center' }}>
              {calibratedValue > (history[history.length - 2] || 0) ? '↗️' : '↘️'}
              {Math.abs(calibratedValue - (history[history.length - 2] || 0)).toFixed(1)}
            </div>
          </div>
        </div>
        <svg width="100%" height="30" style={{ marginBottom: '8px' }}>
          <path
            d={pathData}
            fill="none"
            stroke={color}
            strokeWidth="2"
            style={{ transition: 'stroke 0.3s ease' }}
          />
        </svg>
      </div>
    );
  };

  const renderDonut = () => {
    const color = getProgressColor();
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (Math.min(percentage, 100) / 100) * circumference;
    
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
        <div style={{ position: 'relative', width: '80px', height: '80px' }}>
          <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
            <circle
              cx="40"
              cy="40"
              r={radius}
              fill="none"
              stroke="#f0f0f0"
              strokeWidth="10"
            />
            <circle
              cx="40"
              cy="40"
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="10"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: color }}>
              {calibratedValue.toFixed(1)}
            </div>
            <div style={{ fontSize: '10px', color: '#666' }}>{unit}</div>
          </div>
        </div>
      </div>
    );
  };

  const renderDigital = () => {
    const color = getProgressColor();
    
    return (
      <div style={{ width: '100%', textAlign: 'center' }}>
        <div style={{
          fontSize: '32px',
          fontWeight: '700',
          color: color,
          fontFamily: 'monospace',
          backgroundColor: '#000',
          padding: '12px',
          borderRadius: '8px',
          display: 'inline-block',
          minWidth: '120px',
          textShadow: `0 0 10px ${color}`,
          border: `2px solid ${color}40`
        }}>
          {calibratedValue.toFixed(1)}
        </div>
        <div style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>
          {unit}
        </div>
      </div>
    );
  };

  const renderGradient = () => {
    const color = getProgressColor();
    
    // colorRanges 방어 코드
    if (!colorRanges || !colorRanges.low || !colorRanges.normal || !colorRanges.warning || !colorRanges.danger) {
      return (
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '24px', fontWeight: 'bold', color: color }}>
              {calibratedValue.toFixed(1)} {unit}
            </span>
            <span style={{ fontSize: '12px', color: '#666' }}>
              {Math.round(percentage)}%
            </span>
          </div>
          <div style={{ color: '#666' }}>컬러 범위 설정 오류</div>
        </div>
      );
    }
    
    return (
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '24px', fontWeight: 'bold', color: color }}>
            {calibratedValue.toFixed(1)} {unit}
          </span>
          <span style={{ fontSize: '12px', color: '#666' }}>
            {Math.round(percentage)}%{percentage > 100 ? ' ⚠️' : ''}
          </span>
        </div>
        <div style={{
          width: '100%',
          height: '20px',
          background: `linear-gradient(90deg, 
            #2196f3 0%, 
            #2196f3 ${(colorRanges.low.max / maxValue) * 100}%, 
            #4caf50 ${(colorRanges.low.max / maxValue) * 100}%, 
            #4caf50 ${(colorRanges.normal.max / maxValue) * 100}%, 
            #ff9800 ${(colorRanges.normal.max / maxValue) * 100}%, 
            #ff9800 ${(colorRanges.warning.max / maxValue) * 100}%, 
            #f44336 ${(colorRanges.warning.max / maxValue) * 100}%, 
            #f44336 100%
          )`,
          borderRadius: '10px',
          position: 'relative',
          opacity: 0.3
        }}>
          <div style={{
            position: 'absolute',
            left: `${Math.min(percentage, 100)}%`,
            top: '-5px',
            width: '4px',
            height: '30px',
            backgroundColor: color,
            borderRadius: '2px',
            transform: 'translateX(-50%)',
            boxShadow: `0 0 8px ${color}`,
            transition: 'left 0.3s ease'
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#999', marginTop: '4px' }}>
          <span>{minValue}</span>
          <span>{maxValue}</span>
        </div>
      </div>
    );
  };

  const renderValue = () => {
    switch (displayType) {
      case 'gauge':
        return renderGauge();
      case 'bar':
        return renderBar();
      case 'hybrid':
        return renderHybrid();
      case 'minichart':
        return renderMiniChart();
      case 'target':
        return renderTarget();
      case 'segment':
        return renderSegment();
      case 'wave':
        return renderWave();
      case 'sparkline':
        return renderSparkline();
      case 'donut':
        return renderDonut();
      case 'digital':
        return renderDigital();
      case 'gradient':
        return renderGradient();
      default:
        return (
          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            marginBottom: '16px',
            position: 'relative',
            zIndex: 1
          }}>
            <span style={{ 
              fontSize: '36px', 
              fontWeight: '700',
              color: '#2c3e50',
              lineHeight: '1'
            }}>
              {calibratedValue.toFixed(1)}
            </span>
            {unit && (
              <span style={{ 
                fontSize: '18px', 
                color: '#7f8c8d',
                marginLeft: '8px',
                fontWeight: '500'
              }}>
                {unit}
              </span>
            )}
          </div>
        );
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing && !isEditingTitle) {
      e.preventDefault();
      const rect = cardRef.current?.getBoundingClientRect();
      const parentRect = cardRef.current?.offsetParent?.getBoundingClientRect();
      if (rect && parentRect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
        setIsDragging(true);
        
        // Add visual feedback for dragging
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
      }
    }
  };

  const snapToGrid = (value: number, gridSize: number) => {
    return Math.round(value / gridSize) * gridSize;
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging && onMove) {
      const parentRect = cardRef.current?.offsetParent?.getBoundingClientRect();
      if (parentRect) {
        const rawPosition = {
          x: e.clientX - parentRect.left - dragOffset.x,
          y: e.clientY - parentRect.top - dragOffset.y
        };
        
        // Apply constraints before snapping to grid
        const constrainedPosition = {
          x: Math.max(0, Math.min(rawPosition.x, parentRect.width - size.width)),
          y: Math.max(0, Math.min(rawPosition.y, parentRect.height - size.height))
        };
        
        // Snap to grid (will be handled by the manager)
        onMove(id, constrainedPosition);
      }
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      // Restore cursor and user selection
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    }
    
    setIsDragging(false);
    setIsResizing(false);
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEditing) {
      setIsResizing(true);
    }
  };

  const handleResizeMouseMove = (e: MouseEvent) => {
    if (isResizing && onResize) {
      const rect = cardRef.current?.getBoundingClientRect();
      if (rect) {
        const gridSize = 25; // 25px grid
        const minWidth = 200;
        const minHeight = 120;
        const newSize = {
          width: Math.max(minWidth, snapToGrid(e.clientX - rect.left + 10, gridSize)),
          height: Math.max(minHeight, snapToGrid(e.clientY - rect.top + 10, gridSize))
        };
        onResize(id, newSize);
      }
    }
  };

  const handleTitleEdit = () => {
    if (isEditing) {
      setIsEditingTitle(true);
    }
  };

  const handleTitleSave = () => {
    if (onEdit) {
      onEdit(id, { title: editableTitle });
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setEditableTitle(title);
      setIsEditingTitle(false);
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(id);
    }
  };

  React.useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', isDragging ? handleMouseMove : handleResizeMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', isDragging ? handleMouseMove : handleResizeMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragOffset]);

  React.useEffect(() => {
    setEditableTitle(title);
  }, [title]);

  const isCurrentlyEditing = editingCardId === id;
  const isOtherCardEditing = editingCardId && editingCardId !== id;

  return (
    <div 
      ref={cardRef}
      onMouseDown={handleMouseDown}
      style={{
        background: 'white',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: isDragging ? '0 12px 48px rgba(0, 0, 0, 0.2)' : 
                   isCurrentlyEditing ? '0 12px 48px rgba(102, 126, 234, 0.3)' : 
                   '0 8px 32px rgba(0, 0, 0, 0.1)',
        border: isCurrentlyEditing ? '3px solid #667eea' : 
                isEditing ? (isOtherCardEditing ? '2px solid #bdc3c7' : '2px solid #667eea') : 
                '1px solid rgba(255, 255, 255, 0.2)',
        transition: isDragging || isResizing ? 'none' : 'all 0.3s ease',
        position: isEditing ? 'absolute' : 'relative',
        left: isEditing ? `${position.x}px` : '0',
        top: isEditing ? `${position.y}px` : '0',
        width: `${size.width}px`,
        height: `${size.height}px`,
        minHeight: isEditing ? 'auto' : '160px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: isEditing ? (isDragging ? 'grabbing' : 'grab') : 'default',
        opacity: isDragging ? 0.8 : 
                 isOtherCardEditing ? 0.6 : 
                 1,
        transform: isDragging ? 'scale(1.02)' : 
                   isCurrentlyEditing ? 'scale(1.02)' : 
                   'scale(1)',
        zIndex: isDragging ? 1000 : 
                isCurrentlyEditing ? 500 : 
                (isEditing ? 100 : 1),
        userSelect: 'none',
        filter: isOtherCardEditing ? 'grayscale(20%)' : 'none'
      }}>
      {/* Background gradient */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '100px',
        height: '100px',
        background: getStatusBackground(),
        borderRadius: '50%',
        transform: 'translate(30px, -30px)',
        opacity: isOtherCardEditing ? 0.3 : 0.6,
      }} />

      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        position: 'relative',
        zIndex: 1
      }}>
        {isEditingTitle ? (
          <input
            type="text"
            value={editableTitle}
            onChange={(e) => setEditableTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={handleTitleKeyDown}
            style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#2c3e50',
              letterSpacing: '0.5px',
              background: 'transparent',
              border: '1px solid #667eea',
              borderRadius: '4px',
              padding: '2px 6px',
              outline: 'none',
              margin: 0,
              width: '70%'
            }}
            autoFocus
          />
        ) : (
          <h3 
            style={{ 
              margin: 0,
              fontSize: '16px',
              fontWeight: '600',
              color: '#2c3e50',
              letterSpacing: '0.5px',
              cursor: isEditing ? 'pointer' : 'default',
              padding: '2px 6px',
              borderRadius: '4px',
              transition: 'background-color 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onClick={handleTitleEdit}
            onMouseOver={(e) => {
              if (isEditing) {
                e.currentTarget.style.backgroundColor = '#f0f0f0';
              }
            }}
            onMouseOut={(e) => {
              if (isEditing) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            {icon && (
              <span style={{ fontSize: '18px' }}>{icon}</span>
            )}
            {title}
            {isCalculated && (
              <span style={{ 
                fontSize: '12px', 
                color: '#667eea',
                marginLeft: '8px',
                backgroundColor: '#f0f4ff',
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: '500'
              }}>
                계산됨
              </span>
            )}
          </h3>
        )}
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isEditing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={() => onEditTopic?.(id)}
                style={{
                  background: '#2196f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1976d2'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2196f3'}
                title="토픽 편집"
              >
                🔌
              </button>
              <button
                onClick={() => onEditIcon?.(id)}
                style={{
                  background: '#ff9800',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f57c00'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ff9800'}
                title="아이콘 편집"
              >
                🎨
              </button>
              <button
                onClick={() => onEditDisplay?.(id)}
                style={{
                  background: '#9c27b0',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#7b1fa2'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#9c27b0'}
                title="표시 방식 편집"
              >
                📊
              </button>
              <button
                onClick={handleDelete}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#f44336',
                  cursor: 'pointer',
                  fontSize: '16px',
                  padding: '4px',
                  borderRadius: '4px',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#ffebee'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                title="카드 삭제"
              >
                🗑️
              </button>
            </div>
          )}
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: getStatusColor(),
            boxShadow: `0 0 0 3px ${getStatusColor()}20`,
            animation: status === 'normal' ? 'pulse 2s infinite' : 'none'
          }} />
        </div>
      </div>

      {/* Value */}
      <div style={{
        marginBottom: '16px',
        position: 'relative',
        zIndex: 1
      }}>
        {renderValue()}
      </div>

      {/* Footer */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '12px',
        color: '#95a5a6',
        position: 'relative',
        zIndex: 1
      }}>
        <span style={{
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          fontWeight: '500'
        }}>
          {status === 'normal' ? 'NORMAL' : status === 'warning' ? 'WARNING' : 'DANGER'}
        </span>
        <span style={{
          fontSize: '11px',
          fontWeight: '500'
        }}>
          {lastUpdated ? formatTime(lastUpdated) : 'No data'}
        </span>
      </div>

      {/* Resize Handle */}
      {isEditing && (
        <div
          ref={resizeRef}
          onMouseDown={handleResizeMouseDown}
          style={{
            position: 'absolute',
            bottom: '0',
            right: '0',
            width: '20px',
            height: '20px',
            background: 'linear-gradient(-45deg, transparent 0%, transparent 30%, #667eea 30%, #667eea 100%)',
            cursor: 'nw-resize',
            borderBottomRightRadius: '16px',
            opacity: 0.6,
            transition: 'opacity 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
          onMouseOut={(e) => e.currentTarget.style.opacity = '0.6'}
        />
      )}

      <style>
        {`
          @keyframes pulse {
            0% { box-shadow: 0 0 0 0 ${getStatusColor()}40; }
            70% { box-shadow: 0 0 0 10px ${getStatusColor()}00; }
            100% { box-shadow: 0 0 0 0 ${getStatusColor()}00; }
          }
          @keyframes wave {
            0% { transform: translateX(-100%) translateY(50%); }
            100% { transform: translateX(100%) translateY(50%); }
          }
        `}
      </style>
    </div>
  );
};

export default SensorCard;