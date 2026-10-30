import { useEffect } from 'react'
import { MODES } from '../config/edtaFields'
import { useHashRoute } from '../hooks/useHashRoute'
import { EdtaPage } from '../pages/EdtaPage'
import { GuidePage } from '../pages/GuidePage'
import { PanPage } from '../pages/PanPage'
import { ResultsPage } from '../pages/ResultsPage'
import { RunPage } from '../pages/RunPage'
import { NoticeStack } from '../notify/NoticeStack'
import { useNotify } from '../notify/NotifyContext'
import { useAppState } from '../state/hooks'
import { Header } from './Header'
import { StatusBar } from './StatusBar'
import edtaIcon from '../assets/brand/edta-icon.svg'
import annotepIcon from '../assets/brand/annotep-icon.svg'
import styles from './Shell.module.scss'

export function App() {
  const route = useHashRoute()
  const { edta } = useAppState()
  const { titlePrefix } = useNotify()
  const mode = MODES.find((m) => m.value === edta.mode) ?? MODES[0]

  // Mode accent (wine/green) follows the pipeline of the EDTA-GUI page; panEDTA uses EDTA.
  const annotep = route.page === 'edta' && edta.mode === 'annotep'
  useEffect(() => {
    document.documentElement.dataset.mode = annotep ? 'annotep' : 'edta'
  }, [annotep])

  let title = 'EDTA-GUI'
  let subtitle = 'The Extensive de novo TE Annotator'
  let pipeline = 'EDTA'
  let page = <EdtaPage />

  switch (route.page) {
    case 'edta':
      title = mode.title
      subtitle = mode.subtitle
      pipeline = mode.label === 'AnnoTEP' ? 'AnnoTEP' : 'EDTA'
      break
    case 'pan':
      title = 'panEDTA-GUI'
      subtitle = 'Pan-genome TE annotation with EDTA'
      pipeline = 'panEDTA'
      page = <PanPage />
      break
    case 'results':
      subtitle = 'Results'
      pipeline = '—'
      page = <ResultsPage />
      break
    case 'run':
      subtitle = 'Results'
      pipeline = '—'
      page = <RunPage runId={route.runId} tab={route.tab ?? 'execution'} />
      break
    case 'guide':
      subtitle = 'About and user guide'
      pipeline = '—'
      page = <GuidePage section={route.section} />
      break
  }

  useEffect(() => {
    const base = route.page === 'edta' ? mode.title : `${title} · ${subtitle}`
    document.title = titlePrefix + base
  }, [route.page, mode.title, title, subtitle, titlePrefix])

  return (
    <div className={styles.shell}>
      <Header
        route={route}
        icon={annotep ? annotepIcon : edtaIcon}
        title={title}
        subtitle={subtitle}
      />
      <NoticeStack />
      <main className={styles.main}>{page}</main>
      <StatusBar pipeline={pipeline} />
    </div>
  )
}
