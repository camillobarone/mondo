'use client';

import { useState } from 'react';

type AuditResult = {
  url: string;
  score: number;
  deductions: string[];
  seo: {
    title: string;
    metaDescription: string;
    h1Count: number;
    imagesCount: number;
    missingAltCount: number;
    canonical: string;
  };
  geo: {
    lang: string;
    geoRegion: string;
    geoPlacename: string;
    hreflangCount: number;
  };
  aeo: {
    jsonLdCount: number;
    listsCount: number;
    strongTagsCount: number;
    viewport: string;
  };
};

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState('');

  const handleAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to audit URL');
      }

      setResult(data as AuditResult);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-[family-name:var(--font-geist-sans)]">
      <main className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Web Auditor</h1>
          <p className="text-gray-600">Scan any website for SEO, GEO, and AEO problems.</p>
        </div>

        <form onSubmit={handleAudit} className="flex gap-4">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter website URL (e.g., https://example.com)"
            required
            className="flex-1 p-4 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Scanning...' : 'Audit Now'}
          </button>
        </form>

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center">
              <h2 className="text-2xl font-semibold text-gray-700 mb-2">Overall Score</h2>
              <div className={`text-6xl font-bold ${result.score >= 8 ? 'text-green-500' : result.score >= 5 ? 'text-yellow-500' : 'text-red-500'}`}>
                {result.score} <span className="text-2xl text-gray-400">/ 10</span>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* SEO Data */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-xl font-bold text-gray-900 mb-4">SEO</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li><strong>Title:</strong> {result.seo.title ? '✅ Present' : '❌ Missing'}</li>
                  <li><strong>Meta Desc:</strong> {result.seo.metaDescription ? '✅ Present' : '❌ Missing'}</li>
                  <li><strong>H1 Count:</strong> {result.seo.h1Count}</li>
                  <li><strong>Images:</strong> {result.seo.imagesCount}</li>
                  <li><strong>Missing Alts:</strong> {result.seo.missingAltCount}</li>
                  <li><strong>Canonical:</strong> {result.seo.canonical ? '✅ Present' : '❌ Missing'}</li>
                </ul>
              </div>

              {/* GEO Data */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-xl font-bold text-gray-900 mb-4">GEO</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li><strong>Lang:</strong> {result.geo.lang || '❌ Missing'}</li>
                  <li><strong>Region:</strong> {result.geo.geoRegion || '❌ Missing'}</li>
                  <li><strong>Placename:</strong> {result.geo.geoPlacename || '❌ Missing'}</li>
                  <li><strong>Hreflang Tags:</strong> {result.geo.hreflangCount}</li>
                </ul>
              </div>

              {/* AEO Data */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-xl font-bold text-gray-900 mb-4">AEO</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li><strong>JSON-LD:</strong> {result.aeo.jsonLdCount > 0 ? '✅ Present' : '❌ Missing'}</li>
                  <li><strong>Lists (ul/ol):</strong> {result.aeo.listsCount}</li>
                  <li><strong>Strong/B Tags:</strong> {result.aeo.strongTagsCount}</li>
                  <li><strong>Viewport:</strong> {result.aeo.viewport ? '✅ Present' : '❌ Missing'}</li>
                </ul>
              </div>
            </div>

            {/* Deductions / Problems */}
            {result.deductions.length > 0 && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-xl font-bold text-red-600 mb-4">Problems Found ({result.deductions.length})</h3>
                <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
                  {result.deductions.map((d: string, i: number) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.deductions.length === 0 && (
              <div className="bg-green-50 p-6 rounded-xl border border-green-200 text-green-800 font-medium">
                Perfect! No problems found.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
