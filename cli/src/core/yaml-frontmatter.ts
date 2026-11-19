import { normalizeLf } from './crypto-fs.ts';

interface YamlLine {
  lineNo: number;
  indent: number;
  text: string;
}

/**
 * Strips trailing YAML comment (# ...) outside single or double quotes.
 */
function stripInlineComment(raw: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle && raw[i - 1] !== '\\') {
      inDouble = !inDouble;
    } else if (ch === '#' && !inSingle && !inDouble) {
      if (i === 0 || /\s/.test(raw[i - 1])) {
        return raw.slice(0, i).trimEnd();
      }
    }
  }
  return raw.trimEnd();
}

function parseScalar(val: string): unknown {
  const s = val.trim();
  if (s === 'null' || s === '~') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === '[]') return [];
  if (s === '{}') return {};
  if (s.startsWith('[') && s.endsWith(']')) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return [];
    return splitFlowList(inner).map((item) => parseScalar(item));
  }
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
    return s
      .slice(1, -1)
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
  if (s.startsWith("'") && s.endsWith("'") && s.length >= 2) {
    return s.slice(1, -1).replace(/''/g, "'");
  }
  if (/^-?(?:0|[1-9]\d*)$/.test(s)) {
    return Number.parseInt(s, 10);
  }
  if (/^-?(?:0|[1-9]\d*)\.\d+$/.test(s)) {
    return Number.parseFloat(s);
  }
  return s;
}

function splitFlowList(inner: string): string[] {
  const items: string[] = [];
  let cur = '';
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle && inner[i - 1] !== '\\') inDouble = !inDouble;
    if (ch === ',' && !inSingle && !inDouble) {
      items.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) items.push(cur.trim());
  return items;
}

/**
 * Splits "key: value" safely without splitting colons inside quotes.
 */
function splitKeyValue(text: string): { key: string; rest: string } | null {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle && text[i - 1] !== '\\') inDouble = !inDouble;
    else if (ch === ':' && !inSingle && !inDouble) {
      const next = text[i + 1];
      if (next === undefined || next === ' ' || next === '\t') {
        const rawKey = text.slice(0, i).trim();
        const key =
          (rawKey.startsWith('"') && rawKey.endsWith('"')) ||
          (rawKey.startsWith("'") && rawKey.endsWith("'"))
            ? rawKey.slice(1, -1)
            : rawKey;
        const rest = text.slice(i + 1).trim();
        return { key, rest };
      }
    }
  }
  return null;
}

export function parseYaml(yamlText: string): Record<string, unknown> {
  const norm = normalizeLf(yamlText);
  const rawLines = norm.split('\n');
  const lines: YamlLine[] = [];

  for (let idx = 0; idx < rawLines.length; idx++) {
    const raw = rawLines[idx];
    if (/^\t/.test(raw)) {
      throw new Error(`YAML syntax error at line ${idx + 1}: tab indentation is not allowed.`);
    }
    const cleaned = stripInlineComment(raw);
    if (!cleaned.trim()) continue;
    const indentMatch = cleaned.match(/^( *)/);
    const indent = indentMatch ? indentMatch[1].length : 0;
    lines.push({ lineNo: idx + 1, indent, text: cleaned.slice(indent) });
  }

  if (lines.length === 0) return {};

  let cursor = 0;

  function parseBlock(minIndent: number): unknown {
    if (cursor >= lines.length) return {};
    const first = lines[cursor];
    if (first.indent < minIndent) return {};
    if (first.text === '-' || first.text.startsWith('- ')) {
      return parseSequence(first.indent);
    }
    return parseMapping(first.indent);
  }

  function parseMapping(mapIndent: number): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    while (cursor < lines.length) {
      const cur = lines[cursor];
      if (cur.indent < mapIndent) break;
      if (cur.indent > mapIndent) {
        throw new Error(`YAML unexpected indentation at line ${cur.lineNo}: '${cur.text}'`);
      }
      if (cur.text === '-' || cur.text.startsWith('- ')) break;

      const kv = splitKeyValue(cur.text);
      if (!kv) {
        throw new Error(`YAML expected key: value at line ${cur.lineNo}: '${cur.text}'`);
      }
      cursor++;
      if (kv.rest !== '') {
        obj[kv.key] = parseScalar(kv.rest);
      } else {
        if (cursor < lines.length && lines[cursor].indent > mapIndent) {
          obj[kv.key] = parseBlock(lines[cursor].indent);
        } else {
          obj[kv.key] = null;
        }
      }
    }
    return obj;
  }

  function parseSequence(seqIndent: number): unknown[] {
    const arr: unknown[] = [];
    while (cursor < lines.length) {
      const cur = lines[cursor];
      if (cur.indent < seqIndent) break;
      if (cur.indent > seqIndent) {
        throw new Error(`YAML unexpected sequence indentation at line ${cur.lineNo}: '${cur.text}'`);
      }
      if (!(cur.text === '-' || cur.text.startsWith('- '))) break;

      const afterDash = cur.text === '-' ? '' : cur.text.slice(2).trim();
      const itemChildMinIndent = seqIndent + 1;
      cursor++;

      if (afterDash === '') {
        if (cursor < lines.length && lines[cursor].indent >= itemChildMinIndent) {
          arr.push(parseBlock(lines[cursor].indent));
        } else {
          arr.push(null);
        }
        continue;
      }

      const inlineKv = splitKeyValue(afterDash);
      if (inlineKv) {
        const itemObj: Record<string, unknown> = {};
        const implicitPropIndent = cur.indent + 2;
        if (inlineKv.rest !== '') {
          itemObj[inlineKv.key] = parseScalar(inlineKv.rest);
        } else if (cursor < lines.length && lines[cursor].indent > implicitPropIndent) {
          itemObj[inlineKv.key] = parseBlock(lines[cursor].indent);
        } else {
          itemObj[inlineKv.key] = null;
        }

        if (cursor < lines.length && lines[cursor].indent >= itemChildMinIndent) {
          const siblingIndent = lines[cursor].indent;
          const extra = parseMapping(siblingIndent);
          Object.assign(itemObj, extra);
        }
        arr.push(itemObj);
      } else {
        arr.push(parseScalar(afterDash));
      }
    }
    return arr;
  }

  const result = parseBlock(lines[0].indent);
  if (typeof result !== 'object' || result === null || Array.isArray(result)) {
    throw new Error('YAML root document must be a mapping object.');
  }
  return result as Record<string, unknown>;
}

