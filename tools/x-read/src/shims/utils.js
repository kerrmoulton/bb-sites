export const BROWSER_JSON_SNIFF_FN = `
async function fetchJsonOrLoginWall(input, init) {
  const r = await fetch(input, init);
  const contentType = r.headers.get('content-type') || '';
  const text = await r.text();
  const trimmed = text.replace(/^\\s+/, '');
  const looksLikeHtml =
    contentType.toLowerCase().includes('text/html')
    || /^<(?:!doctype|html|head|body|title)(?:[\\s>/]|$)/i.test(trimmed);
  if (looksLikeHtml) {
    return {
      __loginWall: true,
      status: r.status,
      url: r.url || (typeof input === 'string' ? input : ''),
      contentType,
      bodyPreview: trimmed.slice(0, 100),
    };
  }
  if (!r.ok) {
    return { error: r.status };
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(
      'JSON parse failed (status=' + r.status + ', body[0..50]=' + JSON.stringify(trimmed.slice(0, 50)) + '): '
      + (err && err.message ? err.message : String(err))
    );
  }
}
`;
export function throwIfLoginWall(value){if(value?.__loginWall)throw new Error('LOGIN_WALL_OR_CHALLENGE');return value;}
