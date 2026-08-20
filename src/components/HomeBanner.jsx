import React, { useState, useEffect, useRef } from 'react';

export default function HomeBanner() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const slides = [
    { id: 1, image: '/banner1.png', alt: 'LeafLearn Banner 1' },
    { id: 2, image: '/banner2.png', alt: 'LeafLearn Banner 2' },
  ];

  // Auto-play interval: 5.5 seconds
  useEffect(() => {
    if (isHovered) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5500);

    return () => clearInterval(interval);
  }, [isHovered, slides.length]);

  // Touch Swipe handlers for mobile
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;

    if (distance > 40) {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    } else if (distance < -40) {
      setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
    }

    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative w-full max-w-[1080px] mx-auto h-[220px] sm:h-[300px] md:h-[360px] lg:h-[390px] rounded-[20px] overflow-hidden shadow-2xs group bg-[#F8FCF4] border border-[#E7EEDC]"
    >
      {/* 2 Full Image Slides Container */}
      <div
        className="flex w-[200%] h-full transition-all duration-500 ease-in-out"
        style={{ transform: `translateX(-${currentSlide * 50}%)` }}
      >
        {slides.map((slide) => (
          <div key={slide.id} className="w-1/2 h-full shrink-0 relative bg-[#F8FCF4]">
            <img
              src={slide.image}
              alt={slide.alt}
              className="w-full h-full object-cover object-center pointer-events-none select-none"
            />
          </div>
        ))}
      </div>

      {/* Navigation Arrow Controls (Visible on hover) */}
      <button
        type="button"
        onClick={() => setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1))}
        className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 hover:bg-white text-[#2E3A28] border border-[#E7EEDC] shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 z-20 cursor-pointer focus:outline-none"
        title="Banner trước"
      >
        ‹
      </button>

      <button
        type="button"
        onClick={() => setCurrentSlide((prev) => (prev + 1) % slides.length)}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 hover:bg-white text-[#2E3A28] border border-[#E7EEDC] shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 z-20 cursor-pointer focus:outline-none"
        title="Banner tiếp"
      >
        ›
      </button>

      {/* Minimalist Pagination Dots */}
      <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
        {slides.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setCurrentSlide(idx)}
            className={`transition-all duration-300 cursor-pointer focus:outline-none ${
              currentSlide === idx
                ? 'w-[26px] h-[7px] rounded-full bg-[#A8D672]'
                : 'w-[7px] h-[7px] rounded-full bg-white/70 hover:bg-white'
            }`}
            title={`Banner ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
