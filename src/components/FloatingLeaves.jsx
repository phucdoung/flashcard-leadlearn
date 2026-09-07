import React from 'react';

// Clean minimalist SVG leaf shape matching LeafLearn branding
const LeafIcon = ({ size = 26, color = '#5B9E60' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="pointer-events-none select-none"
  >
    <path
      d="M28 4C18 4 6 12 6 24C6 26.2 7.8 28 10 28C22 28 28 16 28 4Z"
      fill={color}
    />
    <path
      d="M6 26C12 20 18 14 28 4"
      stroke="#2E3A28"
      strokeWidth="1.5"
      strokeLinecap="round"
      opacity="0.2"
    />
  </svg>
);

export default function FloatingLeaves({ variant = 'main' }) {
  // Main app configuration (~6-7 leaves distributed mainly at screen edges)
  const mainLeaves = [
    {
      id: 'leaf-l1',
      side: 'left',
      style: { left: '3%', top: '-5%', '--leaf-opacity': '0.14' },
      size: 28,
      duration: '19s',
      delay: '0s',
      color: '#5B9E60',
      mobileHide: false,
    },
    {
      id: 'leaf-r1',
      side: 'right',
      style: { right: '4%', top: '-8%', '--leaf-opacity': '0.15' },
      size: 32,
      duration: '22s',
      delay: '3.5s',
      color: '#A8D672',
      mobileHide: false,
    },
    {
      id: 'leaf-l2',
      side: 'left',
      style: { left: '8%', top: '-12%', '--leaf-opacity': '0.11' },
      size: 22,
      duration: '16s',
      delay: '7s',
      color: '#5B9E60',
      mobileHide: true,
    },
    {
      id: 'leaf-r2',
      side: 'right',
      style: { right: '7%', top: '-4%', '--leaf-opacity': '0.13' },
      size: 26,
      duration: '24s',
      delay: '11s',
      color: '#5B9E60',
      mobileHide: true,
    },
    {
      id: 'leaf-l3',
      side: 'left',
      style: { left: '12%', top: '-10%', '--leaf-opacity': '0.09' },
      size: 20,
      duration: '20s',
      delay: '5.2s',
      color: '#A8D672',
      mobileHide: true,
    },
    {
      id: 'leaf-r3',
      side: 'right',
      style: { right: '11%', top: '-14%', '--leaf-opacity': '0.10' },
      size: 24,
      duration: '21s',
      delay: '13.5s',
      color: '#5B9E60',
      mobileHide: true,
    },
  ];

  // Auth pages configuration (only 2-3 very faint leaves)
  const authLeaves = [
    {
      id: 'leaf-auth-l',
      side: 'left',
      style: { left: '4%', top: '-6%', '--leaf-opacity': '0.07' },
      size: 24,
      duration: '22s',
      delay: '1s',
      color: '#5B9E60',
      mobileHide: false,
    },
    {
      id: 'leaf-auth-r',
      side: 'right',
      style: { right: '5%', top: '-10%', '--leaf-opacity': '0.08' },
      size: 28,
      duration: '25s',
      delay: '6s',
      color: '#A8D672',
      mobileHide: false,
    },
  ];

  const leavesToRender = variant === 'auth' ? authLeaves : mainLeaves;

  return (
    <div
      className="fixed inset-0 pointer-events-none select-none z-0 overflow-hidden"
      aria-hidden="true"
    >
      {leavesToRender.map((leaf) => (
        <div
          key={leaf.id}
          className={`fixed floating-leaf ${
            leaf.mobileHide ? 'hidden sm:block' : 'block'
          }`}
          style={{
            ...leaf.style,
            animationName: leaf.side === 'left' ? 'leafFloatLeft' : 'leafFloatRight',
            animationDuration: leaf.duration,
            animationDelay: leaf.delay,
            animationIterationCount: 'infinite',
            animationTimingFunction: 'ease-in-out',
            willChange: 'transform, opacity',
          }}
        >
          <LeafIcon size={leaf.size} color={leaf.color} />
        </div>
      ))}
    </div>
  );
}
