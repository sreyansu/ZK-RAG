'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

let ChartJS = null;

export default function Home() {
  const [docId, setDocId] = useState('');
  const [root, setRoot] = useState('');
  const [chunkCount, setChunkCount] = useState(0);
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState([]);
  const [timing, setTiming] = useState(null);
  const [verifs, setVerifs] = useState({});
  const [proofData, setProofData] = useState({});
  const [tamperOpen, setTamperOpen] = useState({});
  const [tamperText, setTamperText] = useState({});
  const [bench, setBench] = useState(null);
  const [busy, setBusy] = useState({});
  const chartRef = useRef(null);
  const chartInst = useRef(null);

  const setB = (k, v) => setBusy(b => ({ ...b, [k]: v }));

  // ── Commit ──
  const commit = async () => {
    setB('commit', true);
    try {
      const r = await fetch('/api/commit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: '' }) });
      const d = await r.json();
      if (d.success) { setDocId(d.documentId); setRoot(d.merkleRoot); setChunkCount(d.chunkCount); }
      else alert(d.error);
    } catch (e) { alert(e.message); }
    setB('commit', false);
  };

  // ── Query ──
  const ask = async () => {
    if (!query.trim()) return;
    setB('query', true); setAnswer(''); setCitations([]); setVerifs({}); setProofData({});
    try {
      const r = await fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, documentId: docId }) });
      const d = await r.json();
      if (d.success) { setAnswer(d.answer); setCitations(d.citations); setTiming(d.timing); }
      else alert(d.error);
    } catch (e) { alert(e.message); }
    setB('query', false);
  };

  // ── Verify ──
  const verify = async (cid, text) => {
    setB(`v${cid}`, true); setVerifs(v => ({ ...v, [cid]: null }));
    try {
      const pr = await fetch('/api/prove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chunkId: cid, documentId: docId }) });
      const pd = await pr.json();
      if (!pd.success) { setVerifs(v => ({ ...v, [cid]: { error: pd.error } })); setB(`v${cid}`, false); return; }
      setProofData(p => ({ ...p, [cid]: pd }));

      const vr = await fetch('/api/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chunkText: text, proof: pd.proof, publicSignals: pd.publicSignals, merkleRoot: root }) });
      const vd = await vr.json();
      setVerifs(v => ({ ...v, [cid]: { ...vd, genMs: pd.proofGenerationMs } }));
    } catch (e) { setVerifs(v => ({ ...v, [cid]: { error: e.message } })); }
    setB(`v${cid}`, false);
  };

  // ── Tamper ──
  const tamper = async (cid) => {
    const t = tamperText[cid]; if (!t) return;
    setB(`t${cid}`, true);
    try {
      const r = await fetch('/api/tamper', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chunkId: cid, documentId: docId, tamperedText: t }) });
      const d = await r.json();
      if (d.success) {
        setCitations(c => c.map(x => x.chunkId === cid ? { ...x, text: t, preview: t.substring(0, 150) + '...', tampered: true } : x));
        setTamperOpen(o => ({ ...o, [cid]: false }));
        setVerifs(v => ({ ...v, [cid]: null }));
      }
    } catch (e) { alert(e.message); }
    setB(`t${cid}`, false);
  };

  const reset = async (cid) => {
    setB(`r${cid}`, true);
    try {
      const r = await fetch('/api/tamper', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chunkId: cid, documentId: docId }) });
      const d = await r.json();
      if (d.success) {
        setCitations(c => c.map(x => x.chunkId === cid ? { ...x, text: d.restoredText, preview: d.restoredText.substring(0, 150) + '...', tampered: false } : x));
        setVerifs(v => ({ ...v, [cid]: null })); setTamperText(t => ({ ...t, [cid]: '' }));
      }
    } catch (e) { alert(e.message); }
    setB(`r${cid}`, false);
  };

  // ── Benchmark ──
  const benchmark = async () => {
    setB('bench', true);
    try {
      const r = await fetch('/api/benchmark');
      const d = await r.json();
      if (d.success) setBench(d);
      else alert(d.error);
    } catch (e) { alert(e.message); }
    setB('bench', false);
  };

  // ── Chart ──
  useEffect(() => {
    if (!bench || !chartRef.current) return;
    (async () => {
      if (!ChartJS) { const m = await import('chart.js'); m.Chart.register(...m.registerables); ChartJS = m.Chart; }
      if (chartInst.current) chartInst.current.destroy();
      chartInst.current = new ChartJS(chartRef.current.getContext('2d'), {
        type: 'bar',
        data: {
          labels: bench.results.map(r => `Chunk ${r.chunkId}`),
          datasets: [
            { label: 'Baseline (ms)', data: bench.results.map(r => r.baselineMs), backgroundColor: '#7c3aed', borderRadius: 4 },
            { label: 'Proof Gen (ms)', data: bench.results.map(r => Math.max(r.proofGenMs, 0)), backgroundColor: '#0891b2', borderRadius: 4 },
            { label: 'Verification (ms)', data: bench.results.map(r => Math.max(r.proofVerifyMs, 0)), backgroundColor: '#16a34a', borderRadius: 4 },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#a1a1aa', font: { family: 'Inter', size: 11 } } } },
          scales: {
            x: { grid: { color: '#27272a' }, ticks: { color: '#71717a' } },
            y: { grid: { color: '#27272a' }, ticks: { color: '#71717a', callback: v => v + 'ms' } },
          },
        },
      });
    })();
    return () => { if (chartInst.current) chartInst.current.destroy(); };
  }, [bench]);

  // ────────── RENDER ──────────

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <h1>ZK-RAG</h1>
        <p>Zero-Knowledge Retrieval-Augmented Generation</p>
        <div className="tech">Groth16 · Poseidon Hash · Merkle Tree · snarkjs</div>
      </div>

      {/* Step 1: Commit */}
      <div className="section">
        <div className="section-label"><span className="step">1</span> Commit Document</div>
        {!docId ? (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12 }}>
              Load the sample document, split it into chunks, hash each with Poseidon, and build a Merkle tree. The root hash becomes a public certificate.
            </p>
            <button className="btn btn-purple" onClick={commit} disabled={busy.commit} id="commit-btn">
              {busy.commit ? <><span className="spin" /> Committing...</> : '📄 Commit Sample Document'}
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--green)' }}>✓ Document committed — {chunkCount} chunks</div>
            <div className="merkle-root">
              <span className="label">Merkle Root</span>
              {root}
            </div>
          </>
        )}
      </div>

      {/* Step 2: Query */}
      {docId && (
        <div className="section">
          <div className="section-label"><span className="step">2</span> Ask a Question</div>
          <div className="input-row">
            <input className="input" placeholder="e.g. What is the alignment problem?" value={query}
              onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && ask()} id="query-input" />
            <button className="btn btn-purple" onClick={ask} disabled={busy.query || !query.trim()} id="query-btn">
              {busy.query ? <span className="spin" /> : 'Ask'}
            </button>
          </div>

          {answer && (
            <>
              <div className="answer">{answer}</div>
              {timing && (
                <div className="timing">
                  <span>Retrieval: {timing.retrievalMs}ms</span>
                  <span>LLM: {timing.llmMs.toFixed(0)}ms</span>
                </div>
              )}
            </>
          )}

          {/* Citations */}
          {citations.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div className="section-label"><span className="step">3</span> Citations — Verify or Tamper</div>
              {citations.map(c => (
                <div key={c.chunkId} className={`citation ${c.tampered ? 'tampered' : ''}`}>
                  <div className="citation-top">
                    <span className="citation-id">Chunk #{c.chunkId}</span>
                    {c.tampered && <span className="tampered-tag">Tampered</span>}
                    <span className="citation-sim">cosine: {c.similarity}</span>
                  </div>
                  <div className="citation-text">{c.preview}</div>

                  <div className="citation-actions">
                    <button className="btn btn-green btn-sm" onClick={() => verify(c.chunkId, c.text)} disabled={busy[`v${c.chunkId}`]} id={`verify-${c.chunkId}`}>
                      {busy[`v${c.chunkId}`] ? <><span className="spin" /> Proving...</> : '🔐 Verify (ZK)'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setTamperOpen(o => ({ ...o, [c.chunkId]: !o[c.chunkId] })); setTamperText(t => ({ ...t, [c.chunkId]: t[c.chunkId] || c.text })); }}>
                      {tamperOpen[c.chunkId] ? '✕ Close' : '🔧 Tamper'}
                    </button>
                    {c.tampered && (
                      <button className="btn btn-ghost btn-sm" onClick={() => reset(c.chunkId)} disabled={busy[`r${c.chunkId}`]}>↺ Reset</button>
                    )}
                  </div>

                  {/* Verification result */}
                  {verifs[c.chunkId] && (
                    <div style={{ marginTop: 10 }}>
                      {verifs[c.chunkId].error ? (
                        <div className="badge fail">❌ Error: {verifs[c.chunkId].error}</div>
                      ) : (
                        <>
                          <div className={`badge ${verifs[c.chunkId].valid ? 'pass' : 'fail'}`}>
                            {verifs[c.chunkId].valid ? '✅ Cryptographically Verified' : '❌ Provenance Invalid'}
                          </div>
                          <div className="timing" style={{ marginTop: 6 }}>
                            {proofData[c.chunkId] && <span>Proof gen: {proofData[c.chunkId].proofGenerationMs}ms</span>}
                            <span>Verify: {verifs[c.chunkId].timingMs}ms</span>
                          </div>
                          <div className="verify-details">
                            <div><b>SNARK valid:</b> {verifs[c.chunkId].snarkValid ? '✅' : '❌'}</div>
                            <div><b>Hash match:</b> {verifs[c.chunkId].hashMatches ? '✅' : '❌'}</div>
                            <div><b>Root match:</b> {verifs[c.chunkId].rootMatches ? '✅' : '❌'}</div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Tamper panel */}
                  {tamperOpen[c.chunkId] && (
                    <div className="tamper-box">
                      <h4>🔧 Tamper Demo</h4>
                      <p>Edit the text, apply, then re-verify. The ZK proof will fail because the hash no longer matches the Merkle tree.</p>
                      <textarea value={tamperText[c.chunkId] || c.text} onChange={e => setTamperText(t => ({ ...t, [c.chunkId]: e.target.value }))} />
                      <div style={{ marginTop: 6 }}>
                        <button className="btn btn-red btn-sm" onClick={() => tamper(c.chunkId)}
                          disabled={busy[`t${c.chunkId}`] || !tamperText[c.chunkId] || tamperText[c.chunkId] === c.text}>
                          {busy[`t${c.chunkId}`] ? <span className="spin" /> : '⚡ Apply Tamper'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Benchmark */}
      {docId && (
        <div className="section">
          <div className="section-label"><span className="step">4</span> Benchmark</div>
          <button className="btn btn-cyan" onClick={benchmark} disabled={busy.bench} id="bench-btn">
            {busy.bench ? <><span className="spin" /> Running...</> : '⚡ Run Benchmark'}
          </button>

          {bench && (
            <div style={{ marginTop: 16 }}>
              <div className="stats-row">
                <div className="stat"><div className="stat-val v1">~{bench.averages.baselineMs.toFixed(3)}</div><div className="stat-lbl">Baseline (ms)</div></div>
                <div className="stat"><div className="stat-val v2">{bench.averages.proofGenMs.toFixed(0)}</div><div className="stat-lbl">Proof Gen (ms)</div></div>
                <div className="stat"><div className="stat-val v3">{bench.averages.proofVerifyMs.toFixed(0)}</div><div className="stat-lbl">Verify (ms)</div></div>
              </div>
              <div className="chart-wrap"><canvas ref={chartRef} /></div>
            </div>
          )}
        </div>
      )}

      {/* How it works */}
      <div className="section">
        <div className="section-label">How ZK-RAG Works</div>
        <div className="steps">
          <div className="hw-step"><span className="hw-num">1</span><div><strong>Commit</strong> — chunk the document, Poseidon-hash each chunk, build a Merkle tree, publish the root</div></div>
          <div className="hw-step"><span className="hw-num">2</span><div><strong>Retrieve</strong> — embed the query, find similar chunks via cosine similarity, generate an LLM answer</div></div>
          <div className="hw-step"><span className="hw-num">3</span><div><strong>Prove</strong> — generate a Groth16 SNARK proving the cited chunk&apos;s hash is a Merkle leaf under the published root</div></div>
          <div className="hw-step"><span className="hw-num">4</span><div><strong>Verify</strong> — recompute the chunk&apos;s hash, verify the SNARK. If tampered, hash changes → proof fails ❌</div></div>
        </div>
      </div>
    </div>
  );
}
