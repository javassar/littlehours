import React, { useState } from 'react';
import {
  Button,
  Card,
  Chip,
  Toast,
  SparkleBurst,
  RotatingSparkle,
  Swan,
  DoubleSwans,
  Deer,
  Hummingbird,
  FlowerSprig,
  Sparkle,
  PainRating,
} from '../components';

export const DesignPage: React.FC = () => {
  const [toastVisible, setToastVisible] = useState(false);
  const [sparkleActive, setSparkleActive] = useState(false);
  const [designPain, setDesignPain] = useState<number | null>(3);

  const colors = [
    { token: '--bg', hex: '#EBD9D6', name: 'Page Background' },
    { token: '--bg-deep', hex: '#EBD9D6', name: 'Gradient Deep' },
    { token: '--surface', hex: '#FBF6F3', name: 'Cream Surface' },
    { token: '--surface-sunk', hex: '#F3E6E3', name: 'Sunk Input Surface' },
    { token: '--rose', hex: '#D9A5AE', name: 'Primary Rose' },
    { token: '--rose-deep', hex: '#B8727F', name: 'Rose Deep Accent' },
    { token: '--mauve', hex: '#8E6B7A', name: 'Mauve Secondary' },
    { token: '--ink', hex: '#4B3340', name: 'Ink Primary Text' },
    { token: '--sage', hex: '#A9B29B', name: 'Sage Green' },
    { token: '--slate', hex: '#8C9BB5', name: 'Slate Blue' },
    { token: '--lavender', hex: '#C9BBD6', name: 'Lavender Tint' },
    { token: '--gold', hex: '#D4B483', name: 'Gold Sparkle' },
    { token: '--danger', hex: '#A8505E', name: 'Danger Text' },
  ];

  const categories = [
    'work', 'job search', 'phone and social media', 'sleep',
    'exercise', 'meals', 'chores', 'social time', 'reading',
    'entertainment', 'travel', 'personal care', 'errands', 'rest'
  ];

  const handleTriggerSave = () => {
    setSparkleActive(true);
    setToastVisible(true);
    setTimeout(() => {
      setSparkleActive(false);
    }, 1500);
  };

  return (
    <div className="page-container screen-fade-in design-page">
      <Toast visible={toastVisible} onClose={() => setToastVisible(false)} />

      <div className="design-intro">
        <h2 className="screen-heading">Design System & Tokens</h2>
        <p className="design-subtitle">Soft pink storybook design reference</p>
      </div>

      {/* 1. Color Tokens */}
      <section className="design-section">
        <h3 className="section-title">Color Tokens</h3>
        <div className="color-grid">
          {colors.map((c) => (
            <div key={c.token} className="color-swatch-card">
              <div
                className="color-swatch"
                style={{ backgroundColor: `var(${c.token})` }}
              />
              <div className="color-info">
                <span className="color-token">{c.token}</span>
                <span className="color-hex">{c.hex}</span>
                <span className="color-name">{c.name}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Typography */}
      <section className="design-section">
        <h3 className="section-title">Typography</h3>
        <Card className="type-card">
          <div className="type-item">
            <span className="type-label">Display 600 (Cormorant Garamond)</span>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 32 }}>
              Little Hours
            </h1>
          </div>
          <div className="type-item" style={{ marginTop: 14 }}>
            <span className="type-label">Display 500 Italic (Day heading & prompt)</span>
            <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 500, fontSize: 24 }}>
              I was reading a fairy tale, then worked on the garden...
            </div>
          </div>
          <div className="type-item" style={{ marginTop: 14 }}>
            <span className="type-label">Body (Lora 17px, line height 1.55)</span>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-size)', lineHeight: 'var(--text-body-line-height)' }}>
              A quiet personal record of how time passes. Every minute belongs to one activity, written naturally as the day unfolds.
            </p>
          </div>
        </Card>
      </section>

      {/* 3. Buttons */}
      <section className="design-section">
        <h3 className="section-title">Buttons</h3>
        <div className="button-group">
          <div style={{ position: 'relative', width: '100%' }}>
            <Button fullWidth onClick={handleTriggerSave}>
              Primary Button (Test Save & Sparkles)
            </Button>
            <SparkleBurst active={sparkleActive} />
          </div>

          <Button variant="secondary" fullWidth>
            Secondary Button
          </Button>

          <Button variant="destructive" fullWidth>
            Destructive Button
          </Button>

          <Button disabled fullWidth>
            Primary Disabled
          </Button>
        </div>
      </section>

      {/* 4. Sunk Inputs */}
      <section className="design-section">
        <h3 className="section-title">Letterpress Sunk Inputs</h3>
        <Card>
          <label className="form-label" htmlFor="design-input">Entry Input</label>
          <textarea
            id="design-input"
            className="time-log-textarea"
            rows={3}
            placeholder="Type your notes here..."
            defaultValue="Read two chapters of a novel, then took a walk through the quiet garden."
          />
        </Card>
      </section>

      {/* 5. Cards & Ornamental Frame */}
      <section className="design-section">
        <h3 className="section-title">Cards & Ornamental Frame</h3>
        <Card className="mb-4">
          <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 6 }}>
            Standard Embossed Card
          </h4>
          <p style={{ fontSize: 15, color: 'var(--ink)' }}>
            Embossed cream surface with soft rose drop shadow and white inner bevel highlight.
          </p>
        </Card>

        <Card ornamental={true}>
          <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 6 }}>
            Ornamental Framed Card
          </h4>
          <p style={{ fontSize: 15, color: 'var(--ink)' }}>
            Double 1px rose-deep border with 4px gap and four inline SVG scrollwork corner flourishes.
          </p>
        </Card>
      </section>

      {/* 6. Chips across 5 Tints */}
      <section className="design-section">
        <h3 className="section-title">Category Chips (14 Categories across 5 Tints)</h3>
        <div className="chips-wrap">
          {categories.map((cat) => (
            <Chip key={cat} label={cat} />
          ))}
        </div>
      </section>

      {/* 6.5. Pain Rating Control (Milestone 3.7) */}
      <section className="design-section">
        <h3 className="section-title">Hourly Pain Rating Control</h3>
        <Card>
          <p style={{ fontSize: 14, color: 'var(--mauve)', marginBottom: 12 }}>
            Average pain over the past hour on a 1 to 5 scale, with scale anchors guide.
          </p>
          <PainRating value={designPain} onChange={setDesignPain} />
        </Card>
      </section>

      {/* 7. Storybook SVG Illustrations */}
      <section className="design-section">
        <h3 className="section-title">Inline SVG Illustrations</h3>
        <div className="illustrations-grid">
          <div className="illustration-box">
            <DoubleSwans width={96} height={60} />
            <span className="illustration-title">Paired Swans</span>
            <span className="illustration-desc">Login header mark</span>
          </div>

          <div className="illustration-box">
            <Swan size={74} celestial={true} />
            <span className="illustration-title">Celestial Swan</span>
            <span className="illustration-desc">Storybook mark</span>
          </div>

          <div className="illustration-box">
            <Deer size={80} />
            <span className="illustration-title">Deer</span>
            <span className="illustration-desc">Empty history</span>
          </div>

          <div className="illustration-box">
            <Hummingbird size={70} />
            <span className="illustration-title">Hummingbird</span>
            <span className="illustration-desc">Settings footer</span>
          </div>

          <div className="illustration-box">
            <FlowerSprig size={70} />
            <span className="illustration-title">Flower Sprig</span>
            <span className="illustration-desc">Storybook accent</span>
          </div>

          <div className="illustration-box">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Sparkle size={24} color="var(--gold)" />
              <RotatingSparkle size={24} color="var(--gold)" />
            </div>
            <span className="illustration-title">Four-Point Sparkle</span>
            <span className="illustration-desc">Static & rotating loading state</span>
          </div>
        </div>
      </section>

      {/* 8. Reduced Motion & Accessibility note */}
      <section className="design-section" style={{ marginBottom: 32 }}>
        <h3 className="section-title">Reduced Motion</h3>
        <Card>
          <p style={{ fontSize: 14, color: 'var(--mauve)', lineHeight: 1.6 }}>
            When <code>prefers-reduced-motion: reduce</code> is toggled in your operating system or browser developer tools, all continuous animations (such as the rotating sparkle and floating sparkles) stop, and transitions are clamped to 100ms or less.
          </p>
        </Card>
      </section>
    </div>
  );
};
