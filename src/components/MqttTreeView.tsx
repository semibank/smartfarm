import React, { useState } from 'react';
import type { MqttTreeNode } from '../types/MqttTree';

interface MqttTreeViewProps {
  node: MqttTreeNode;
  level?: number;
  parentPath?: string;
}

interface TreeNodeProps {
  node: MqttTreeNode;
  level: number;
  isExpanded: boolean;
  onToggle: () => void;
  fullPath: string;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, level, isExpanded, onToggle, fullPath }) => {
  const hasChildren = node.children.size > 0;
  const indent = level * 24;
  const [showCopySuccess, setShowCopySuccess] = useState(false);

  const getNodeIcon = () => {
    if (node.isEndpoint) return '📄';
    if (hasChildren) return isExpanded ? '📂' : '📁';
    return '📄';
  };

  const getNodeColor = () => {
    if (node.isEndpoint) return '#059669';
    return level === 0 ? '#7c3aed' : level === 1 ? '#2563eb' : '#64748b';
  };

  const copyToClipboard = async (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setShowCopySuccess(true);
      setTimeout(() => setShowCopySuccess(false), 2000);
    } catch (err) {
      console.error('클립보드 복사 실패:', err);
    }
  };

  const getValueDisplay = () => {
    if (!node.value) return null;
    
    let isJson = false;
    let displayValue = node.value;
    
    try {
      if (node.value.startsWith('{') || node.value.startsWith('[')) {
        displayValue = JSON.stringify(JSON.parse(node.value), null, 2);
        isJson = true;
      }
    } catch (e) {
      // Not valid JSON, use original value
    }

    const getValueTypeColor = () => {
      if (isJson) return '#7c3aed';
      if (!isNaN(Number(node.value))) return '#059669';
      if (node.value.toLowerCase() === 'true' || node.value.toLowerCase() === 'false') return '#dc2626';
      return '#64748b';
    };

    return (
      <div style={{
        marginTop: '8px',
        marginLeft: '32px',
        padding: '12px 16px',
        backgroundColor: 'rgba(248, 250, 252, 0.8)',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        fontSize: '12px',
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
        backdropFilter: 'blur(4px)',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          <span style={{
            color: '#64748b',
            fontSize: '10px',
            fontWeight: '500',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            📊 메시지 값
          </span>
          <span style={{
            color: '#94a3b8',
            fontSize: '10px'
          }}>
            {node.lastUpdated?.toLocaleTimeString()}
          </span>
        </div>
        <div style={{
          color: getValueTypeColor(),
          maxHeight: '120px',
          overflow: 'auto',
          whiteSpace: isJson ? 'pre-wrap' : 'pre',
          lineHeight: '1.4',
          backgroundColor: 'white',
          padding: '8px 12px',
          borderRadius: '8px',
          border: '1px solid #f1f5f9',
          fontSize: '11px'
        }}>
          {displayValue}
        </div>
        {isJson && (
          <div style={{
            marginTop: '6px',
            fontSize: '9px',
            color: '#7c3aed',
            fontWeight: '500'
          }}>
            📋 JSON 형식
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      marginLeft: `${indent}px`,
      borderLeft: level > 0 ? '2px solid rgba(99, 102, 241, 0.2)' : 'none',
      paddingLeft: level > 0 ? '16px' : '0',
      position: 'relative'
    }}>
      {/* Connection line */}
      {level > 0 && (
        <div style={{
          position: 'absolute',
          left: '-2px',
          top: '14px',
          width: '16px',
          height: '2px',
          backgroundColor: 'rgba(99, 102, 241, 0.3)',
          borderRadius: '1px'
        }} />
      )}
      
      <div
        onClick={hasChildren ? onToggle : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 12px',
          borderRadius: '10px',
          cursor: hasChildren ? 'pointer' : 'default',
          backgroundColor: 'transparent',
          transition: 'all 0.2s ease',
          border: `1px solid transparent`,
          marginBottom: '4px',
          position: 'relative'
        }}
        onMouseEnter={(e) => {
          if (hasChildren || node.isEndpoint) {
            e.currentTarget.style.backgroundColor = level === 0 ? 'rgba(124, 58, 237, 0.1)' : 
                                                     level === 1 ? 'rgba(37, 99, 235, 0.1)' : 
                                                     'rgba(148, 163, 184, 0.1)';
            e.currentTarget.style.borderColor = getNodeColor() + '40';
            e.currentTarget.style.transform = 'translateX(4px)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.borderColor = 'transparent';
          e.currentTarget.style.transform = 'translateX(0)';
        }}
      >
        {/* Expand/Collapse indicator */}
        {hasChildren && (
          <span style={{
            marginRight: '8px',
            fontSize: '12px',
            color: getNodeColor(),
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            fontWeight: 'bold'
          }}>
            ▶
          </span>
        )}
        
        <span style={{
          marginRight: '8px',
          fontSize: '16px'
        }}>
          {getNodeIcon()}
        </span>
        
        <span style={{
          fontSize: level === 0 ? '16px' : '14px',
          fontWeight: level === 0 ? '700' : node.isEndpoint ? '500' : '600',
          color: getNodeColor(),
          letterSpacing: level === 0 ? '0.5px' : '0px'
        }}>
          {node.name}
        </span>
        
        {hasChildren && (
          <span style={{
            marginLeft: '8px',
            fontSize: '11px',
            color: getNodeColor(),
            backgroundColor: getNodeColor() + '20',
            padding: '2px 6px',
            borderRadius: '12px',
            fontWeight: '500'
          }}>
            {node.children.size}
          </span>
        )}
        
        {node.isEndpoint && (
          <span style={{
            marginLeft: '8px',
            fontSize: '10px',
            color: '#059669',
            backgroundColor: '#f0fdf4',
            padding: '3px 8px',
            borderRadius: '12px',
            border: '1px solid #bbf7d0',
            fontWeight: '500'
          }}>
            endpoint
          </span>
        )}
        
        {/* Copy button */}
        <button
          onClick={(e) => copyToClipboard(fullPath, e)}
          style={{
            marginLeft: '8px',
            padding: '4px 8px',
            fontSize: '10px',
            backgroundColor: showCopySuccess ? '#10b981' : '#f1f5f9',
            color: showCopySuccess ? 'white' : '#64748b',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontWeight: '500'
          }}
          onMouseEnter={(e) => {
            if (!showCopySuccess) {
              e.currentTarget.style.backgroundColor = '#e2e8f0';
              e.currentTarget.style.color = '#475569';
            }
          }}
          onMouseLeave={(e) => {
            if (!showCopySuccess) {
              e.currentTarget.style.backgroundColor = '#f1f5f9';
              e.currentTarget.style.color = '#64748b';
            }
          }}
          title={`토픽 경로 복사: ${fullPath}`}
        >
          {showCopySuccess ? '✓ 복사됨' : '📋 복사'}
        </button>

        {node.lastUpdated && (
          <span style={{
            marginLeft: 'auto',
            fontSize: '10px',
            color: '#94a3b8',
            fontFamily: 'monospace'
          }}>
            {node.lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>
      
      {node.isEndpoint && getValueDisplay()}
      
      {hasChildren && isExpanded && (
        <div style={{ marginTop: '4px' }}>
          {Array.from(node.children.entries()).map(([key, childNode]) => (
            <MqttTreeNodeWrapper
              key={key}
              node={childNode}
              level={level + 1}
              parentPath={fullPath}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const MqttTreeNodeWrapper: React.FC<{ node: MqttTreeNode; level: number; parentPath?: string }> = ({ node, level, parentPath = '' }) => {
  const [isExpanded, setIsExpanded] = useState(level < 2); // 처음 2레벨까지만 자동 확장
  
  const fullPath = parentPath ? `${parentPath}/${node.name}` : node.name;

  return (
    <TreeNode
      node={node}
      level={level}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      fullPath={fullPath}
    />
  );
};

const MqttTreeView: React.FC<MqttTreeViewProps> = ({ node, level = 0 }) => {
  if (node.children.size === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 40px',
        color: '#64748b',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: '64px',
          marginBottom: '20px',
          opacity: 0.3
        }}>
          🌳
        </div>
        <h3 style={{
          margin: '0 0 12px 0',
          fontSize: '20px',
          fontWeight: '600',
          color: '#475569'
        }}>
          MQTT 토픽 트리 대기 중
        </h3>
        <p style={{
          margin: 0,
          fontSize: '16px',
          lineHeight: '1.6',
          maxWidth: '400px'
        }}>
          MQTT 메시지가 수신되면 계층적 토픽 구조가<br/>
          마인드맵 형태로 표시됩니다.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '14px',
      lineHeight: '1.5',
      minHeight: '400px',
      position: 'relative'
    }}>
      {/* Background grid pattern */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(99, 102, 241, 0.1) 1px, transparent 0)',
        backgroundSize: '20px 20px',
        opacity: 0.3,
        pointerEvents: 'none'
      }} />
      
      {/* Tree content */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        padding: '20px 0',
        minWidth: 'max-content'
      }}>
        {Array.from(node.children.entries()).map(([key, childNode]) => (
          <MqttTreeNodeWrapper
            key={key}
            node={childNode}
            level={level}
            parentPath=""
          />
        ))}
      </div>
      
      {/* Tree statistics */}
      <div style={{
        position: 'sticky',
        bottom: '20px',
        left: '20px',
        right: '20px',
        marginTop: '40px',
        padding: '12px 16px',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        fontSize: '12px',
        color: '#64748b',
        textAlign: 'center'
      }}>
        📊 총 {node.children.size}개의 최상위 토픽 • 
        마지막 업데이트: {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
};

export default MqttTreeView;