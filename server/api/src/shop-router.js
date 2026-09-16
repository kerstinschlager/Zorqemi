import { URL } from 'node:url';

const RESERVED_HOSTS = new Set([
  'zorqemi.de',
  'www.zorqemi.de',
  'zorqemishop.de',
  'www.zorqemishop.de',
  'api.zorqemi.de'
]);

function normalizeHost(host) {
  if (!host) return '';
  try {
    const parsed = new URL(`http://${host}`);
    return parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

export async function resolveShopByHost(pool, rawHost) {
  const hostname = normalizeHost(rawHost);
  if (!hostname || RESERVED_HOSTS.has(hostname)) return null;

  const explicit = await pool.query(
    `
      SELECT
        m.id,
        m.name,
        m.slug,
        m.shop_slug,
        m.email,
        m.published,
        d.hostname,
        d.domain_type,
        d.is_primary,
        d.is_verified,
        d.ssl_status
      FROM shop_domains d
      JOIN merchants m ON m.id = d.merchant_id
      WHERE lower(d.hostname) = $1
        AND m.published = true
        AND (
          d.domain_type = 'zorqemishop'
          OR (d.domain_type = 'custom' AND d.is_verified = true AND d.ssl_status = 'active')
        )
      LIMIT 1
    `,
    [hostname]
  );

  if (explicit.rows[0]) return explicit.rows[0];

  // ZorqemiShop addresses are derived from the merchant slug as well,
  // so a merchant does not need a separate DNS-row record for its own subdomain.
  const suffix = '.zorqemishop.de';
  if (!hostname.endsWith(suffix)) return null;
  const shopSlug = hostname.slice(0, -suffix.length);
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(shopSlug)) return null;

  const derived = await pool.query(
    `
      SELECT
        m.id,
        m.name,
        m.slug,
        m.shop_slug,
        m.email,
        m.published,
        $1::text AS hostname,
        'zorqemishop'::text AS domain_type,
        true AS is_primary,
        true AS is_verified,
        'active'::text AS ssl_status
      FROM merchants m
      WHERE lower(m.shop_slug) = $2
        AND m.published = true
      LIMIT 1
    `,
    [hostname, shopSlug]
  );

  return derived.rows[0] ?? null;
}

export async function getPublicShop(pool, merchantId) {
  const result = await pool.query(
    `
      SELECT id, name, slug, shop_slug, email, published
      FROM merchants
      WHERE id = $1 AND published = true
      LIMIT 1
    `,
    [merchantId]
  );
  return result.rows[0] ?? null;
}
