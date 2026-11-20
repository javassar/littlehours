import React from 'react';

export interface CameoWreathProps {
  className?: string;
  color?: string;
  width?: number;
  height?: number;
  opacity?: number;
}

export const CameoWreath: React.FC<CameoWreathProps> = ({
  className = '',
  color = 'var(--rose-deep)',
  width = 140,
  height = 114,
  opacity = 0.9,
}) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 140 114"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      style={{ display: 'block', opacity }}
    >
      <defs>
        <radialGradient id="cameoBgGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FDFBF9" stopOpacity="0.95" />
          <stop offset="70%" stopColor="#FAF5F1" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#F2E6DF" stopOpacity="0.82" />
        </radialGradient>
      </defs>

      {/* Cameo Oval Plaque Fill */}
      <ellipse
        cx="70"
        cy="57"
        rx="58"
        ry="46"
        fill="url(#cameoBgGradient)"
        stroke={color}
        strokeWidth="1.2"
        opacity="0.8"
      />

      {/* Inner delicate beaded / dashed contour line */}
      <ellipse
        cx="70"
        cy="57"
        rx="54"
        ry="42"
        fill="none"
        stroke={color}
        strokeWidth="0.75"
        strokeDasharray="2 3"
        opacity="0.55"
      />
      <ellipse
        cx="70"
        cy="57"
        rx="51"
        ry="39"
        fill="none"
        stroke={color}
        strokeWidth="0.5"
        opacity="0.35"
      />

      {/* Botanical Wreath Framing (Laurel & Rose Leaves with Berries) */}
      <g stroke={color} fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* LEFT WREATH STEM */}
        <path d="M70 103 C48 103, 16 88, 16 57 C16 26, 48 11, 70 11" strokeWidth="1.1" opacity="0.75" />
        <path d="M66 100 C47 98, 20 84, 20 57 C20 30, 47 16, 66 14" strokeWidth="0.65" opacity="0.4" />

        {/* Left Wreath Leaves */}
        <path d="M60 102 C52 105, 48 98, 54 96 C59 95, 62 99, 60 102 Z" strokeWidth="0.75" fill="var(--surface)" fillOpacity="0.75" opacity="0.85" />
        <path d="M42 94 C34 97, 30 90, 36 87 C41 85, 45 90, 42 94 Z" strokeWidth="0.75" fill="var(--surface)" fillOpacity="0.75" opacity="0.85" />
        <path d="M26 81 C18 82, 17 74, 23 72 C28 71, 30 77, 26 81 Z" strokeWidth="0.75" fill="var(--surface)" fillOpacity="0.75" opacity="0.85" />
        <path d="M16 64 C9 63, 10 55, 16 54 C21 54, 21 61, 16 64 Z" strokeWidth="0.75" fill="var(--surface)" fillOpacity="0.75" opacity="0.85" />
        <path d="M18 45 C12 42, 15 34, 22 36 C26 38, 24 45, 18 45 Z" strokeWidth="0.75" fill="var(--surface)" fillOpacity="0.75" opacity="0.85" />
        <path d="M30 29 C24 25, 30 18, 36 21 C40 24, 37 30, 30 29 Z" strokeWidth="0.75" fill="var(--surface)" fillOpacity="0.75" opacity="0.85" />
        <path d="M48 18 C44 13, 52 8, 56 12 C58 16, 54 20, 48 18 Z" strokeWidth="0.75" fill="var(--surface)" fillOpacity="0.75" opacity="0.85" />

        {/* Left Berries & Beads */}
        <circle cx="48" cy="98" r="1.1" fill={color} opacity="0.75" stroke="none" />
        <circle cx="30" cy="86" r="1.1" fill={color} opacity="0.75" stroke="none" />
        <circle cx="15" cy="71" r="1.1" fill={color} opacity="0.75" stroke="none" />
        <circle cx="14" cy="40" r="1.1" fill={color} opacity="0.75" stroke="none" />
        <circle cx="25" cy="24" r="1.1" fill={color} opacity="0.75" stroke="none" />
        <circle cx="43" cy="13" r="1.1" fill={color} opacity="0.75" stroke="none" />

        {/* RIGHT WREATH STEM (Mirrored) */}
        <path d="M70 103 C92 103, 124 88, 124 57 C124 26, 92 11, 70 11" strokeWidth="1.1" opacity="0.75" />
        <path d="M74 100 C93 98, 120 84, 120 57 C120 30, 93 16, 74 14" strokeWidth="0.65" opacity="0.4" />

        {/* Right Wreath Leaves */}
        <path d="M80 102 C88 105, 92 98, 86 96 C81 95, 78 99, 80 102 Z" strokeWidth="0.75" fill="var(--surface)" fillOpacity="0.75" opacity="0.85" />
        <path d="M98 94 C106 97, 110 90, 104 87 C99 85, 95 90, 98 94 Z" strokeWidth="0.75" fill="var(--surface)" fillOpacity="0.75" opacity="0.85" />
        <path d="M114 81 C122 82, 123 74, 117 72 C112 71, 110 77, 114 81 Z" strokeWidth="0.75" fill="var(--surface)" fillOpacity="0.75" opacity="0.85" />
        <path d="M124 64 C131 63, 130 55, 124 54 C119 54, 119 61, 124 64 Z" strokeWidth="0.75" fill="var(--surface)" fillOpacity="0.75" opacity="0.85" />
        <path d="M122 45 C128 42, 125 34, 118 36 C114 38, 116 45, 122 45 Z" strokeWidth="0.75" fill="var(--surface)" fillOpacity="0.75" opacity="0.85" />
        <path d="M110 29 C116 25, 110 18, 104 21 C100 24, 103 30, 110 29 Z" strokeWidth="0.75" fill="var(--surface)" fillOpacity="0.75" opacity="0.85" />
        <path d="M92 18 C96 13, 88 8, 84 12 C82 16, 86 20, 92 18 Z" strokeWidth="0.75" fill="var(--surface)" fillOpacity="0.75" opacity="0.85" />

        {/* Right Berries & Beads */}
        <circle cx="92" cy="98" r="1.1" fill={color} opacity="0.75" stroke="none" />
        <circle cx="110" cy="86" r="1.1" fill={color} opacity="0.75" stroke="none" />
        <circle cx="125" cy="71" r="1.1" fill={color} opacity="0.75" stroke="none" />
        <circle cx="126" cy="40" r="1.1" fill={color} opacity="0.75" stroke="none" />
        <circle cx="115" cy="24" r="1.1" fill={color} opacity="0.75" stroke="none" />
        <circle cx="97" cy="13" r="1.1" fill={color} opacity="0.75" stroke="none" />

        {/* TOP APEX: Ribbon Bow & Sparkle */}
        <path d="M70 11 C67 7, 61 7, 63 11 C65 14, 69 13, 70 12" strokeWidth="0.9" opacity="0.8" />
        <path d="M70 11 C73 7, 79 7, 77 11 C75 14, 71 13, 70 12" strokeWidth="0.9" opacity="0.8" />
        <circle cx="70" cy="11.5" r="1.6" fill={color} stroke="none" opacity="0.85" />
        <path d="M69 13 C67 17, 63 19, 61 22" strokeWidth="0.7" opacity="0.7" />
        <path d="M71 13 C73 17, 77 19, 79 22" strokeWidth="0.7" opacity="0.7" />
        <path d="M70 3 C70 4.5, 70.8 5, 72 5 C70.8 5, 70 5.5, 70 7 C70 5.5, 69.2 5, 68 5 C69.2 5, 70 4.5, 70 3 Z" fill={color} stroke="none" opacity="0.7" />

        {/* BOTTOM APEX: Tied Knot & Rosette */}
        <circle cx="70" cy="103" r="1.8" fill={color} stroke="none" opacity="0.85" />
        <path d="M68 103 C65 106, 61 107, 59 109" strokeWidth="0.75" opacity="0.7" />
        <path d="M72 103 C75 106, 79 107, 81 109" strokeWidth="0.75" opacity="0.7" />
        <circle cx="58" cy="109" r="0.8" fill={color} stroke="none" opacity="0.7" />
        <circle cx="82" cy="109" r="0.8" fill={color} stroke="none" opacity="0.7" />
      </g>
    </svg>
  );
};
