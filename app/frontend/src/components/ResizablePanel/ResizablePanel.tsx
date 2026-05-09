import { useState, useRef, useEffect, ReactNode } from "react";

interface ResizablePanelProps {
  direction: 'horizontal' | 'vertical';
  initialSize: number;
  minSize: number;
  maxSize?: number;
  onResize?: (size: number) => void;
  children: ReactNode;
  className?: string;
}

export default function ResizablePanel({
  direction,
  initialSize,
  minSize,
  maxSize,
  onResize,
  children,
  className = '',
}: ResizablePanelProps) {
  const [size, setSize] = useState(initialSize);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSize(initialSize);
  }, [initialSize]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!panelRef.current) return;

      const rect = panelRef.current.getBoundingClientRect();
      let newSize: number;

      if (direction === 'horizontal') {
        newSize = e.clientX - rect.left;
      } else {
        newSize = e.clientY - rect.top;
      }

      newSize = Math.max(minSize, newSize);
      if (maxSize) {
        newSize = Math.min(maxSize, newSize);
      }

      setSize(newSize);
      onResize?.(newSize);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, direction, minSize, maxSize, onResize]);

  const style = direction === 'horizontal'
    ? { width: `${size}px` }
    : { height: `${size}px` };

  return (
    <div
      ref={panelRef}
      style={style}
      className={`relative flex-shrink-0 ${className}`}
    >
      {children}
      
      <div
        onMouseDown={startResize}
        className={`absolute ${
          direction === 'horizontal'
            ? 'right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50'
            : 'bottom-0 left-0 right-0 h-1 cursor-row-resize hover:bg-primary/50'
        } ${isResizing ? 'bg-primary' : ''} transition-colors`}
      />
    </div>
  );
}
