interface CardPosition {
  x: number;
  y: number;
}

interface CardSize {
  width: number;
  height: number;
}

interface CardLayout {
  id: string;
  position: CardPosition;
  size: CardSize;
}

const GRID_SIZE = 25;
const CONTAINER_WIDTH = 1160; // Actual container width (1200 - 40px margin)
const CONTAINER_HEIGHT = 560; // Container height in edit mode (600 - 40px margin)
const MARGIN = 10; // Margin between cards

// Find the next available position for a new card
export const findNextAvailablePosition = (
  existingCards: CardLayout[],
  newCardSize: CardSize = { width: 275, height: 160 }
): CardPosition => {
  const gridWidth = Math.floor(CONTAINER_WIDTH / GRID_SIZE);
  const gridHeight = Math.floor(CONTAINER_HEIGHT / GRID_SIZE);
  
  // Convert card sizes to grid units (add margin)
  const cardGridWidth = Math.ceil((newCardSize.width + MARGIN) / GRID_SIZE);
  const cardGridHeight = Math.ceil((newCardSize.height + MARGIN) / GRID_SIZE);
  
  // Create a grid to track occupied positions
  const grid: boolean[][] = Array(gridHeight).fill(null).map(() => Array(gridWidth).fill(false));
  
  // Mark occupied positions with margin
  existingCards.forEach(card => {
    const startX = Math.floor(card.position.x / GRID_SIZE);
    const startY = Math.floor(card.position.y / GRID_SIZE);
    const endX = Math.min(startX + Math.ceil((card.size.width + MARGIN) / GRID_SIZE), gridWidth);
    const endY = Math.min(startY + Math.ceil((card.size.height + MARGIN) / GRID_SIZE), gridHeight);
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
          grid[y][x] = true;
        }
      }
    }
  });
  
  // Find the first available position
  for (let y = 0; y <= gridHeight - cardGridHeight; y++) {
    for (let x = 0; x <= gridWidth - cardGridWidth; x++) {
      let canPlace = true;
      
      // Check if the card can be placed at this position
      for (let dy = 0; dy < cardGridHeight && canPlace; dy++) {
        for (let dx = 0; dx < cardGridWidth && canPlace; dx++) {
          if (y + dy >= 0 && y + dy < gridHeight && x + dx >= 0 && x + dx < gridWidth) {
            if (grid[y + dy][x + dx]) {
              canPlace = false;
            }
          }
        }
      }
      
      if (canPlace) {
        return {
          x: x * GRID_SIZE,
          y: y * GRID_SIZE
        };
      }
    }
  }
  
  // If no position found in grid, place in next row
  const maxY = existingCards.length > 0 ? 
    Math.max(...existingCards.map(card => card.position.y + card.size.height)) : 0;
  
  return {
    x: 0,
    y: snapToGrid(maxY + MARGIN)
  };
};

// Rearrange cards to avoid overlaps - improved version with stable layout
export const rearrangeCards = (cards: CardLayout[]): CardLayout[] => {
  if (cards.length === 0) return cards;
  
  // Check if any cards actually overlap first
  let hasOverlaps = false;
  for (let i = 0; i < cards.length - 1; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      if (checkOverlap(cards[i], cards[j])) {
        hasOverlaps = true;
        break;
      }
    }
    if (hasOverlaps) break;
  }
  
  // If no overlaps, don't rearrange to avoid unnecessary position changes
  if (!hasOverlaps) {
    return cards.map(card => ({
      ...card,
      position: constrainToContainer(card.position, card.size)
    }));
  }
  
  // Sort by y position first, then x position to maintain reading order
  const sortedCards = [...cards].sort((a, b) => {
    const yDiff = a.position.y - b.position.y;
    if (Math.abs(yDiff) > 25) return yDiff; // Only consider significant y differences
    return a.position.x - b.position.x;
  });
  
  const rearranged: CardLayout[] = [];
  
  sortedCards.forEach(card => {
    const newPosition = findNextAvailablePosition(rearranged, card.size);
    rearranged.push({
      ...card,
      position: constrainToContainer(newPosition, card.size)
    });
  });
  
  return rearranged;
};

