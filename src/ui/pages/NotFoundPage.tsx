import { Link } from 'react-router-dom';
import { useI18n } from '@ui/i18n/I18nProvider';

export function NotFoundPage() {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-20 text-center">
      <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{t('notfound.title')}</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">{t('notfound.body')}</p>
      <Link to="/" className="text-sm font-medium text-indigo-500 hover:text-indigo-600">
        {t('notfound.home')}
      </Link>
    </div>
  );
}
