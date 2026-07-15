import { Link } from 'react-router';
import { useSearch } from '../api/queries';

export function SearchResults({ q }: { q: string }) {
  const { data, isLoading, isError } = useSearch(q);
  const results = data ?? [];

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h2 className="text-lg font-semibold text-ink">Search results for "{q}"</h2>

      {isLoading && <p className="mt-4 text-latte">Searching…</p>}
      {isError && <p className="mt-4 text-red-700">Search failed. Try again.</p>}
      {!isLoading && !isError && results.length === 0 && (
        <p className="mt-4 text-latte">No cards match "{q}".</p>
      )}

      <ul className="mt-4 space-y-2">
        {results.map((r) => (
          <li key={r.cardId}>
            <Link
              to={`/b/${r.boardId}/c/${r.cardId}`}
              className="block rounded-lg border border-sand bg-paper p-3 hover:border-latte"
            >
              <div className="font-medium text-ink">{r.title}</div>
              <div className="mt-0.5 text-xs text-latte">
                {r.boardName} · {r.listName}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
