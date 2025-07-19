import type { MqttTreeNode, MqttMessage } from '../types/MqttTree';

export class MqttTreeParser {
  private root: MqttTreeNode;

  constructor() {
    this.root = {
      name: 'root',
      path: '',
      children: new Map(),
      isEndpoint: false
    };
  }

  addMessage(message: MqttMessage): void {
    const parts = message.topic.split('/').filter(part => part.length > 0);
    this.addToTree(this.root, parts, message, 0);
  }

  private addToTree(node: MqttTreeNode, parts: string[], message: MqttMessage, index: number): void {
    if (index >= parts.length) {
      node.value = message.message;
      node.lastUpdated = message.timestamp;
      node.isEndpoint = true;
      return;
    }

    const part = parts[index];
    const currentPath = parts.slice(0, index + 1).join('/');
    
    if (!node.children.has(part)) {
      node.children.set(part, {
        name: part,
        path: currentPath,
        children: new Map(),
        isEndpoint: false
      });
    }

    const childNode = node.children.get(part)!;
    this.addToTree(childNode, parts, message, index + 1);
  }

  getTree(): MqttTreeNode {
    return this.root;
  }

  clear(): void {
    this.root = {
      name: 'root',
      path: '',
      children: new Map(),
      isEndpoint: false
    };
  }
}