// Check if two cards overlap
export const checkOverlap = (card1: CardLayout, card2: CardLayout): boolean => {
  return !(
    card1.position.x + card1.size.width + MARGIN <= card2.position.x ||
    card2.position.x + card2.size.width + MARGIN <= card1.position.x ||
    card1.position.y + card1.size.height + MARGIN <= card2.position.y ||
    card2.position.y + card2.size.height + MARGIN <= card1.position.y
  );
};

// Snap position to grid
export const snapToGrid = (value: number, gridSize: number = GRID_SIZE): number => {
  return Math.round(value / gridSize) * gridSize;
};

// Get container dimensions
export const getContainerDimensions = () => ({
  width: CONTAINER_WIDTH,
  height: CONTAINER_HEIGHT
});

// Remove overlapping cards by adjusting positions
export const removeOverlaps = (cards: CardLayout[]): CardLayout[] => {
  const result = [...cards];
  
  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      if (checkOverlap(result[i], result[j])) {
        // Move the second card to avoid overlap
        const existingCards = result.slice(0, j);
        const newPosition = findNextAvailablePosition(existingCards, result[j].size);
        result[j] = {
          ...result[j],
          position: constrainToContainer(newPosition, result[j].size)
        };
      }
    }
  }
  
  return result;
};

// Real-time collision detection and resolution during drag
export const resolveCollisionsDuringDrag = (
  cards: CardLayout[],
  draggedCardId: string,
  newPosition: CardPosition
): CardLayout[] => {
  const result = [...cards];
  const draggedCardIndex = result.findIndex(card => card.id === draggedCardId);
  
  if (draggedCardIndex === -1) return result;
  
  // Update the dragged card position
  const draggedCard = {
    ...result[draggedCardIndex],
    position: newPosition
  };
  result[draggedCardIndex] = draggedCard;
  
  // Check for collisions with other cards
  const affectedCards: string[] = [];
  
  for (let i = 0; i < result.length; i++) {
    if (i === draggedCardIndex) continue;
    
    if (checkOverlap(draggedCard, result[i])) {
      affectedCards.push(result[i].id);
    }
  }
  
  // Resolve collisions by moving affected cards
  if (affectedCards.length > 0) {
    // Create a copy without the affected cards
    const stableCards = result.filter(card => 
      card.id === draggedCardId || !affectedCards.includes(card.id)
    );
    
    // Find new positions for affected cards
    affectedCards.forEach(cardId => {
      const cardIndex = result.findIndex(card => card.id === cardId);
      if (cardIndex !== -1) {
        const card = result[cardIndex];
        const newPos = findNextAvailablePosition(
          stableCards.filter(c => c.id !== cardId),
          card.size
        );
        
        result[cardIndex] = {
          ...card,
          position: constrainToContainer(newPos, card.size)
        };
        
        // Add to stable cards for next iteration
        stableCards.push(result[cardIndex]);
      }
    });
  }
  
  return result;
};

// Get all cards that would be affected by moving a card to a new position
export const getAffectedCards = (
  cards: CardLayout[],
  draggedCardId: string,
  newPosition: CardPosition
): string[] => {
  const draggedCard = cards.find(card => card.id === draggedCardId);
  if (!draggedCard) return [];
  
  const movedCard = {
    ...draggedCard,
    position: newPosition
  };
  
  const affectedCards: string[] = [];
  
  cards.forEach(card => {
    if (card.id !== draggedCardId && checkOverlap(movedCard, card)) {
      affectedCards.push(card.id);
    }
  });
  
  return affectedCards;
};

// Calculate the optimal direction to move a card to avoid collision
export const getOptimalMoveDirection = (
  draggedCard: CardLayout,
  targetCard: CardLayout
): 'right' | 'down' | 'left' | 'up' => {
  const dx = targetCard.position.x - draggedCard.position.x;
  const dy = targetCard.position.y - draggedCard.position.y;
  
  // Prefer moving right or down to maintain reading order
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  } else {
    return dy > 0 ? 'down' : 'up';
  }
};

// Ensure position is within container bounds
export const constrainToContainer = (
  position: CardPosition,
  size: CardSize,
  containerWidth: number = CONTAINER_WIDTH,
  containerHeight: number = CONTAINER_HEIGHT
): CardPosition => {
  return {
    x: Math.max(0, Math.min(position.x, containerWidth - size.width)),
    y: Math.max(0, Math.min(position.y, containerHeight - size.height))
  };
};

export type { CardLayout, CardPosition, CardSize };

// Performance optimized version for real-time updates
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};