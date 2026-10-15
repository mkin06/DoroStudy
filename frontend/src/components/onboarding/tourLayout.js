const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

// Flip the coachmark around its control before clamping to the viewport.
export function getTourLayout(rect, viewport, cardSize) {
  const margin = 12;
  const gap = 18;
  const viewportLeft = viewport.left || 0;
  const viewportTop = viewport.top || 0;
  const viewportRight = viewportLeft + viewport.width;
  const viewportBottom = viewportTop + viewport.height;
  const width = Math.min(cardSize.width, viewport.width - margin * 2);
  let height = Math.min(cardSize.height, viewport.height - margin * 2);
  if (!rect) return { spotlight: null, card: { left: viewportLeft + (viewport.width - width) / 2, top: viewportTop + (viewport.height - height) / 2 }, side: null, arrow: null };
  const left = clamp(rect.left - 7, viewportLeft, viewportRight);
  const top = clamp(rect.top - 7, viewportTop, viewportBottom);
  const right = clamp(rect.right + 7, left, viewportRight);
  const bottom = clamp(rect.bottom + 7, top, viewportBottom);
  const spotlight = { left, top, right, bottom, width: right - left, height: bottom - top };
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;
  const positions = [
    { side: 'bottom', left: centerX - width / 2, top: bottom + gap, fits: bottom + gap + height <= viewportBottom - margin },
    { side: 'top', left: centerX - width / 2, top: top - gap - height, fits: top - gap - height >= viewportTop + margin },
    { side: 'right', left: right + gap, top: centerY - height / 2, fits: right + gap + width <= viewportRight - margin },
    { side: 'left', left: left - gap - width, top: centerY - height / 2, fits: left - gap - width >= viewportLeft + margin },
  ];
  const chosen = positions.find((position) => position.fits) || positions.slice(0, 2).reduce((best, position) => {
    const clearance = { bottom: viewportBottom - bottom, top: top - viewportTop, right: viewportRight - right, left: left - viewportLeft };
    return clearance[position.side] > clearance[best.side] ? position : best;
  });
  const maxHeight = chosen.side === 'bottom' ? viewportBottom - bottom - gap - margin
    : chosen.side === 'top' ? top - viewportTop - gap - margin
      : viewport.height - margin * 2;
  height = Math.min(height, Math.max(100, maxHeight));
  if (chosen.side === 'top') chosen.top = top - gap - height;
  const card = { left: clamp(chosen.left, viewportLeft + margin, viewportRight - width - margin), top: clamp(chosen.top, viewportTop + margin, viewportBottom - height - margin), maxHeight: Math.max(100, maxHeight), width, height };
  const overlaps = card.left < right && card.left + width > left && card.top < bottom && card.top + height > top;
  const arrow = overlaps ? null : ['top', 'bottom'].includes(chosen.side)
    ? { left: clamp(centerX - card.left, 20, width - 20) }
    : { top: clamp(centerY - card.top, 20, height - 20) };
  return { spotlight, card, side: chosen.side, arrow };
}
