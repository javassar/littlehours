import React from 'react';

export interface IllustrationProps {
  size?: number;
  width?: number;
  height?: number;
  color?: string;
  className?: string;
  opacity?: number;
  celestial?: boolean;
}

export const Swan: React.FC<IllustrationProps> = ({
  size,
  width = 84,
  height = 68,
  color = 'var(--rose-deep)',
  opacity = 0.85,
  className = '',
  celestial = false,
}) => {
  const w = size || width;
  const h = size || height;

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 100 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      style={{ opacity, display: 'inline-block' }}
    >
      {/* Antique storybook engraved swan with layered feathers and filigree ripples */}
      <g stroke={color} fill="none" strokeLinecap="round" strokeLinejoin="round">
        
        {/* === 1. HEAD, BILL & EYE === */}
        {/* Curved beak */}
        <path d="M21 23 C24 22.2, 28 21.6, 31 21.2" strokeWidth="1.3" />
        <path d="M21 23 C24.5 23.8, 28 23.5, 30.5 22.8" strokeWidth="1.0" />
        {/* Mouth crease / gape line */}
        <path d="M23 22.8 L29 22.3" strokeWidth="0.75" opacity="0.85" />
        {/* Characteristic basal knob / mask */}
        <path
          d="M31 21.2 C31.5 19.8, 33 19, 34 19.2 C34.8 19.4, 35 20.4, 34.5 21.5 C33.8 22.4, 32 22.8, 30.5 22.8"
          strokeWidth="1.1"
          fill={color}
          fillOpacity="0.22"
        />
        {/* Forehead & crown */}
        <path d="M34 19.2 C35.5 17.5, 38 17.2, 40 18.2 C42 19.2, 43 21, 42.5 23" strokeWidth="1.3" />
        {/* Chin & throat */}
        <path d="M30.5 22.8 C32 24, 33.5 24.5, 35 24.2" strokeWidth="1.1" />
        {/* Eye: delicate antique ring with center pupil */}
        <circle cx="34.8" cy="20.2" r="1.1" strokeWidth="0.8" fill="#FFF8F5" />
        <circle cx="34.8" cy="20.2" r="0.6" fill={color} stroke="none" />
        {/* Fine brow contour */}
        <path d="M33.5 18.8 C35 18.4, 36.5 18.8, 37 19.4" strokeWidth="0.65" opacity="0.7" />

        {/* === 2. S-CURVED NECK (Romantic, sweeping curvature) === */}
        {/* Back of neck: gentle arching sweep */}
        <path
          d="M42.5 23 C44 26, 45 30, 44.5 35 C43.8 40.5, 41 46, 42 51 C42.6 53.8, 44.5 56, 47 57.5"
          strokeWidth="1.4"
        />
        {/* Front of neck: graceful parallel contour */}
        <path
          d="M35 24.2 C36.5 28, 37 32, 36 36.5 C34.5 42, 31 46.5, 29.5 50.5 C28.5 53.5, 29 56.5, 31.5 59"
          strokeWidth="1.3"
        />
        {/* Fine internal neck feather etching / plumage shading */}
        <path d="M41 27 C42 29, 42.5 32, 42 35" strokeWidth="0.75" opacity="0.55" />
        <path d="M39.5 31 C40.2 33.5, 40.5 36.5, 39.8 39.5" strokeWidth="0.7" opacity="0.5" />
        <path d="M37.5 36 C38 39, 37.8 42, 36.5 45" strokeWidth="0.7" opacity="0.5" />
        <path d="M35 42 C35.2 44.5, 34.5 47, 33 49.5" strokeWidth="0.7" opacity="0.5" />

        {/* === 3. BREAST & UNDERBELLY === */}
        {/* Proud swelling breast curve */}
        <path d="M31.5 59 C34 62, 39 63.5, 45 63.5 C55 63.5, 68 63, 76 60.5" strokeWidth="1.4" />
        {/* Soft breast down-feather etching */}
        <path d="M34 56 C36 58, 39 59.5, 43 60" strokeWidth="0.8" opacity="0.6" />
        <path d="M37 53.5 C39.5 55.5, 43 56.8, 47 57" strokeWidth="0.75" opacity="0.5" />
        <path d="M41 51 C43.5 52.8, 47 54, 51 54" strokeWidth="0.7" opacity="0.45" />

        {/* === 4. LAYERED, RAISED WINGS & FEATHER PLUMES === */}
        {/* Wing shoulder ridge */}
        <path d="M47 57.5 C46.5 54, 48 49, 51 45 C54 41, 58 37, 63 34" strokeWidth="1.3" />
        {/* Upper wing crest: layered feather tips */}
        <path d="M63 34 C64.5 33, 67 32.5, 68.5 33.5 C68 35, 66 37, 64 38.5" strokeWidth="1.2" />
        <path d="M68.5 33.5 C70.5 32.8, 73 32.5, 74.5 34 C73.8 35.8, 71.5 38, 69 39.5" strokeWidth="1.2" />
        <path d="M74.5 34 C77 33.5, 79.5 34, 80.5 36 C79.5 38, 76.5 40.5, 73.5 42" strokeWidth="1.2" />
        {/* Primary flight feather sweep arching to tail */}
        <path d="M80.5 36 C83 36.5, 85.5 38, 86 40.5 C85 43, 81.5 45.5, 77 47" strokeWidth="1.2" />
        <path d="M86 40.5 C87.8 42, 89 44.5, 88.5 47 C86.5 49.5, 82 52, 77 53.5" strokeWidth="1.2" />
        {/* Tail retrices: graceful feathery tuft */}
        <path
          d="M88.5 47 C90.5 48.5, 92 51, 91 53.5 C89 55.5, 84 57.5, 78 58.5 C77.5 59.5, 77 60, 76 60.5"
          strokeWidth="1.3"
        />
        <path d="M91 53.5 C92.2 55, 91.8 57, 89.5 58 C86 59.2, 81.5 60, 76 60.5" strokeWidth="1.0" opacity="0.8" />

        {/* Middle Covert Plumes (Scalloped feather layers) */}
        <path
          d="M52 46 C54 44.5, 57 44.5, 59 46.5 C61 44.8, 64 45, 66 47 C68 45.5, 71 45.8, 73 48"
          strokeWidth="0.95"
          opacity="0.85"
        />
        <path
          d="M50 50 C52.5 48, 56 48.5, 58 51 C60.5 49, 64 49.5, 66 52 C68.5 50.5, 72 51, 74 53.5"
          strokeWidth="0.95"
          opacity="0.85"
        />
        <path
          d="M49 54 C52 52.5, 55.5 53, 58 55.5 C61 53.8, 65 54.5, 68 57 C71 55.5, 74.5 56.5, 76.5 59"
          strokeWidth="0.9"
          opacity="0.8"
        />

        {/* Fine feather quill striations & cross-hatching (Etching detail) */}
        <g strokeWidth="0.65" opacity="0.6">
          <path d="M60 38 L65 35" />
          <path d="M64 41 L70 36" />
          <path d="M68 44 L75 37" />
          <path d="M72 47 L80 40" />
          <path d="M75 50 L84 44" />
          <path d="M78 54 L86 48" />
          <path d="M54 48 C57 47, 60 48, 62 50" />
          <path d="M61 52 C64 51, 67 52, 69 54" />
          <path d="M58 56 C61 55, 65 56, 68 58" />
        </g>

        {/* === 5. CONCENTRIC WATER RIPPLES === */}
        {/* Primary concentric water ellipse */}
        <path
          d="M16 63.5 C24 61.8, 44 61.2, 64 62 C74 62.4, 82 63.5, 84 64.5 C84 65.5, 76 66.8, 64 67.2 C44 67.8, 24 67.2, 16 65.5 C14 65, 14 64, 16 63.5 Z"
          strokeWidth="1.0"
          opacity="0.75"
        />
        {/* Secondary wider ripple */}
        <path
          d="M22 68 C34 69.5, 52 70, 70 69 C78 68.5, 82 67.5, 85 66.5"
          strokeWidth="0.85"
          opacity="0.6"
        />
        {/* Tertiary delicate front ripple */}
        <path d="M12 66 C18 68, 28 69.5, 40 70" strokeWidth="0.8" opacity="0.55" />
        {/* Gentle lower wave echo */}
        <path d="M32 72.5 C42 73.8, 54 73.8, 64 72.5" strokeWidth="0.7" opacity="0.5" />

        {/* === 6. BOTANICAL SPRIGS & STORYBOOK SCROLLWORK === */}
        {/* Left filigree scroll tendril (echoes card corner flourish) */}
        <path
          d="M14 64 C10 63.5, 7 61.5, 7 59 C7 56.5, 9.5 55, 12 56 C14 57, 14.5 59.5, 12.8 61 C11.5 62, 9.5 61.5, 9 60"
          strokeWidth="0.85"
          opacity="0.8"
        />
        {/* Left micro-leaf sprig */}
        <path
          d="M8.5 63 C6 64.5, 5 67, 6 69 C8 69, 10 67.5, 10.5 65.5"
          strokeWidth="0.75"
          opacity="0.75"
        />
        {/* Tiny water droplet bead on left curl */}
        <circle cx="12" cy="58" r="0.8" fill={color} stroke="none" opacity="0.7" />

        {/* Right filigree scroll tendril */}
        <path
          d="M84 64.5 C88 64, 91.5 62.5, 92 60 C92.5 57.5, 90 55.5, 87.5 56.2 C85.5 57, 85 59.5, 86.5 61.2 C87.8 62.2, 90 62, 90.5 60.5"
          strokeWidth="0.85"
          opacity="0.8"
        />
        {/* Right micro-leaf sprig */}
        <path
          d="M88 64 C90.5 65.5, 92 68, 91 70 C89 70, 87 68.5, 86 66"
          strokeWidth="0.75"
          opacity="0.75"
        />
        {/* Tiny water droplet bead on right curl */}
        <circle cx="88" cy="58.2" r="0.8" fill={color} stroke="none" opacity="0.7" />

        {/* Delicate 4-point fairy-tale sparkles on the water */}
        {/* Sparkle Left (at 18, 59) */}
        <path
          d="M18 56 C18 58, 19 59, 21 59 C19 59, 18 60, 18 62 C18 60, 17 59, 15 59 C17 59, 18 58, 18 56 Z"
          fill={color}
          stroke="none"
          opacity="0.6"
        />
        {/* Sparkle Right (at 80, 58) */}
        <path
          d="M80 55.5 C80 57.2, 80.8 58, 82.5 58 C80.8 58, 80 58.8, 80 60.5 C80 58.8, 79.2 58, 77.5 58 C79.2 58, 80 57.2, 80 55.5 Z"
          fill={color}
          stroke="none"
          opacity="0.55"
        />
        {/* Micro-sparkle floating droplets near breast */}
        <circle cx="27" cy="66.5" r="0.65" fill={color} stroke="none" opacity="0.5" />
        <circle cx="73" cy="66" r="0.65" fill={color} stroke="none" opacity="0.5" />
      </g>

      {/* === 7. CELESTIAL CRESCENT MOON & STARS (Optional ethereal woodland storybook sky) === */}
      {celestial && (
        <g className="swan-celestial" strokeLinecap="round" strokeLinejoin="round">
          {/* Slender Crescent Moon hovering above the wings */}
          <path
            d="M71 6 C76 10, 78 17, 74 23 C71 27, 66 28, 63 28 C68 29, 74 27, 77 22 C80 16, 78 9, 71 6 Z"
            strokeWidth="0.85"
            stroke={color}
            fill="var(--gold)"
            fillOpacity="0.22"
          />
          {/* Fine inner crescent contour line (etched look) */}
          <path
            d="M72 8.5 C75.5 12, 76.5 17, 73.5 21"
            strokeWidth="0.6"
            stroke={color}
            opacity="0.6"
          />

          {/* Tiny 4-point star 1 (Upper right of moon, at 83, 9) */}
          <path
            d="M83 6 C83 7.8, 83.8 8.5, 85.5 8.5 C83.8 8.5, 83 9.2, 83 11 C83 9.2, 82.2 8.5, 80.5 8.5 C82.2 8.5, 83 7.8, 83 6 Z"
            fill="var(--gold)"
            stroke="none"
            opacity="0.9"
          />

          {/* Tiny 4-point star 2 (To the left of moon, hovering above neck, at 58, 11) */}
          <path
            d="M58 9 C58 10.3, 58.6 10.8, 60 10.8 C58.6 10.8, 58 11.3, 58 12.6 C58 11.3, 57.4 10.8, 56 10.8 C57.4 10.8, 58 10.3, 58 9 Z"
            fill="var(--gold)"
            stroke="none"
            opacity="0.8"
          />

          {/* Tiny 4-point star 3 (Lower right of moon, at 87, 21) */}
          <path
            d="M87 19 C87 20.2, 87.5 20.7, 88.8 20.7 C87.5 20.7, 87 21.2, 87 22.4 C87 21.2, 86.5 20.7, 85.2 20.7 C86.5 20.7, 87 20.2, 87 19 Z"
            fill="var(--gold)"
            stroke="none"
            opacity="0.75"
          />

          {/* Micro celestial stardust dots */}
          <circle cx="78" cy="5" r="0.6" fill="var(--gold)" opacity="0.6" stroke="none" />
          <circle cx="64" cy="7" r="0.5" fill="var(--gold)" opacity="0.5" stroke="none" />
          <circle cx="90" cy="14" r="0.5" fill="var(--gold)" opacity="0.5" stroke="none" />
        </g>
      )}
    </svg>
  );
};
