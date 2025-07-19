import React, { useState } from 'react';
import type { MqttTreeNode } from '../types/MqttTree';

interface MqttTreeViewProps {
  node: MqttTreeNode;
  level?: number;
}

interface TreeNodeProps {
  node: MqttTreeNode;
  level: number;
  isExpanded: boolean;
  onToggle: () => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, level, isExpanded, onToggle }) => {
  const hasChildren = node.children.size > 0;
  const indent = level * 20;

  const getNodeIcon = () => {
    if (node.isEndpoint) return '📄';
    if (hasChildren) return isExpanded ? '📁' : '📂';
    return '📄';
  };

  const getValueDisplay = () => {
    if (!node.value) return null;
    
    const isJson = node.value.startsWith('{') || node.value.startsWith('[');
    const displayValue = isJson ? 
      JSON.stringify(JSON.parse(node.value), null, 2) : 
      node.value;

    return (
      <div style={{
        marginTop: '8px',
        padding: '8px 12px',
        backgroundColor: '#f8fafc',
        borderRadius: '6px',
        border: '1px solid #e2e8f0',
        fontSize: '12px',
        fontFamily: 'monospace'
      }}>
        <div style={{
          color: '#64748b',
          fontSize: '10px',
          marginBottom: '4px'
        }}>
          값: {node.lastUpdated?.toLocaleTimeString()}
        </div>
        <div style={{
          color: '#1e293b',
          maxHeight: '100px',
          overflow: 'auto',
          whiteSpace: isJson ? 'pre-wrap' : 'nowrap'
        }}>
          {displayValue}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      marginLeft: `${indent}px`,
      borderLeft: level > 0 ? '1px solid #e2e8f0' : 'none',
      paddingLeft: '12px'
    }}>
      <div
        onClick={hasChildren ? onToggle : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '6px 8px',
          borderRadius: '6px',
          cursor: hasChildren ? 'pointer' : 'default',
          backgroundColor: 'transparent',
          transition: 'background-color 0.2s',
          border: 'none'
        }}
        onMouseEnter={(e) => {
          if (hasChildren) {
            e.currentTarget.style.backgroundColor = '#f1f5f9';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <span style={{
          marginRight: '8px',
          fontSize: '14px'
        }}>
          {getNodeIcon()}
        </span>
        
        <span style={{
          fontSize: '14px',
          fontWeight: node.isEndpoint ? '500' : '600',
          color: node.isEndpoint ? '#059669' : '#1e293b'
        }}>
          {node.name}
        </span>
        
        {hasChildren && (
          <span style={{
            marginLeft: '8px',
            fontSize: '12px',
            color: '#64748b'
          }}>
            ({node.children.size})
          </span>
        )}
        
        {node.isEndpoint && (
          <span style={{
            marginLeft: '8px',
            fontSize: '10px',
            color: '#64748b',
            backgroundColor: '#f0fdf4',
            padding: '2px 6px',
            borderRadius: '10px',
            border: '1px solid #bbf7d0'
          }}>
            endpoint
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
            />
          ))}
        </div>
      )}
    </div>
  );
};

const MqttTreeNodeWrapper: React.FC<{ node: MqttTreeNode; level: number }> = ({ node, level }) => {
  const [isExpanded, setIsExpanded] = useState(level < 2); // 처음 2레벨까지만 자동 확장

  return (
    <TreeNode
      node={node}
      level={level}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
    />
  );
};

const MqttTreeView: React.FC<MqttTreeViewProps> = ({ node, level = 0 }) => {
  if (node.children.size === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '40px',
        color: '#64748b',
        fontSize: '16px'
      }}>
        🌳 MQTT 토픽 트리가 여기에 표시됩니다
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '14px',
      lineHeight: '1.5'
    }}>
      {Array.from(node.children.entries()).map(([key, childNode]) => (
        <MqttTreeNodeWrapper
          key={key}
          node={childNode}
          level={level}
        />
      ))}
    </div>
  );
};

export default MqttTreeView;