function formatYamlScalar(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  const str = String(value);
  if (
    str === '' ||
    /^(?:true|false|null|~|\d|\s)|[:#[\]{}&*!|>'"%@`]|^\.|-\s|\s$/.test(str)
  ) {
    return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
  }
  return str;
}

export function stringifyYaml(data: Record<string, unknown>, indent = 0): string {
  const pad = ' '.repeat(indent);
  const out: string[] = [];

  for (const [rawKey, val] of Object.entries(data)) {
    const key = /[:#\s]/.test(rawKey) ? `"${rawKey}"` : rawKey;
    if (Array.isArray(val)) {
      if (val.length === 0) {
        out.push(`${pad}${key}: []`);
      } else {
        out.push(`${pad}${key}:`);
        for (const item of val) {
          if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
            const entries = Object.entries(item as Record<string, unknown>);
            if (entries.length === 0) {
              out.push(`${pad}  - {}`);
            } else {
              const [firstK, firstV] = entries[0];
              if (Array.isArray(firstV) && firstV.length > 0) {
                out.push(`${pad}  - ${firstK}:`);
                for (const sub of firstV) {
                  out.push(`${pad}      - ${formatYamlScalar(sub)}`);
                }
              } else if (Array.isArray(firstV) && firstV.length === 0) {
                out.push(`${pad}  - ${firstK}: []`);
              } else {
                out.push(`${pad}  - ${firstK}: ${formatYamlScalar(firstV)}`);
              }
              for (let idx = 1; idx < entries.length; idx++) {
                const [k, v] = entries[idx];
                if (Array.isArray(v)) {
                  if (v.length === 0) {
                    out.push(`${pad}    ${k}: []`);
                  } else {
                    out.push(`${pad}    ${k}:`);
                    for (const sub of v) {
                      out.push(`${pad}      - ${formatYamlScalar(sub)}`);
                    }
                  }
                } else if (typeof v === 'object' && v !== null) {
                  out.push(`${pad}    ${k}:`);
                  out.push(stringifyYaml(v as Record<string, unknown>, indent + 6).trimEnd());
                } else {
                  out.push(`${pad}    ${k}: ${formatYamlScalar(v)}`);
                }
              }
            }
          } else {
            out.push(`${pad}  - ${formatYamlScalar(item)}`);
          }
        }
      }
    } else if (typeof val === 'object' && val !== null) {
      const subEntries = Object.entries(val as Record<string, unknown>);
      if (subEntries.length === 0) {
        out.push(`${pad}${key}: {}`);
      } else {
        out.push(`${pad}${key}:`);
        out.push(stringifyYaml(val as Record<string, unknown>, indent + 2).trimEnd());
      }
    } else {
      out.push(`${pad}${key}: ${formatYamlScalar(val)}`);
    }
  }
  return out.join('\n') + '\n';
}

export interface ParsedMarkdown {
  hasFrontmatter: boolean;
  frontmatter: Record<string, unknown>;
  body: string;
}

export function parseMarkdownFrontmatter(markdownText: string): ParsedMarkdown {
  const norm = normalizeLf(markdownText);
  if (!norm.startsWith('---\n')) {
    return { hasFrontmatter: false, frontmatter: {}, body: norm };
  }
  const endMarker = norm.indexOf('\n---\n', 4);
  if (endMarker === -1) {
    if (norm.endsWith('\n---')) {
      const rawYaml = norm.slice(4, -4);
      return { hasFrontmatter: true, frontmatter: parseYaml(rawYaml), body: '' };
    }
    throw new Error('Unclosed YAML frontmatter delimiter (missing closing ---).');
  }
  const rawYaml = norm.slice(4, endMarker);
  const body = norm.slice(endMarker + 5);
  return {
    hasFrontmatter: true,
    frontmatter: parseYaml(rawYaml),
    body
  };
}

export function serializeMarkdownWithFrontmatter(
  frontmatter: Record<string, unknown>,
  body: string
): string {
  const yamlBlock = stringifyYaml(frontmatter).trimEnd();
  const normBody = normalizeLf(body).replace(/^\n+/, '');
  return `---\n${yamlBlock}\n---\n\n${normBody}`;
}
