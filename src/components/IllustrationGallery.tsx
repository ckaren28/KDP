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

  // Keyboard navigation
  useEffect(() => {
    if (selectedIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedIndex(null);
      } else if (e.key === 'ArrowLeft') {
        goToPrevious();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      }
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
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">No illustrations match your filters.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {illustrations.map((illustration, index) => (
          <button
            key={index}
            onClick={() => setSelectedIndex(index)}
            className="group cursor-pointer focus:outline-none focus:ring-2 focus:ring-black rounded-lg"
          >
            <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
              <div className="aspect-[3/4] bg-gray-200 overflow-hidden select-none">
                <img
                  src={illustration.image}
                  alt={illustration.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                  loading="lazy"
                  draggable="false"
                  onContextMenu={(e) => e.preventDefault()}
                />
              </div>
              <div className="p-4">
                <h3 className="font-bold text-left group-hover:text-gray-600 transition-colors">
                  {illustration.title}
                </h3>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox Modal */}
      {selectedImage && selectedIndex !== null && (
        <div
          className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedIndex(null)}
        >
          {/* Close Button */}
          <button
            onClick={() => setSelectedIndex(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 text-4xl font-light w-12 h-12 flex items-center justify-center z-10"
            aria-label="Close"
          >
            ×
          </button>

          {/* Previous Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              goToPrevious();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 text-5xl font-light w-16 h-16 flex items-center justify-center z-10 hover:bg-white hover:bg-opacity-10 rounded-full transition-all"
            aria-label="Previous image"
          >
            ‹
          </button>

          {/* Next Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 text-5xl font-light w-16 h-16 flex items-center justify-center z-10 hover:bg-white hover:bg-opacity-10 rounded-full transition-all"
            aria-label="Next image"
          >
            ›
          </button>

          <div
            className="max-w-7xl w-full max-h-[90vh] flex flex-col md:flex-row gap-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image */}
            <div className="flex-1 flex items-center justify-center select-none">
              <img
                src={selectedImage.image}
                alt={selectedImage.title}
                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl pointer-events-none"
                draggable="false"
                onContextMenu={(e) => e.preventDefault()}
              />
            </div>

            {/* Info Panel */}
            <div className="md:w-96 bg-white rounded-lg p-6 overflow-y-auto max-h-[80vh]">
              <h2 className="text-2xl font-bold mb-4">{selectedImage.title}</h2>
              
              {selectedImage.description && (
                <div className="mb-6">
                  <p className="text-gray-700 leading-relaxed">{selectedImage.description}</p>
                </div>
              )}
              
              <div className="mb-6">
                <h3 className="font-bold text-sm text-gray-500 uppercase mb-2">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedImage.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  {selectedIndex + 1} of {illustrations.length}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Use arrow keys or buttons to navigate
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}