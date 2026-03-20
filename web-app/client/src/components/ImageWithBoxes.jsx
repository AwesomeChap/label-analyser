import { useState, useRef } from 'react';

export function ImageWithBoxes({ imageUrl, textBlocks, className = '', imgClassName = '', buttonClassName = '', onClick }) {
  const [dimensions, setDimensions] = useState(null);
  const imgRef = useRef(null);

  const hasImage = imageUrl && typeof imageUrl === 'string' && imageUrl.trim() !== '';

  const onLoad = () => {
    if (imgRef.current) {
      const { naturalWidth, naturalHeight, offsetWidth, offsetHeight } = imgRef.current;
      setDimensions({ w: offsetWidth, h: offsetHeight, nw: naturalWidth, nh: naturalHeight });
    }
  };

  function normalizeBbox(bbox, naturalWidth, naturalHeight) {
    if (!Array.isArray(bbox) || bbox.length !== 4) return null;
    const nums = bbox.map((n) => Number(n));
    if (nums.some((n) => Number.isNaN(n))) return null;
    let [a, b, c, d] = nums;
    const hasPixelCoords = naturalWidth > 0 && naturalHeight > 0 && Math.max(a, b, c, d) > 1;
    let xMin, yMin, xMax, yMax;
    if (hasPixelCoords) {
      const likelyWidthHeight = c > 0 && d > 0 && c <= naturalWidth && d <= naturalHeight && c < a && d < b;
      if (likelyWidthHeight) {
        xMin = a / naturalWidth;
        yMin = b / naturalHeight;
        xMax = (a + c) / naturalWidth;
        yMax = (b + d) / naturalHeight;
      } else {
        xMin = a / naturalWidth;
        yMin = b / naturalHeight;
        xMax = c / naturalWidth;
        yMax = d / naturalHeight;
      }
    } else {
      xMin = a;
      yMin = b;
      xMax = c;
      yMax = d;
    }
    xMin = Math.max(0, Math.min(1, xMin));
    yMin = Math.max(0, Math.min(1, yMin));
    xMax = Math.max(0, Math.min(1, xMax));
    yMax = Math.max(0, Math.min(1, yMax));
    if (xMin > xMax) [xMin, xMax] = [xMax, xMin];
    if (yMin > yMax) [yMin, yMax] = [yMax, yMin];
    if (xMax <= xMin || yMax <= yMin) return null;
    return [xMin, yMin, xMax, yMax];
  }

  const blocks = Array.isArray(textBlocks) ? textBlocks : [];
  const validBlocks =
    dimensions && blocks.length > 0
      ? blocks
          .map((b) => {
            const bbox = normalizeBbox(b.bbox, dimensions.nw, dimensions.nh);
            const polygon =
              Array.isArray(b.polygon) && b.polygon.length >= 3
                ? b.polygon
                    .map((p) => (Array.isArray(p) && p.length >= 2 ? [Number(p[0]), Number(p[1])] : null))
                    .filter(Boolean)
                : null;
            return { ...b, bbox: bbox || (polygon ? [0, 0, 1, 1] : null), polygon };
          })
          .filter((b) => b.bbox != null || (b.polygon && b.polygon.length >= 3))
      : [];

  if (!hasImage) {
    return <span className={`text-muted text-sm ${className}`}>No image</span>;
  }

  const content = (
    <div className={`relative inline-block max-w-full ${className}`}>
      <img
        ref={imgRef}
        src={imageUrl}
        alt="Label"
        className={`max-w-full h-auto block ${imgClassName}`}
        onLoad={onLoad}
      />
      {dimensions && validBlocks.length > 0 && (
        <div
          className="absolute left-0 top-0 pointer-events-none"
          style={{ width: dimensions.w, height: dimensions.h }}
        >
          {validBlocks.map((block, i) => {
            if (block.polygon && block.polygon.length >= 3) {
              const pts = block.polygon.map(([x, y]) => `${x},${y}`).join(' ');
              return (
                <svg
                  key={i}
                  className="absolute left-0 top-0 w-full h-full"
                  style={{ color: 'var(--color-accent)' }}
                  viewBox="0 0 1 1"
                  preserveAspectRatio="none"
                >
                  <polygon
                    points={pts}
                    fill="currentColor"
                    fillOpacity={0.2}
                    stroke="currentColor"
                    strokeWidth={0.008}
                  />
                </svg>
              );
            }
            const [xMin, yMin, xMax, yMax] = block.bbox;
            return (
              <div
                key={i}
                className="absolute border-2 border-accent bg-accent/20 box-border"
                style={{
                  left: `${xMin * 100}%`,
                  top: `${yMin * 100}%`,
                  width: `${(xMax - xMin) * 100}%`,
                  height: `${(yMax - yMin) * 100}%`,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={`block w-full text-left rounded-xl overflow-hidden border border-transparent hover:border-accent/30 focus:outline-none focus:ring-2 focus:ring-accent/50 transition-colors cursor-pointer ${buttonClassName}`.trim()}
        onClick={() => onClick(imageUrl, validBlocks.length ? blocks : [])}
      >
        {content}
      </button>
    );
  }
  return content;
}
