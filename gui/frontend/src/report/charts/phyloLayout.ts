/** Sizing of the radial LTR tree drawn by katucharts (see PhyloTreeChart). */

export const LABEL_PX = 7
export const LEAF_PADDING = 10 // katucharts default (leafPadding)
const RADIAL_MARGIN = 60 // katucharts: radius = min(plot width, plot height) / 2 - 60

/**
 * Square size for the radial tree. The library gives the leaf labels only 60 px outside the
 * circle, so the extra label length goes into the chart spacing, and the radius grows with
 * the number of leaves so the labels do not overlap.
 */
export function radialTreeSize(leafNames: readonly string[]) {
  const longest = Math.max(0, ...leafNames.map((n) => n.length))
  const labelPx = Math.ceil(longest * LABEL_PX * 0.62) + LEAF_PADDING
  const radius = Math.max(260, Math.ceil((leafNames.length * (LABEL_PX + 2)) / (2 * Math.PI)))
  const spacing = Math.max(20, labelPx - RADIAL_MARGIN + 20)
  return { size: 2 * (radius + RADIAL_MARGIN + spacing), spacing }
}
