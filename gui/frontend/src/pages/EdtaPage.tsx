import { useId, useMemo, useState } from 'react'
import type { EdtaRunConfig, TimelineContext } from '../types'
import {
  EXTRA_FILES,
  FASTA_EXTENSIONS,
  MODES,
  PARAMS,
  RUN_NAME,
  SPECIES_OPTIONS,
  STEP_OPTIONS,
  SWITCHES,
  TEST_RUN,
} from '../config/edtaFields'
import {
  fileDisabledReason,
  isSwitchVisible,
  switchLockReason,
  testEdtaState,
  toEdtaRunConfig,
  validateEdta,
} from '../config/rules'
import { buildEdtaCommands } from '../config/commandBuilder'
import { FileInput } from '../components/FileInput'
import { FormSection } from '../components/FormSection'
import { HelpPopover } from '../components/HelpPopover'
import { RunWorkspace } from '../components/RunWorkspace'
import { SegmentedControl } from '../components/SegmentedControl'
import { Switch } from '../components/Switch'
import { TestRunButton } from '../components/TestRunButton'
import { TextField } from '../components/TextField'
import fieldStyles from '../components/Field.module.scss'
import { useEmailHint } from '../hooks/useEmailHint'
import { useRuns } from '../hooks/useRuns'
import { ServiceError } from '../services'
import { askNotificationPermission } from '../notify/system'
import { useNotify } from '../notify/NotifyContext'
import { useAppDispatch, useAppState, usePipelineService } from '../state/hooks'
import { secureFilename, stripExtension } from '../utils/files'
import { sortRuns } from '../utils/runs'
import { formatDateTime } from '../utils/time'
import { SubmitFooter } from './SubmitFooter'
import styles from './PageLayout.module.scss'

