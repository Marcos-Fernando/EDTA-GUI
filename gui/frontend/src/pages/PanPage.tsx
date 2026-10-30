import { useMemo, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import type { TimelineContext } from '../types'
import { PAN_FILE_EXTENSIONS, PAN_PARAMS, panListName } from '../config/panFields'
import { toPanRunConfig, validatePan } from '../config/rules'
import { buildPanCommand } from '../config/commandBuilder'
import { FileInput } from '../components/FileInput'
import { FormSection } from '../components/FormSection'
import { RunWorkspace } from '../components/RunWorkspace'
import { TextField } from '../components/TextField'
import fieldStyles from '../components/Field.module.scss'
import { useEmailHint } from '../hooks/useEmailHint'
import { ServiceError } from '../services'
import { askNotificationPermission } from '../notify/system'
import { useNotify } from '../notify/NotifyContext'
import { useAppDispatch, useAppState, usePipelineService } from '../state/hooks'
import { SubmitFooter } from './SubmitFooter'
import styles from './PageLayout.module.scss'

const PAN_CONTEXT: TimelineContext = {
  kind: 'pan',
  step: 'all',
  anno: true,
  evaluate: false,
  runLai: false,
}

export function PanPage() {
  const { pan: form, activeRun, runSeq } = useAppState()
  const dispatch = useAppDispatch()
  const service = usePipelineService()
  const { runStarted } = useNotify()
  const emailHint = useEmailHint()
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<ServiceError | null>(null)

  const errors = { ...validatePan(form), ...(serverError?.fieldErrors ?? {}) }
  const missingKeys = new Set<string>()
  if (!form.pairs.some((p) => p.genome)) missingKeys.add('pairs')
  if (!form.cds) missingKeys.add('cds')
  const missing = [...missingKeys].map((k) => errors[k]).filter(Boolean)
  const inline = (key: string) => (missingKeys.has(key) ? null : (errors[key] ?? null))
  const invalidCount = Object.keys(errors).filter((k) => !missingKeys.has(k)).length

  const commands = useMemo(() => {
    if (Object.keys(validatePan(form)).length > 0) return null
    return [buildPanCommand(toPanRunConfig(form), panListName('<timestamp>'))]
  }, [form])

  const submit = async () => {
    setServerError(null)
    setSubmitting(true)
    askNotificationPermission() // still inside the click: browsers require it
    try {
      const { runId } = await service.startPanRun(toPanRunConfig(form))
      dispatch({ type: 'run/active', page: 'pan', runId })
      runStarted(runId)
    } catch (e) {
      setServerError(e instanceof ServiceError ? e : new ServiceError(String(e)))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.app}>
      <aside className={styles.sidebar} aria-label="panEDTA configuration">
        <div className={styles.sidebarScroll}>
          <FormSection num="01" title="Input data" help="inputPan">
            <TextField
              label="Email address"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@institution.edu"
              value={form.email}
              onChange={(value) => dispatch({ type: 'pan/text', field: 'email', value })}
              error={inline('email')}
              hint={emailHint}
            />

            <div className={fieldStyles.field}>
              <span className={fieldStyles.label} id="pan-genomes-label">
                Genomes
                <span className={fieldStyles.required} aria-hidden="true">
                  *
                </span>
                <span className={fieldStyles.flag}>-g</span>
              </span>
              <span className={fieldStyles.hint}>
                One row per genome, with an optional CDS. Use simple FASTA headers (e.g. &gt;chr01).
              </span>
              <ol className={styles.pairs} aria-labelledby="pan-genomes-label">
                {form.pairs.map((pair, i) => (
                  <li key={pair.id} className={styles.pair}>
                    <div className={styles.pairHead}>
                      <span>Genome {i + 1}</span>
                      {i > 0 && (
                        <button
                          type="button"
                          className={`${styles.smallBtn} ${styles.removeBtn}`}
                          aria-label={`Remove genome ${i + 1}`}
                          title="Remove this row"
                          onClick={() => dispatch({ type: 'pan/removePair', id: pair.id })}
                        >
                          <Minus size={14} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    <FileInput
                      label={`Genome ${i + 1} (FASTA)`}
                      file={pair.genome}
                      accept={PAN_FILE_EXTENSIONS}
                      placeholder="FASTA"
                      error={inline(`pairs.${pair.id}.genome`)}
                      onChange={(file) =>
                        dispatch({ type: 'pan/pairFile', id: pair.id, field: 'genome', file })
                      }
                    />
                    <FileInput
                      label={`CDS ${i + 1} (optional)`}
                      file={pair.cds}
                      accept={PAN_FILE_EXTENSIONS}
                      placeholder="cds (optional)"
                      error={inline(`pairs.${pair.id}.cds`)}
                      onChange={(file) =>
                        dispatch({ type: 'pan/pairFile', id: pair.id, field: 'cds', file })
                      }
                    />
                  </li>
                ))}
              </ol>
              <div>
                <button
                  type="button"
                  className={styles.smallBtn}
                  onClick={() => dispatch({ type: 'pan/addPair' })}
                >
                  <Plus size={14} aria-hidden="true" /> Add genome
                </button>
              </div>
            </div>
          </FormSection>

          <FormSection num="02" title="Additional features" help="panFeatures">
            <FileInput
              label={
                <>
                  Coding DNA sequence (cds) <span className={fieldStyles.flag}>-c</span>
                </>
              }
              name="Coding DNA sequence (cds)"
              required
              file={form.cds}
              accept={PAN_FILE_EXTENSIONS}
              placeholder=".fasta .fa"
              error={inline('cds')}
              hint="Fills in the CDS of genomes listed without one."
              onChange={(file) => dispatch({ type: 'pan/file', field: 'cds', file })}
            />
            <FileInput
              label={
                <>
                  Non-redundant library <span className={fieldStyles.flag}>-l</span>
                </>
              }
              name="Non-redundant library"
              file={form.library}
              accept={PAN_FILE_EXTENSIONS}
              error={inline('library')}
              hint="Optional. Curated library following the RepeatMasker naming convention."
              onChange={(file) => dispatch({ type: 'pan/file', field: 'library', file })}
            />
            <div className={styles.paramGrid2}>
              <TextField
                label={
                  <>
                    {PAN_PARAMS.threads.label}{' '}
                    <span className={fieldStyles.flag}>{PAN_PARAMS.threads.flag}</span>
                  </>
                }
                numeric
                inputMode="numeric"
                value={form.threads}
                onChange={(value) => dispatch({ type: 'pan/text', field: 'threads', value })}
                error={inline('threads')}
              />
              <TextField
                label={
                  <>
                    Min. full-length copies{' '}
                    <span className={fieldStyles.flag}>{PAN_PARAMS.copies.flag}</span>
                  </>
                }
                title={PAN_PARAMS.copies.label}
                numeric
                inputMode="numeric"
                value={form.copies}
                onChange={(value) => dispatch({ type: 'pan/text', field: 'copies', value })}
                error={inline('copies')}
              />
            </div>
            <span className={fieldStyles.hint}>
              Copies: minimum number of full-length copies of a TE family in each genome for it to
              enter the pan-genome library (default and minimum: 3).
            </span>
          </FormSection>
        </div>

        <SubmitFooter
          commands={commands}
          missing={missing}
          invalidCount={invalidCount}
          submitting={submitting}
          submitError={serverError?.message ?? null}
          onSubmit={submit}
        />
      </aside>

      <RunWorkspace
        key={runSeq.pan}
        runId={activeRun.pan}
        eyebrow="panEDTA pipeline"
        title="Pan-genome annotation"
        idleContext={PAN_CONTEXT}
      />
    </div>
  )
}
