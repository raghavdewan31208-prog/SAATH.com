import { useNavigate } from 'react-router-dom'
import { useApp } from '../lib/store'
import { EmptyState, TopBar } from '../components/ui'

export default function NotFoundScreen() {
  const { t } = useApp()
  const navigate = useNavigate()
  return (
    <>
      <TopBar title={t('Not found', 'नहीं मिला')} back="/" />
      <div className="screen">
        <EmptyState
          icon="alert"
          title={t('That screen does not exist', 'वह स्क्रीन मौजूद नहीं')}
          body={t('The link may be old or mistyped. Return home to continue.', 'लिंक पुराना या गलत हो सकता है। जारी रखने के लिए होम पर लौटें।')}
          action={
            <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
              {t('Back to home', 'होम पर लौटें')}
            </button>
          }
        />
      </div>
    </>
  )
}
