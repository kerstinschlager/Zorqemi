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

  const result = await pool.query(
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

  return result.rows[0] ?? null;
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
