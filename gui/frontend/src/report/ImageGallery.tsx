import { useState } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, FileText } from 'lucide-react'
import type { ReportImage } from '../config/reportSections'
import { usePipelineService } from '../state/hooks'
import styles from './Report.module.scss'

/** Static PNGs made by the pipeline, one at a time, with links to the PNG and the PDF. */
export function ImageGallery({ runId, images }: { runId: string; images: ReportImage[] }) {
  const service = usePipelineService()
  const [index, setIndex] = useState(0)
  const current = images[Math.min(index, images.length - 1)]
  if (!current) return null
  const go = (d: number) => setIndex((i) => (i + d + images.length) % images.length)

  return (
    <div className={styles.gallery}>
      <div className={styles.galleryStage}>
        {images.length > 1 && (
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => go(-1)}
            aria-label="Previous image"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
        )}
        <a
          className={styles.galleryImage}
          href={service.fileUrl(runId, current.png, true)}
          target="_blank"
          rel="noreferrer"
          title="Open the full-size image"
        >
          <img src={service.fileUrl(runId, current.png, true)} alt={current.name} loading="lazy" />
        </a>
        {images.length > 1 && (
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => go(1)}
            aria-label="Next image"
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className={styles.galleryBar}>
        <span className={styles.fileName}>
          {current.name}
          {images.length > 1 && (
            <span className={styles.muted}>
              {' '}
              · {index + 1}/{images.length}
            </span>
          )}
        </span>
        <span className={styles.links}>
          <a href={service.fileUrl(runId, current.png, true)} target="_blank" rel="noreferrer">
            <ExternalLink size={12} aria-hidden="true" /> PNG
          </a>
          {current.pdf && (
            <a href={service.fileUrl(runId, current.pdf, true)} target="_blank" rel="noreferrer">
              <FileText size={12} aria-hidden="true" /> PDF
            </a>
          )}
        </span>
      </div>

      {images.length > 1 && (
        <div className={styles.thumbs} role="group" aria-label="Images">
          {images.map((img, i) => (
            <button
              key={img.png}
              type="button"
              className={i === index ? styles.thumbActive : styles.thumb}
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
            >
              {img.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