export function EdtaPage() {
  const { edta: form, activeRun, runSeq } = useAppState()
  const dispatch = useAppDispatch()
  const service = usePipelineService()
  const { runStarted } = useNotify()
  const emailHint = useEmailHint()
  const annotep = form.mode === 'annotep'
  const reusing = form.step !== 'all'
  const genomeStem = form.genome ? stripExtension(secureFilename(form.genome.name)) : null

  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<ServiceError | null>(null)

  // Previous runs that can be continued (step ≠ all): finished, not panEDTA.
  const { runs } = useRuns(reusing ? 10_000 : null)
  const reusable = useMemo(
    () =>
      sortRuns(runs ?? []).filter((r) => r.status !== 'running' && r.kind !== 'pan' && !r.readOnly),
    [runs],
  )
  const previous = reusable.find((r) => r.id === form.previousRunId) ?? null

  const errors = { ...validateEdta(form), ...(serverError?.fieldErrors ?? {}) }
  const missingKeys = new Set<string>()
  if (!form.genome && !reusing) missingKeys.add('genome')
  if (reusing && !form.previousRunId) missingKeys.add('previousRunId')
  const missing = [...missingKeys].map((k) => errors[k]).filter(Boolean)
  const inline = (key: string) => (missingKeys.has(key) ? null : (errors[key] ?? null))
  const invalidCount = Object.keys(errors).filter((k) => !missingKeys.has(k)).length

  const commands = useMemo(() => {
    if (Object.keys(validateEdta(form)).length > 0) return null
    const genomeName = form.genome
      ? secureFilename(form.genome.name)
      : (previous?.genome ?? '<genome of the previous run>')
    return buildEdtaCommands(toEdtaRunConfig(form), genomeName)
  }, [form, previous])

  const idleContext: TimelineContext = {
    kind: form.mode,
    step: form.step,
    anno: annotep || form.switches.anno,
    evaluate: form.switches.evaluate,
    runLai: annotep && form.switches.runLai,
    charts: !annotep && form.switches.anno,
  }

  const start = async (cfg: EdtaRunConfig) => {
    setServerError(null)
    setSubmitting(true)
    askNotificationPermission() // still inside the click: browsers require it
    try {
      const { runId } = await service.startEdtaRun(cfg)
      dispatch({ type: 'run/active', page: 'edta', runId })
      runStarted(runId)
    } catch (e) {
      setServerError(e instanceof ServiceError ? e : new ServiceError(String(e)))
    } finally {
      setSubmitting(false)
    }
  }

  const submit = () => start(toEdtaRunConfig(form))

  const modeLabel = MODES.find((m) => m.value === form.mode)?.label ?? form.mode
  const testDuration = TEST_RUN.duration[form.mode]
  const runTest = async () => {
    const genome = await service.loadTestFile(TEST_RUN.genome)
    const next = testEdtaState(form, genome)
    dispatch({ type: 'edta/replace', state: next })
    // An invalid e-mail or thread count stays highlighted in the form instead.
    if (Object.keys(validateEdta(next)).length === 0) await start(toEdtaRunConfig(next))
  }

  const speciesLabel = useId()
  const stepLabel = useId()
  const previousId = useId()
  const previousErr = inline('previousRunId')

  return (
    <div className={styles.app}>
      <aside className={styles.sidebar} aria-label="Run configuration">
        <div className={styles.sidebarScroll}>
          <div className={styles.modeBlock}>
            <div className={styles.modeHead}>
              <span id="mode-label">Pipeline mode</span>
              <HelpPopover topic="mode" />
            </div>
            <SegmentedControl
              size="lg"
              label="Pipeline mode"
              labelledBy="mode-label"
              options={MODES.map((m) => ({ value: m.value, label: m.label }))}
              value={form.mode}
              onChange={(value) => dispatch({ type: 'edta/mode', mode: value })}
            />
          </div>

          <TestRunButton
            description={`${modeLabel} mode with ${TEST_RUN.genome} (Arabidopsis thaliana chromosome 1, 30 Mb): ${testDuration} with 10 threads, charts included.`}
            confirmText={
              `Start the ${modeLabel} test analysis now?\n\n` +
              `Genome: ${TEST_RUN.genome} (Arabidopsis thaliana chromosome 1, 30 Mb)\n` +
              `Results folder: ${TEST_RUN.runName}_<date-time>\n` +
              `Duration: ${testDuration} with 10 threads.\n\n` +
              'The form is replaced by the test settings (e-mail and threads are kept).'
            }
            onRun={runTest}
          />

          <FormSection num="01" title="Input data" help="inputEdta">
            <TextField
              label="Email address"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@institution.edu"
              value={form.email}
              onChange={(value) => dispatch({ type: 'edta/text', field: 'email', value })}
              error={inline('email')}
              hint={emailHint}
            />
            <FileInput
              label="Genome sequence (FASTA)"
              required={!reusing}
              file={form.genome}
              accept={FASTA_EXTENSIONS}
              placeholder={reusing && previous?.genome ? previous.genome : 'genome.fasta'}
              onChange={(file) => dispatch({ type: 'edta/genome', file })}
              error={inline('genome')}
              hint={
                reusing
                  ? 'Optional: the genome stored in the previous run folder is used unless you select a new one.'
                  : 'Use simple FASTA headers (e.g. >chr01). Avoid "_", "-", "/" and "|".'
              }
            />
            {!reusing && (
              <TextField
                label={RUN_NAME.label}
                placeholder={genomeStem ?? 'genome name'}
                value={form.runName}
                onChange={(value) => dispatch({ type: 'edta/text', field: 'runName', value })}
                error={inline('runName')}
                hint={`Optional. Results folder: ${
                  form.runName.trim() || genomeStem || '<genome name>'
                }_<date-time>. Empty = genome name.`}
              />
            )}
          </FormSection>

          <FormSection num="02" title="Run parameters" help="runParameters">
            <div className={fieldStyles.field}>
              <div className={styles.fieldHead}>
                <span id={speciesLabel} className={fieldStyles.label}>
                  Species <span className={fieldStyles.flag}>--species</span>
                </span>
                <HelpPopover topic="species" />
              </div>
              <SegmentedControl
                label="Species"
                labelledBy={speciesLabel}
                options={SPECIES_OPTIONS}
                value={form.species}
                onChange={(value) => dispatch({ type: 'edta/species', value })}
              />
            </div>

            <div className={fieldStyles.field}>
              <div className={styles.fieldHead}>
                <span id={stepLabel} className={fieldStyles.label}>
                  Steps to run <span className={fieldStyles.flag}>--step</span>
                </span>
                <HelpPopover topic="steps" />
              </div>
              <SegmentedControl
                label="Steps to run"
                labelledBy={stepLabel}
                options={STEP_OPTIONS}
                value={form.step}
                onChange={(value) => dispatch({ type: 'edta/step', value })}
              />
            </div>

            {reusing && (
              <div className={fieldStyles.field}>
                <label htmlFor={previousId} className={fieldStyles.label}>
                  Previous run
                  <span className={fieldStyles.required} aria-hidden="true">
                    *
                  </span>
                </label>
                <select
                  id={previousId}
                  className={`${fieldStyles.input} ${fieldStyles.select}`}
                  value={form.previousRunId ?? ''}
                  aria-invalid={previousErr ? true : undefined}
                  aria-describedby={`${previousId}-hint`}
                  onChange={(e) =>
                    dispatch({ type: 'edta/previousRun', runId: e.target.value || null })
                  }
                >
                  <option value="">
                    {runs === null ? 'Loading runs…' : 'Select a run folder…'}
                  </option>
                  {reusable.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id} — {formatDateTime(r.startedAt)}
                    </option>
                  ))}
                </select>
                <span id={`${previousId}-hint`} className={fieldStyles.hint}>
                  {runs !== null && reusable.length === 0
                    ? 'No finished run can be continued. Runs of the old results folder are read-only.'
                    : 'The run continues in this folder; its status.txt is reset. Runs of the old results folder are read-only and are not listed.'}
                </span>
                {previousErr && (
                  <span className={fieldStyles.error} role="alert">
                    {previousErr}
                  </span>
                )}
              </div>
            )}

            <div className={styles.paramGrid}>
              <TextField
                label={PARAMS.mutationRate.label}
                title={PARAMS.mutationRate.title}
                compactLabel
                numeric
                inputMode="decimal"
                placeholder={PARAMS.mutationRate.default}
                value={form.mutationRate}
                onChange={(value) => dispatch({ type: 'edta/text', field: 'mutationRate', value })}
                error={inline('mutationRate')}
              />
              <TextField
                label={PARAMS.maxDiv.label}
                title={PARAMS.maxDiv.title}
                compactLabel
                numeric
                inputMode="numeric"
                value={form.maxDiv}
                onChange={(value) => dispatch({ type: 'edta/text', field: 'maxDiv', value })}
                error={inline('maxDiv')}
              />
              <TextField
                label={PARAMS.threads.label}
                title={PARAMS.threads.title}
                compactLabel
                numeric
                inputMode="numeric"
                value={form.threads}
                onChange={(value) => dispatch({ type: 'edta/text', field: 'threads', value })}
                error={inline('threads')}
              />
            </div>
          </FormSection>

          <FormSection num="03" title="Advanced options" help="parameters">
            <div className={styles.optionTable}>
              {SWITCHES.filter((s) => isSwitchVisible(form.mode, s.key)).map((s) => {
                const lockReason = switchLockReason(form, s.key)
                const locked = lockReason !== null
                const lockId = `lock-${s.key}`
                const annotepOnly = !s.modes.includes('edta')
                return (
                  <div
                    key={s.key}
                    className={`${styles.optionRow} ${annotepOnly ? styles.optionAnnotep : ''}`}
                  >
                    <span>
                      {s.label}
                      {annotepOnly && <span className={styles.badge}>AnnoTEP</span>}
                      {locked && (
                        <span id={lockId} className={styles.locked}>
                          {lockReason}
                        </span>
                      )}
                    </span>
                    <span className={styles.flagCode}>{s.flag}</span>
                    <Switch
                      label={s.label}
                      checked={form.switches[s.key]}
                      disabled={locked}
                      describedBy={locked ? lockId : undefined}
                      onChange={(value) => dispatch({ type: 'edta/switch', key: s.key, value })}
                    />
                  </div>
                )
              })}
            </div>
          </FormSection>

          <FormSection num="04" title="Additional files" hint="optional" help="extraFiles">
            {EXTRA_FILES.map((f) => {
              const disabledReason = fileDisabledReason(form, f.key)
              return (
                <FileInput
                  key={f.key}
                  label={
                    <>
                      {f.label} <span className={fieldStyles.flag}>{f.flag}</span>
                    </>
                  }
                  name={f.label}
                  file={form.files[f.key]}
                  accept={f.extensions}
                  placeholder={f.placeholder}
                  disabled={disabledReason !== null}
                  disabledReason={disabledReason ?? undefined}
                  error={inline(`files.${f.key}`)}
                  onChange={(file) => dispatch({ type: 'edta/file', key: f.key, file })}
                />
              )
            })}
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
        key={runSeq.edta}
        runId={activeRun.edta}
        eyebrow={annotep ? 'AnnoTEP pipeline' : 'EDTA pipeline'}
        title="Annotation process"
        idleContext={idleContext}
      />
    </div>
  )
}
