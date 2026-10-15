const NUMBER = '[+-]?\\d+(?:[.,]\\d+)?';
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function numericParameter(following) {
  // Adjacent free-text captures used to split "buổi tối 1" into "buổi" / "tối 1".
  // A value followed by a measurement must contain only a number, including its sign.
  if (/^\s*phiên trước/u.test(following)) return false;
  return /^\s*(?:%|:00|(?:phút|điểm|phiên|ngày|giờ|lượt)(?=$|[\s.,:;)—%]))/u.test(following);
}

export function createMessageFormatter(messages) {
  const templates = Object.entries(messages).filter(([key]) => /\{\d+\}/u.test(key))
    .sort(([a], [b]) => b.replace(/\{\d+\}/g, '').length - a.replace(/\{\d+\}/g, '').length)
    .map(([key, translation]) => {
      const tokens = [...key.matchAll(/\{(\d+)\}/g)];
      let pattern = '^'; let offset = 0;
      for (const [index, token] of tokens.entries()) {
        pattern += escape(key.slice(offset, token.index));
        const following = key.slice(token.index + token[0].length, tokens[index + 1]?.index ?? key.length);
        pattern += `(${numericParameter(following) ? NUMBER : '.*?'})`;
        offset = token.index + token[0].length;
      }
      pattern += escape(key.slice(offset)) + '$';
      return { pattern: new RegExp(pattern, 'iu'), translation, indices: tokens.map(token => Number(token[1])) };
    });

  function format(text, values = [], depth = 0) {
    if (typeof text !== 'string') return text;
    if (depth > 8) return text;
    let translated = messages[text];
    if (translated === undefined && values.length === 0) {
      for (const template of templates) {
        const match = text.match(template.pattern);
        if (!match) continue;
        translated = template.translation;
        values = [];
        template.indices.forEach((index, capture) => { values[index] = match[capture + 1]; });
        break;
      }
    }
    return (translated ?? text).replace(/\{(\d+)\}/g, (match, index) => {
      const value = values[index];
      return value == null ? match : typeof value === 'string' ? format(value, [], depth + 1) : value;
    });
  }
  return format;
}
