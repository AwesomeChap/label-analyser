import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';

/**
 * Image classes for common layouts. Overlays use object-fit math, so cover/contain both align.
 */
export const IMAGE_WITH_BOXES_IMG_FULLSCREEN = 'max-h-[85dvh] w-auto max-w-full object-contain';
/** Intrinsic / shrink-wrap layout inside a padded flex row (thumbnails). */
export const IMAGE_WITH_BOXES_IMG_DETAILS = 'max-h-full max-w-full w-auto object-contain';
export const IMAGE_WITH_BOXES_IMG_THUMB = 'max-h-full max-w-full w-auto object-contain';

/** Where the bitmap is drawn inside the img element’s CSS box (for object-fit contain/cover/fill). */
function getFittedImageRect(containerW, containerH, naturalW, naturalH, objectFit) {
  if (!naturalW || !naturalH || !containerW || !containerH) {
    return { x: 0, y: 0, w: containerW, h: containerH };
  }
  const ir = naturalW / naturalH;
  const cr = containerW / containerH;

  if (objectFit === 'cover') {
    let w;
    let h;
    if (cr > ir) {
      w = containerW;
      h = w / ir;
    } else {
      h = containerH;
      w = h * ir;
    }
    return { x: (containerW - w) / 2, y: (containerH - h) / 2, w, h };
  }

  if (objectFit === 'contain') {
    let w;
    let h;
    if (cr > ir) {
      h = containerH;
      w = h * ir;
    } else {
      w = containerW;
      h = w / ir;
    }
    return { x: (containerW - w) / 2, y: (containerH - h) / 2, w, h };
  }

  // fill, none, scale-down, etc. — stretch / full box
  return { x: 0, y: 0, w: containerW, h: containerH };
}

export function ImageWithBoxes({
  imageUrl,
  textBlocks,
  className = '',
  imgClassName = '',
  buttonClassName = '',
  onClick,
  /** Fill parent (h-full w-full): image is inset-0 + object-contain so bitmap is centered; overlay math unchanged. */
  fillContainer = false,
}) {
  const [layout, setLayout] = useState(null);
  const imgRef = useRef(null);

  const hasImage = imageUrl && typeof imageUrl === 'string' && imageUrl.trim() !== '';

  const measure = useCallback(() => {
    const el = imgRef.current;
    if (!el || !el.naturalWidth || !el.naturalHeight) return;
    const cw = el.offsetWidth;
    const ch = el.offsetHeight;
    const nw = el.naturalWidth;
    const nh = el.naturalHeight;
    const fitMode = (typeof getComputedStyle === 'function' && getComputedStyle(el).objectFit) || 'fill';
    const rect = getFittedImageRect(cw, ch, nw, nh, fitMode);
    setLayout({
      nw,
      nh,
      ox: rect.x,
      oy: rect.y,
      ow: rect.w,
      oh: rect.h,
    });
  }, []);

  useLayoutEffect(() => {
    setLayout(null);
    const id = requestAnimationFrame(() => measure());
    return () => cancelAnimationFrame(id);
  }, [imageUrl, measure]);

  useEffect(() => {
    const el = imgRef.current;
    if (!el || !hasImage) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasImage, imageUrl, measure]);

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
    layout && blocks.length > 0
      ? blocks
          .map((b) => {
            const bbox = normalizeBbox(b.bbox, layout.nw, layout.nh);
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

  const imgClasses = fillContainer
    ? `absolute inset-0 block h-full w-full object-contain object-center ${imgClassName}`.trim()
    : imgClassName.trim()
      ? `block ${imgClassName}`.trim()
      : 'block max-w-full h-auto w-full';

  const rootClass = fillContainer
    ? `relative h-full w-full min-h-0 min-w-0 overflow-hidden ${className}`.trim()
    : `relative inline-block max-w-full min-h-0 align-middle ${className}`.trim();

  const content = (
    <div className={rootClass}>
      <img
        ref={imgRef}
        src={imageUrl}
        alt="Label"
        className={imgClasses}
        onLoad={measure}
      />
      {layout && validBlocks.length > 0 && (
        <div
          className="absolute pointer-events-none z-[1]"
          style={{
            left: layout.ox,
            top: layout.oy,
            width: layout.ow,
            height: layout.oh,
          }}
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
    const btnLayout = fillContainer
      ? 'block h-full w-full min-h-0 min-w-0'
      : 'flex w-full justify-center items-center';
    return (
      <button
        type="button"
        className={`${btnLayout} rounded-xl overflow-hidden border border-transparent hover:border-accent/30 focus:outline-none focus:ring-2 focus:ring-accent/50 transition-colors cursor-pointer ${buttonClassName}`.trim()}
        onClick={() => onClick(imageUrl, validBlocks.length ? blocks : [])}
      >
        {content}
      </button>
    );
  }
  return content;
}
