import { useEffect, useRef } from "react";

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  separator?: boolean;
  disabled?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let newX = x;
      let newY = y;

      if (x + rect.width > viewportWidth) {
        newX = viewportWidth - rect.width - 10;
      }

      if (y + rect.height > viewportHeight) {
        newY = viewportHeight - rect.height - 10;
      }

      menuRef.current.style.left = `${newX}px`;
      menuRef.current.style.top = `${newY}px`;
    }
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] bg-background border border-border rounded-md shadow-lg py-1"
      style={{ left: `${x}px`, top: `${y}px` }}
    >
      {items.map((item, index) => {
        if (item.separator) {
          return <div key={index} className="h-px bg-border my-1" />;
        }

        return (
          <button
            key={index}
            onClick={() => {
              if (!item.disabled) {
                item.onClick();
                onClose();
              }
            }}
            disabled={item.disabled}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm ${
              item.disabled
                ? 'text-muted-foreground cursor-not-allowed'
                : 'text-foreground hover:bg-accent cursor-pointer'
            }`}
          >
            {item.icon && <span className="w-4 h-4 flex items-center justify-center">{item.icon}</span>}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
