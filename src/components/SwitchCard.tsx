import React, { useState, useRef } from 'react';

export interface SwitchCardData {
  type: 'BINARY' | 'TRIPLE';
  state: number; // 0,1 for binary | 0,1,2 for triple
  labels: string[]; // ['OFF','ON'] or ['닫힘','정지','열림']
  icons?: string[]; // Optional icons for each state
  colors?: string[]; // Optional colors for each state
}

interface SwitchCardProps {
  id: string;
  title: string;
  switchData: SwitchCardData;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  onEdit?: (id: string, updates: Partial<SwitchCardProps>) => void;
  onDelete?: (id: string) => void;
  onMove?: (id: string, position: { x: number; y: number }) => void;
  onResize?: (id: string, size: { width: number; height: number }) => void;
  onStateChange?: (id: string, newState: number) => void;
  isEditing?: boolean;
  onEditIcon?: (id: string) => void;
  onEditTopic?: (id: string) => void;
  editingCardId?: string | null;
  icon?: string;
}

const SwitchCard: React.FC<SwitchCardProps> = ({
  id,
  title,
  switchData,
  position = { x: 0, y: 0 },
  size = { width: 280, height: 160 },
  onEdit,
  onDelete,
  onMove,
  onResize,
  onStateChange,
  isEditing = false,
  onEditIcon,
  onEditTopic,
  editingCardId,
  icon = '🔌'
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [editableTitle, setEditableTitle] = useState(title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [commandSent, setCommandSent] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);

  const getStateColor = () => {
    if (switchData.colors && switchData.colors[switchData.state]) {
      return switchData.colors[switchData.state];
    }
    
    // Default colors based on state
    if (switchData.type === 'BINARY') {
      return switchData.state === 0 ? '#95a5a6' : '#27ae60';
    } else {
      // TRIPLE
      const colors = ['#e74c3c', '#f39c12', '#27ae60']; // 빨강, 주황, 초록
      return colors[switchData.state] || '#95a5a6';
    }
  };

  const getStateBackground = () => {
    const color = getStateColor();
    return `linear-gradient(135deg, ${color}20 0%, ${color}40 100%)`;
  };

  const handleStateChange = (newState: number) => {
    if (onStateChange && !isEditing) {
      // 명령 전송 표시
      setCommandSent(true);
      setTimeout(() => setCommandSent(false), 1500);
      
      onStateChange(id, newState);
    }
  };

  const renderBinarySwitch = () => {
    const isOn = switchData.state === 1;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ 
            fontSize: '24px', 
            fontWeight: 'bold', 
            color: getStateColor(),
            marginBottom: '8px'
          }}>
            {switchData.labels[switchData.state]}
          </div>
          <div style={{ fontSize: '14px', color: '#666' }}>
            상태: {isOn ? 'ON' : 'OFF'}
          </div>
        </div>
        <div 
          onClick={() => handleStateChange(isOn ? 0 : 1)}
          style={{
            width: '60px',
            height: '30px',
            backgroundColor: isOn ? '#27ae60' : '#95a5a6',
            borderRadius: '15px',
            position: 'relative',
            cursor: isEditing ? 'default' : 'pointer',
            transition: 'background-color 0.3s ease',
            opacity: isEditing ? 0.6 : 1
          }}
        >
          <div style={{
            width: '26px',
            height: '26px',
            backgroundColor: 'white',
            borderRadius: '50%',
            position: 'absolute',
            top: '2px',
            left: isOn ? '32px' : '2px',
            transition: 'left 0.3s ease',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }} />
        </div>
      </div>
    );
  };

  const renderTripleSwitch = () => {
    return (
      <div style={{ width: '100%' }}>
        <div style={{ 
          fontSize: '20px', 
          fontWeight: 'bold', 
          color: getStateColor(),
          marginBottom: '12px',
          textAlign: 'center'
        }}>
          {switchData.icons && switchData.icons[switchData.state] && (
            <span style={{ marginRight: '8px' }}>{switchData.icons[switchData.state]}</span>
          )}
          {switchData.labels[switchData.state]}
        </div>
        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
          {switchData.labels.map((label, index) => (
            <button
              key={index}
              onClick={() => handleStateChange(index)}
              disabled={isEditing}
              style={{
                flex: 1,
                padding: '8px 4px',
                fontSize: '12px',
                fontWeight: '600',
                border: 'none',
                borderRadius: '6px',
                cursor: isEditing ? 'default' : 'pointer',
                backgroundColor: switchData.state === index ? getStateColor() : '#f0f0f0',
                color: switchData.state === index ? 'white' : '#666',
                transition: 'all 0.2s ease',
                opacity: isEditing ? 0.6 : 1
              }}
            >
              {switchData.icons && switchData.icons[index] && (
                <div style={{ marginBottom: '2px' }}>{switchData.icons[index]}</div>
              )}
              {label}
            </button>
          ))}
        </div>
      </div>
    );
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
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
      }
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging && onMove) {
      const parentRect = cardRef.current?.offsetParent?.getBoundingClientRect();
      if (parentRect) {
        const rawPosition = {
          x: e.clientX - parentRect.left - dragOffset.x,
          y: e.clientY - parentRect.top - dragOffset.y
        };
        const constrainedPosition = {
          x: Math.max(0, Math.min(rawPosition.x, parentRect.width - size.width)),
          y: Math.max(0, Math.min(rawPosition.y, parentRect.height - size.height))
        };
        onMove(id, constrainedPosition);
      }
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
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
        const gridSize = 25;
        const minWidth = 200;
        const minHeight = 120;
        const newSize = {
          width: Math.max(minWidth, Math.round((e.clientX - rect.left + 10) / gridSize) * gridSize),
          height: Math.max(minHeight, Math.round((e.clientY - rect.top + 10) / gridSize) * gridSize)
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
        background: getStateBackground(),
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
            <span style={{ 
              fontSize: '12px', 
              color: '#667eea',
              marginLeft: '8px',
              backgroundColor: '#f0f4ff',
              padding: '2px 6px',
              borderRadius: '4px',
              fontWeight: '500'
            }}>
              스위치
            </span>
            {commandSent && (
              <span style={{ 
                fontSize: '11px', 
                color: '#10b981',
                marginLeft: '4px',
                backgroundColor: '#f0fdf4',
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: '500',
                animation: 'fadeInOut 1.5s ease-in-out'
              }}>
                📤 전송됨
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
                📡
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
            backgroundColor: getStateColor(),
            boxShadow: `0 0 0 3px ${getStateColor()}20`,
            animation: 'pulse 2s infinite'
          }} />
        </div>
      </div>

      {/* Switch Control */}
      <div style={{
        marginBottom: '16px',
        position: 'relative',
        zIndex: 1
      }}>
        {switchData.type === 'BINARY' ? renderBinarySwitch() : renderTripleSwitch()}
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
          {switchData.type === 'BINARY' ? 'BINARY SWITCH' : 'TRIPLE SWITCH'}
        </span>
        <span style={{
          fontSize: '11px',
          fontWeight: '500'
        }}>
          {new Date().toLocaleTimeString()}
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
            0% { box-shadow: 0 0 0 0 ${getStateColor()}40; }
            70% { box-shadow: 0 0 0 10px ${getStateColor()}00; }
            100% { box-shadow: 0 0 0 0 ${getStateColor()}00; }
          }
          @keyframes fadeInOut {
            0% { opacity: 0; transform: scale(0.8); }
            50% { opacity: 1; transform: scale(1); }
            100% { opacity: 0; transform: scale(0.9); }
          }
        `}
      </style>
    </div>
  );
};

export default SwitchCard;