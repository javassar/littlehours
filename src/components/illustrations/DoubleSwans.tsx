import React from 'react';

export interface DoubleSwansProps {
  size?: number;
  width?: number;
  height?: number;
  color?: string;
  sparkleColor?: string;
  className?: string;
  opacity?: number;
}

export const DoubleSwans: React.FC<DoubleSwansProps> = ({
  size,
  width = 154,
  height = 96,
  color = 'var(--rose-deep)',
  sparkleColor = 'var(--gold)',
  opacity = 0.95,
  className = '',
}) => {
  const w = size || width;
  const h = size ? Math.round(size * (96 / 154)) : height;

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 160 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      style={{ opacity, display: 'inline-block' }}
    >
      {/* 
        Grand, hand-drawn paired swans faithfully capturing the romantic sketch lines of image_22.png 
        and the natural, staggered heart-shaped composition of image_23.png:
        - Slender, flowing S-curve necks with smooth calligraphic sketch strokes
        - Characteristic wing-shoulder spiral whorls (@) from image_22
        - Upward-swept tiered flight plumes and inner covert feather scallops
        - Long sweeping waterlines ending in musical ribbon spiral flourishes
        - Staggered organic depth: Left swan sits slightly higher/back; Right swan nestled slightly forward/lower
        - Three sparse four-point celestial sparkles (✦) hovering softly above
      */}
      <g stroke={color} fill="none" strokeLinecap="round" strokeLinejoin="round">
        
        {/* =========================================================================
            LEFT SWAN (Higher, proud S-neck arching forward toward partner)
            ========================================================================= */}
        <g className="swan-left">
          {/* Bill (pointing gracefully down-right toward right partner) */}
          <path d="M74 22 C76.5 24.5, 79 26.5, 82 28 C80.5 29, 78.5 28.5, 77 27" strokeWidth="1.1" />
          <path d="M76.5 24.8 L75 25.5" strokeWidth="0.8" opacity="0.8" />
          {/* Bill basal contour line */}
          <path d="M74 22 C74.8 23.5, 75.5 25.5, 77 27" strokeWidth="0.85" opacity="0.75" />
          {/* Eye: delicate ring & center pupil */}
          <circle cx="70" cy="20.5" r="1.0" fill="#FFF8F5" stroke={color} strokeWidth="0.75" />
          <circle cx="70" cy="20.5" r="0.5" fill={color} stroke="none" />
          {/* Crown & Forehead (arches high at y: 15, graceful balletic curve like image_22) */}
          <path d="M74 22 C73 18.5, 69.5 15, 64.5 15 C58.5 15, 53.5 18.5, 51.5 23.5" strokeWidth="1.35" />

          {/* Romantic S-Curve Neck (sweeping fluid lines like image_22) */}
          {/* Outer neck line (back of neck) */}
          <path d="M51.5 23.5 C48 30, 50 38.5, 54 45.5 C57.5 51.5, 59.5 57, 58 63" strokeWidth="1.4" />
          {/* Inner neck line (front of neck) */}
          <path d="M77 27 C73.5 32, 67 39.5, 63.5 46 C60.5 52.5, 58 58, 54 64" strokeWidth="1.2" />

          {/* Breast curve swelling forward and down into underbelly */}
          <path d="M54 64 C50 69, 43 72, 33 71 C23 70, 15 65.5, 10 57" strokeWidth="1.35" />

          {/* Wing Shoulder Spiral Swirl (Key signature whorl from image_22) */}
          <path
            d="M51 55 C47.5 52, 42.5 53, 40.5 57 C38.5 61, 41.5 66, 46.5 66 C50.5 66, 53.5 62, 52 58.5 C50.5 56, 47 57, 46.5 59.5 C46 61.5, 48.5 62.5, 49.5 61"
            strokeWidth="1.1"
            opacity="0.85"
          />

          {/* Tiered Wing Plumes (swooping upward & back to the left, like image_22) */}
          {/* Primary top flight plume */}
          <path d="M49 50 C43 44, 34 36, 23 30.5 C26.5 35.5, 31.5 41, 37 45.5" strokeWidth="1.3" />
          {/* Second tiered plume tip */}
          <path d="M37 45.5 C30 41, 21 41, 15 42 C19.5 46.5, 25 50, 32 52.5" strokeWidth="1.1" />
          {/* Lower wing / tail feather line */}
          <path d="M32 52.5 C24 51.5, 16 53, 10 57" strokeWidth="1.0" />
          {/* Scalloped covert feather arcs inside wing (image_22) */}
          <path d="M44 48 C39 48, 33 51, 28 55" strokeWidth="0.85" opacity="0.65" />
          <path d="M40 53 C35.5 54, 30.5 56.5, 27 60" strokeWidth="0.8" opacity="0.6" />

          {/* Calligraphic Base Water Ripple with End Spiral Flourish (image_22) */}
          <path d="M8 72 C19 69, 36 68.5, 56 70 C63 70.5, 69 71.5, 72 73" strokeWidth="1.15" opacity="0.8" />
          <path d="M8 72 C5 72.8, 3.5 74.8, 5 76.8 C6.8 78.8, 11 77.5, 12.2 74.8 C13.2 72, 11.5 70, 8.8 70.8" strokeWidth="0.95" opacity="0.75" />
        </g>


        {/* =========================================================================
            RIGHT SWAN (Intimately bowed, nestled forward & lower, based on image_22)
            ========================================================================= */}
        <g className="swan-right">
          {/* Head & Beak (Lower, head nestled affectionately, gesturing up-left toward Left Swan) */}
          {/* Bill pointing gently up-left toward left partner's chin */}
          <path d="M86 27 C84 28.5, 82 30, 80 31.5 C82 32.5, 84.5 32, 86.5 31" strokeWidth="1.1" />
          <path d="M84 29.5 L85.5 30" strokeWidth="0.8" opacity="0.8" />
          {/* Bill basal contour line */}
          <path d="M86 27 C86.8 28.5, 87 30.5, 86.5 31" strokeWidth="0.85" opacity="0.75" />
          {/* Eye */}
          <circle cx="90" cy="25.5" r="1.0" fill="#FFF8F5" stroke={color} strokeWidth="0.75" />
          <circle cx="90" cy="25.5" r="0.5" fill={color} stroke="none" />
          {/* Crown & Forehead (nestled lower at y: 20.5, soft affectionate curvature) */}
          <path d="M86 27 C87.5 23.5, 91 20.5, 96 20.5 C101.5 20.5, 106 24, 108 29" strokeWidth="1.35" />

          {/* S-Curve Neck (bowed gently toward left partner, nestled closer) */}
          {/* Outer neck line (back of neck) */}
          <path d="M108 29 C111 35.5, 108 44, 104 50.5 C100.5 55.5, 98.5 61, 100.5 66.5" strokeWidth="1.4" />
          {/* Inner neck line (front of neck) */}
          <path d="M86.5 31 C89.5 36, 96 42.5, 99 48.5 C101.5 54.5, 103.5 60, 107 65.5" strokeWidth="1.2" />

          {/* Breast curve swelling forward and down into underbelly (shifted slightly lower for depth) */}
          <path d="M107 65.5 C110 70.5, 117 73, 127 72 C137 71, 145 66.5, 150 58" strokeWidth="1.35" />

          {/* Wing Shoulder Spiral Swirl (mirrored whorl from image_22) */}
          <path
            d="M109 57 C112.5 54, 117.5 55, 119.5 59 C121.5 63, 118.5 68, 113.5 68 C109.5 68, 106.5 64, 108 60.5 C109.5 58, 113 59, 113.5 61.5 C114 63.5, 111.5 64.5, 110.5 63"
            strokeWidth="1.1"
            opacity="0.85"
          />

          {/* Tiered Wing Plumes (swooping upward & back to the right) */}
          {/* Primary top flight plume */}
          <path d="M111 52 C117 46, 126 38, 137 32.5 C133.5 37.5, 128.5 43, 123 47.5" strokeWidth="1.3" />
          {/* Second tiered plume tip */}
          <path d="M123 47.5 C130 43, 139 43, 145 44 C140.5 48.5, 135 52, 128 54.5" strokeWidth="1.1" />
          {/* Lower wing / tail feather line */}
          <path d="M128 54.5 C136 53.5, 144 55, 150 58" strokeWidth="1.0" />
          {/* Scalloped covert feather arcs inside wing (image_22) */}
          <path d="M116 50 C121 50, 127 53, 132 57" strokeWidth="0.85" opacity="0.65" />
          <path d="M120 55 C124.5 56, 129.5 58.5, 133 62" strokeWidth="0.8" opacity="0.6" />

          {/* Calligraphic Base Water Ripple with End Spiral Flourish (image_22) */}
          <path d="M88 74 C99 72, 119 71.5, 139 73 C146 73.5, 151 74.5, 153 76" strokeWidth="1.15" opacity="0.8" />
          <path d="M153 76 C156 76.8, 157.5 78.8, 156 80.8 C154.2 82.8, 150 81.5, 148.8 78.8 C147.8 76, 149.5 74, 152.2 74.8" strokeWidth="0.95" opacity="0.75" />
        </g>

        {/* Center Water Whispers connecting their bases gently */}
        <path d="M68 74 C74 75.5, 84 75.5, 90 74" strokeWidth="0.8" opacity="0.5" />
        <path d="M72 77 C77 78.2, 82 78.2, 87 77" strokeWidth="0.7" opacity="0.4" />
      </g>

      {/* =========================================================================
          THREE SPARSE FOUR-POINT CELESTIAL SPARKLES (✦)
          ========================================================================= */}
      <g className="swan-sparkles" fill={sparkleColor}>
        {/* Sparkle 1 (Center-top above heart space, at 78, 8) */}
        <path
          d="M78 4 C78 6.5, 79.2 7.5, 81.5 7.5 C79.2 7.5, 78 8.5, 78 11 C78 8.5, 76.8 7.5, 74.5 7.5 C76.8 7.5, 78 6.5, 78 4 Z"
          opacity="0.95"
        />
        {/* Sparkle 2 (Hovering above left swan's arching neck, at 59, 11) */}
        <path
          d="M59 8 C59 9.8, 59.8 10.5, 61.5 10.5 C59.8 10.5, 59 11.2, 59 13 C59 11.2, 58.2 10.5, 56.5 10.5 C58.2 10.5, 59 9.8, 59 8 Z"
          opacity="0.85"
        />
        {/* Sparkle 3 (Hovering above right swan's crown, at 99, 14) */}
        <path
          d="M99 11 C99 12.8, 99.8 13.5, 101.5 13.5 C99.8 13.5, 99 14.2, 99 16 C99 14.2, 98.2 13.5, 96.5 13.5 C98.2 13.5, 99 12.8, 99 11 Z"
          opacity="0.85"
        />
        {/* Micro stardust dots */}
        <circle cx="71" cy="7" r="0.75" opacity="0.65" />
        <circle cx="87" cy="9" r="0.65" opacity="0.6" />
        <circle cx="93" cy="13" r="0.65" opacity="0.6" />
      </g>
    </svg>
  );
};
