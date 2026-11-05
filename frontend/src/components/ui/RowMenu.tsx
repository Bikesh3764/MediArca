// "⋯" button that opens a short list of less-used actions for one queue row.
// The list floats above the page (fixed position) so card edges never clip it.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface RowMenuItem {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

const MENU_WIDTH = 200;

export const RowMenu: React.FC<{ items: RowMenuItem[]; label?: string }> = ({ items, label = 'More' }) => {
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setPos(null), []);

  const open = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.max(16, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 16));
    const up = rect.bottom + 48 * items.length + 24 > window.innerHeight;
    setPos({ top: up ? rect.top - 6 : rect.bottom + 6, left, up });
  };

  useEffect(() => {
    if (!pos) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || buttonRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [pos, close]);

  if (items.length === 0) return null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={Boolean(pos)}
        onClick={() => (pos ? close() : open())}
        className="w-9 h-9 flex items-center justify-center rounded-full text-[#1d1d1f] bg-white hover:bg-[#f5f5f7] border border-[#e5e5ea] transition-all active:scale-[0.98] cursor-pointer shrink-0"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {pos && (
        <div
          ref={menuRef}
          role="menu"
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: MENU_WIDTH, transform: pos.up ? 'translateY(-100%)' : undefined }}
          className="z-50 bg-white/95 backdrop-blur-xl rounded-2xl border border-[#e5e5ea] p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.12)] animate-fadeIn"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                close();
                item.onSelect();
              }}
              className={`w-full h-10 px-3 rounded-xl text-left text-[14px] font-normal transition-colors cursor-pointer disabled:opacity-50 ${
                item.destructive ? 'text-danger hover:bg-danger-soft' : 'text-[#1d1d1f] hover:bg-[#f5f5f7]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
};

export default RowMenu;
