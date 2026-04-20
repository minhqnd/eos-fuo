import { useState, useCallback, useEffect, useRef } from 'react';

interface Position {
  x: number;
  y: number;
}

export function useDraggable(initialPos: Position, disabled = false) {
  const [pos, setPos] = useState<Position>(initialPos);
  const [isDragging, setIsDragging] = useState(false);
  const offsetRef = useRef<Position>({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    
    // Only drag with left click
    if (e.button !== 0) return;

    setIsDragging(true);
    offsetRef.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    };
    
    // Prevent text selection during drag
    e.preventDefault();
  }, [disabled, pos.x, pos.y]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPos({
        x: e.clientX - offsetRef.current.x,
        y: e.clientY - offsetRef.current.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return {
    pos,
    setPos,
    isDragging,
    handleMouseDown,
  };
}
