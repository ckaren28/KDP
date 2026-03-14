import { useState, useEffect } from 'react';

interface Illustration {
  title: string;
  image: string;
  tags: string[];
  description?: string;
}

interface Props {
  illustrations: Illustration[];
}

export default function IllustrationGallery({ illustrations }: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const selectedImage = selectedIndex !== null ? illustrations[selectedIndex] : null;

  useEffect(() => {
    if (selectedIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedIndex(null);
      else if (e.key === 'ArrowLeft') goToPrevious();
      else if (e.key === 'ArrowRight') goToNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, illustrations.length]);

  const goToPrevious = () => {
    if (selectedIndex === null) return;
    setSelectedIndex(selectedIndex === 0 ? illustrations.length - 1 : selectedIndex - 1);
  };

  const goToNext = () => {
    if (selectedIndex === null) return;
    setSelectedIndex(selectedIndex === illustrations.length - 1 ? 0 : selectedIndex + 1);
  };

  if (illustrations.length === 0) {
    return (
      <p style={{ color: 'var(--muted)', fontSize: '14px', letterSpacing: '0.06em', paddingTop: '48px' }}>
        No illustrations yet.
      </p>
    );
  }

  return (
    <>
      {/* Gallery Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '2px',
      }}>
        {illustrations.map((illustration, index) => (
          <button
            key={index}
            onClick={() => setSelectedIndex(index)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'none',
              textAlign: 'left',
            }}
          >
            <div style={{ overflow: 'hidden' }}>
              <div style={{
                aspectRatio: '3/4',
                overflow: 'hidden',
                background: 'var(--placeholder-bg)',
              }}>
                <img
                  src={illustration.image}
                  alt={illustration.title}
                  draggable={false}
                  onContextMenu={(e) => e.preventDefault()}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                    userSelect: 'none',
                    transition: 'transform 0.6s cubic-bezier(0.16,1,0.3,1), opacity 0.4s ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLImageElement).style.transform = 'scale(1.04)';
                    (e.currentTarget as HTMLImageElement).style.opacity = '0.85';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLImageElement).style.transform = 'scale(1)';
                    (e.currentTarget as HTMLImageElement).style.opacity = '1';
                  }}
                />
              </div>
              <div style={{ paddingTop: '12px' }}>
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '17px',
                  fontWeight: 300,
                  fontStyle: 'italic',
                  color: 'var(--black)',
                  lineHeight: 1.2,
                }}>
                  {illustration.title}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {selectedImage && selectedIndex !== null && (
        <div
          onClick={() => setSelectedIndex(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(24, 16, 10, 0.96)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          {/* Close */}
          <button
            onClick={(e) => { e.stopPropagation(); setSelectedIndex(null); }}
            aria-label="Close"
            style={{
              position: 'absolute', top: '24px', right: '32px',
              background: 'none', border: 'none',
              color: 'rgba(237,229,208,0.5)',
              fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase',
              cursor: 'pointer', zIndex: 210,
              transition: 'color 0.2s',
              fontFamily: 'var(--font-body)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(237,229,208,1)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(237,229,208,0.5)')}
          >
            Close ×
          </button>

          {/* Prev */}
          <button
            onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
            aria-label="Previous"
            style={{
              position: 'absolute', left: '24px', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none',
              color: 'rgba(237,229,208,0.4)',
              fontSize: '28px', cursor: 'pointer', zIndex: 210,
              transition: 'color 0.2s',
              fontFamily: 'var(--font-display)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(237,229,208,1)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(237,229,208,0.4)')}
          >
            ←
          </button>

          {/* Next */}
          <button
            onClick={(e) => { e.stopPropagation(); goToNext(); }}
            aria-label="Next"
            style={{
              position: 'absolute', right: '24px', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none',
              color: 'rgba(237,229,208,0.4)',
              fontSize: '28px', cursor: 'pointer', zIndex: 210,
              transition: 'color 0.2s',
              fontFamily: 'var(--font-display)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(237,229,208,1)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(237,229,208,0.4)')}
          >
            →
          </button>

          {/* Content */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              flexDirection: 'row',
              gap: '40px',
              maxWidth: '1200px',
              width: '100%',
              maxHeight: '90vh',
              alignItems: 'center',
            }}
          >
            {/* Image */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src={selectedImage.image}
                alt={selectedImage.title}
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
                style={{
                  maxWidth: '100%',
                  maxHeight: '82vh',
                  objectFit: 'contain',
                  userSelect: 'none',
                  display: 'block',
                }}
              />
            </div>

            {/* Info */}
            <div style={{
              width: '280px',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}>
              <h2 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '28px',
                fontWeight: 300,
                fontStyle: 'italic',
                color: 'var(--off-white)',
                lineHeight: 1.1,
              }}>
                {selectedImage.title}
              </h2>

              {selectedImage.description && (
                <p style={{
                  fontSize: '13px',
                  lineHeight: 1.75,
                  color: 'rgba(237,229,208,0.6)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 300,
                }}>
                  {selectedImage.description}
                </p>
              )}

              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
              }}>
                {selectedImage.tags.map((tag, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: '9px',
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      color: 'rgba(237,229,208,0.45)',
                      border: '1px solid rgba(237,229,208,0.15)',
                      padding: '4px 10px',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <p style={{
                fontSize: '10px',
                letterSpacing: '0.1em',
                color: 'rgba(237,229,208,0.25)',
                fontFamily: 'var(--font-body)',
                marginTop: 'auto',
                paddingTop: '20px',
                borderTop: '1px solid rgba(237,229,208,0.08)',
              }}>
                {selectedIndex + 1} / {illustrations.length}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
