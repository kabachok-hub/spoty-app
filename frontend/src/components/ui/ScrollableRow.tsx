import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ScrollableRowProps {
  children: React.ReactNode;
  className?: string;
  itemClassName?: string;
}

export const ScrollableRow: React.FC<ScrollableRowProps> = ({
  children,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragInfo = useRef({ startX: 0, scrollLeft: 0, moved: false });

  const checkScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);

    // Mouse wheel horizontal scroll redirection on PC
    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
        // Only prevent vertical scroll if container can scroll in that direction
        const canScroll = (e.deltaY > 0 && el.scrollLeft < el.scrollWidth - el.clientWidth) ||
                          (e.deltaY < 0 && el.scrollLeft > 0);
        if (canScroll) {
          e.preventDefault();
          el.scrollLeft += e.deltaY;
          checkScroll();
        }
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      el.removeEventListener('scroll', checkScroll);
      el.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll, children]);

  const scrollBy = (offset: number) => {
    const el = containerRef.current;
    if (el) {
      el.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  // Mouse Drag-to-Scroll support for PC
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag with left mouse button
    if (e.button !== 0) return;
    const el = containerRef.current;
    if (!el) return;

    setIsDragging(true);
    dragInfo.current = {
      startX: e.pageX - el.offsetLeft,
      scrollLeft: el.scrollLeft,
      moved: false,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const el = containerRef.current;
    if (!el) return;

    const x = e.pageX - el.offsetLeft;
    const walk = (x - dragInfo.current.startX) * 1.5;
    if (Math.abs(walk) > 4) {
      dragInfo.current.moved = true;
    }
    el.scrollLeft = dragInfo.current.scrollLeft - walk;
    checkScroll();
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className={`relative group/row ${className}`}>
      {/* Left Scroll Button on Desktop */}
      {canScrollLeft && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            scrollBy(-320);
          }}
          className="hidden sm:flex absolute -left-2 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-[#181818]/90 hover:bg-[#282828] text-white border border-white/10 shadow-2xl items-center justify-center transition-all opacity-0 group-hover/row:opacity-100 hover:scale-110 active:scale-95 cursor-pointer backdrop-blur-md"
          aria-label="Scroll left"
        >
          <ChevronLeft size={22} />
        </button>
      )}

      {/* Right Scroll Button on Desktop */}
      {canScrollRight && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            scrollBy(320);
          }}
          className="hidden sm:flex absolute -right-2 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-[#181818]/90 hover:bg-[#282828] text-white border border-white/10 shadow-2xl items-center justify-center transition-all opacity-0 group-hover/row:opacity-100 hover:scale-110 active:scale-95 cursor-pointer backdrop-blur-md"
          aria-label="Scroll right"
        >
          <ChevronRight size={22} />
        </button>
      )}

      {/* Horizontal Scrollable Track */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 scroll-smooth ${
          isDragging ? 'cursor-grabbing select-none' : 'cursor-default'
        }`}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {children}
      </div>
    </div>
  );
};
