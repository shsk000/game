import { type ReactNode, useEffect, useRef } from 'react';

type Props = {
  lines: string[];
  currentlyTyping?: string;
  bugLineIdx?: number | null;
  mode?: 'develop' | 'building';
};

const KEYWORDS = new Set([
  'function',
  'class',
  'const',
  'async',
  'await',
  'export',
  'public',
  'private',
  'interface',
  'extends',
  'return',
  'new',
  'if',
  'for',
  'of',
]);

const BUILD_LOG = [
  '> Compiling sources...',
  '> Linking modules...',
  '> Optimizing bundle...',
  '> Generating assets...',
  '> Running checks...',
];

const renderTokens = (line: string): ReactNode[] => {
  // Comment short-circuit
  const cmt = line.indexOf('//');
  if (cmt >= 0) {
    const head = line.slice(0, cmt);
    const tail = line.slice(cmt);
    return [
      ...renderTokens(head),
      <span key={`cmt-${cmt}`} className="ce-cmt">
        {tail}
      </span>,
    ];
  }

  const nodes: ReactNode[] = [];
  // Split, keeping delimiters: strings ('...' or "..."), word chars, and other chars.
  const re = /('[^']*'|"[^"]*"|[A-Za-z_][A-Za-z0-9_]*|[^A-Za-z_'"]+)/g;
  let m: RegExpExecArray | null;
  let i = 0;
  // biome-ignore lint/suspicious/noAssignInExpressions: pattern for regex iteration
  while ((m = re.exec(line)) !== null) {
    const tok = m[0];
    if ((tok.startsWith("'") && tok.endsWith("'")) || (tok.startsWith('"') && tok.endsWith('"'))) {
      nodes.push(
        <span key={`s-${i}`} className="ce-str">
          {tok}
        </span>,
      );
    } else if (KEYWORDS.has(tok)) {
      nodes.push(
        <span key={`k-${i}`} className="ce-kw">
          {tok}
        </span>,
      );
    } else {
      nodes.push(<span key={`t-${i}`}>{tok}</span>);
    }
    i += 1;
  }
  return nodes;
};

export const CodeEditor = ({ lines, currentlyTyping, bugLineIdx, mode = 'develop' }: Props) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  return (
    <div ref={ref} className="code-editor">
      {mode === 'building' &&
        BUILD_LOG.map((log, i) => (
          <div key={`log-${i}`} className="ce-line">
            <span className="ce-lineno">{'>'}</span>
            <span className="ce-content ce-buildlog">{log}</span>
          </div>
        ))}
      {lines.map((line, i) => {
        const isBug = bugLineIdx === i;
        return (
          <div key={`l-${i}`}>
            <div className="ce-line">
              <span className="ce-lineno">{i + 1}</span>
              <span className={`ce-content${isBug ? ' ce-bug' : ''}`}>{renderTokens(line)}</span>
            </div>
            {isBug && <div className="ce-bug-caption">^ syntax error: missing )</div>}
          </div>
        );
      })}
      {currentlyTyping && (
        <div className="ce-line">
          <span className="ce-lineno">{lines.length + 1}</span>
          <span className="ce-content">{currentlyTyping}</span>
        </div>
      )}
    </div>
  );
};
