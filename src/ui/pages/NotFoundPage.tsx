import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-20 text-center">
      <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">404</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        That route doesn&rsquo;t exist (yet). The 4×4 solver and tutorials are on the way.
      </p>
      <Link to="/" className="text-sm font-medium text-indigo-500 hover:text-indigo-600">
        Go home
      </Link>
    </div>
  );
}
