import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let urlStr = body.url;

    if (!urlStr) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    if (!/^https?:\/\//i.test(urlStr)) {
      urlStr = 'https://' + urlStr;
    }

    try {
      new URL(urlStr);
    } catch {
      return NextResponse.json({ error: 'Invalid URL provided' }, { status: 400 });
    }

    const response = await fetch(urlStr, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Failed to fetch URL: ${response.statusText}` }, { status: 400 });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    let score = 10;
    const deductions = [];

    // SEO
    const title = $('title').text();
    const metaDesc = $('meta[name="description"]').attr('content') || '';
    const h1Count = $('h1').length;
    const images = $('img');
    let missingAltCount = 0;
    images.each((_, img) => {
      if (!$(img).attr('alt')) {
        missingAltCount++;
      }
    });
    const canonical = $('link[rel="canonical"]').attr('href');

    const seo = {
      title,
      metaDescription: metaDesc,
      h1Count,
      imagesCount: images.length,
      missingAltCount,
      canonical
    };

    if (!title || title.length < 10 || title.length > 70) {
      score -= 0.5;
      deductions.push('Title length should be between 10 and 70 characters.');
    }
    if (!metaDesc || metaDesc.length < 50 || metaDesc.length > 160) {
      score -= 0.5;
      deductions.push('Meta description should be between 50 and 160 characters.');
    }
    if (h1Count !== 1) {
      score -= 0.5;
      deductions.push('There should be exactly one H1 tag.');
    }
    if (missingAltCount > 0) {
      score -= Math.min(1, missingAltCount * 0.1);
      deductions.push(`Missing alt attributes on ${missingAltCount} images.`);
    }
    if (!canonical) {
      score -= 0.5;
      deductions.push('Missing canonical link.');
    }

    // GEO
    const lang = $('html').attr('lang');
    const geoRegion = $('meta[name="geo.region"]').attr('content');
    const geoPlacename = $('meta[name="geo.placename"]').attr('content');
    const hreflang = $('link[hreflang]').length;

    const geo = {
      lang,
      geoRegion,
      geoPlacename,
      hreflangCount: hreflang
    };

    if (!lang) {
      score -= 0.5;
      deductions.push('Missing lang attribute in HTML tag.');
    }
    if (!geoRegion && !geoPlacename && hreflang === 0) {
      // Minor deduction if no localized signals are found
      score -= 0.5;
      deductions.push('Missing basic GEO signals (lang, geo.region, hreflang).');
    }

    // AEO
    const jsonLd = $('script[type="application/ld+json"]').length;
    const lists = $('ul, ol').length;
    const strongTags = $('strong, b').length;
    const viewport = $('meta[name="viewport"]').attr('content');

    const aeo = {
      jsonLdCount: jsonLd,
      listsCount: lists,
      strongTagsCount: strongTags,
      viewport
    };

    if (jsonLd === 0) {
      score -= 1;
      deductions.push('Missing JSON-LD structured data, which is critical for AEO.');
    }
    if (lists === 0) {
      score -= 0.5;
      deductions.push('Consider adding lists (ul/ol) to help Answer Engines parse content.');
    }
    if (!viewport) {
      score -= 1;
      deductions.push('Missing viewport meta tag (Mobile friendliness is essential for AEO/SEO).');
    }

    score = Math.max(1, Math.round(score * 10) / 10);

    return NextResponse.json({
      url: urlStr,
      score,
      deductions,
      seo,
      geo,
      aeo
    });

  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
