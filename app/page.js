'use client';

import { useState, useRef, useEffect } from 'react';

export default function Home() {
  const [kbStatus, setKbStatus] = useState(null);
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState([]);
  const [timing, setTiming] = useState(null);
  
  const [verifs, setVerifs] = useState({});
  const [proofData, setProofData] = useState({});
  const [tamperOpen, setTamperOpen] = useState({});
  const [tamperText, setTamperText] = useState({});
  const [busy, setBusy] = useState({});

  const setB = (k, v) => setBusy(b => ({ ...b, [k]: v }));

  // ── Initialize Knowledge Base on Mount ──
  useEffect(() => {
    const initKB = async () => {
      setB('init', true);
      try {
        const r = await fetch('/api/init');
        const d = await r.json();
        if (d.success) setKbStatus(d);
        else console.error('Failed to init KB:', d.error);
      } catch (e) {
        console.error(e);
      }
      setB('init', false);
    };
    initKB();
  }, []);

  // ── Query ──
  const ask = async () => {
    if (!query.trim()) return;
    setB('query', true); setAnswer(''); setCitations([]); setVerifs({}); setProofData({});
    try {
      const r = await fetch('/api/query', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ query }) 
      });
      const d = await r.json();
      if (d.success) { setAnswer(d.answer); setCitations(d.citations); setTiming(d.timing); }
      else alert(d.error);
    } catch (e) { alert(e.message); }
    setB('query', false);
  };

  // ── Verify ──
  const verify = async (docId, cid, text) => {
    const vKey = `${docId}-${cid}`;
    setB(`v${vKey}`, true); setVerifs(v => ({ ...v, [vKey]: null }));
    try {
      // 1. Get Proof
      const pr = await fetch('/api/prove', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ chunkId: cid, documentId: docId }) 
      });
      const pd = await pr.json();
      if (!pd.success) { setVerifs(v => ({ ...v, [vKey]: { error: pd.error } })); setB(`v${vKey}`, false); return; }
      setProofData(p => ({ ...p, [vKey]: pd }));

      // Get the correct root from kbStatus
      const doc = kbStatus.documents.find(d => d.id === docId);

      // 2. Verify Proof Standalone
      const vr = await fetch('/api/verify', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ chunkText: text, proof: pd.proof, publicSignals: pd.publicSignals, merkleRoot: doc.root }) 
      });
      const vd = await vr.json();
      setVerifs(v => ({ ...v, [vKey]: { ...vd, genMs: pd.proofGenerationMs } }));
    } catch (e) { setVerifs(v => ({ ...v, [vKey]: { error: e.message } })); }
    setB(`v${vKey}`, false);
  };

  // ── Tamper ──
  const tamper = async (docId, cid) => {
    const tKey = `${docId}-${cid}`;
    const t = tamperText[tKey]; if (!t) return;
    setB(`t${tKey}`, true);
    try {
      const r = await fetch('/api/tamper', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ chunkId: cid, documentId: docId, tamperedText: t }) 
      });
      const d = await r.json();
      if (d.success) {
        setCitations(c => c.map(x => (x.chunkId === cid && x.documentId === docId) ? { ...x, text: t, preview: t.substring(0, 150) + '...', tampered: true } : x));
        setTamperOpen(o => ({ ...o, [tKey]: false }));
        setVerifs(v => ({ ...v, [tKey]: null }));
      }
    } catch (e) { alert(e.message); }
    setB(`t${tKey}`, false);
  };

  const reset = async (docId, cid) => {
    const tKey = `${docId}-${cid}`;
    setB(`r${tKey}`, true);
    try {
      const r = await fetch('/api/tamper', { 
        method: 'DELETE', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ chunkId: cid, documentId: docId }) 
      });
      const d = await r.json();
      if (d.success) {
        setCitations(c => c.map(x => (x.chunkId === cid && x.documentId === docId) ? { ...x, text: d.restoredText, preview: d.restoredText.substring(0, 150) + '...', tampered: false } : x));
        setVerifs(v => ({ ...v, [tKey]: null })); setTamperText(t => ({ ...t, [tKey]: '' }));
      }
    } catch (e) { alert(e.message); }
    setB(`r${tKey}`, false);
  };

  // ────────── RENDER ──────────

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <h1>ZK-RAG Search</h1>
        <p>Verifiable AI Search Engine</p>
        <div className="tech">Powered by Groth16 zk-SNARKs and Poseidon Merkle Trees</div>
      </div>

      {/* KB Status */}
      <div className="section">
        <div className="section-label">Verified Knowledge Base</div>
        {!kbStatus ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            <span className="spin" style={{ marginRight: 8 }}/> Loading verifiable sources...
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 13, color: 'var(--green)', marginBottom: 12 }}>
              ✓ Indexed {kbStatus.documentCount} verified documents
            </div>
            {kbStatus.documents.map(d => (
              <div key={d.id} className="merkle-root" style={{ marginBottom: 8 }}>
                <span className="label">Source: {d.name}.txt ({d.chunkCount} chunks)</span>
                Root: {d.root}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Query */}
      <div className="section">
        <div className="section-label">Ask a Question</div>
        <div className="input-row">
          <input className="input" placeholder="e.g. Is creatine good for daily consumption?" value={query}
            onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && ask()} disabled={!kbStatus || busy.init} />
          <button className="btn btn-purple" onClick={ask} disabled={busy.query || !query.trim() || !kbStatus}>
            {busy.query ? <span className="spin" /> : 'Ask AI'}
          </button>
        </div>

        {answer && (
          <>
            <div className="answer">{answer}</div>
            {timing && (
              <div className="timing">
                <span>Search: {timing.retrievalMs}ms</span>
                <span>Generation: {timing.llmMs.toFixed(0)}ms</span>
              </div>
            )}
          </>
        )}

        {/* Citations */}
        {citations.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div className="section-label">Sources Used — Verify their authenticity</div>
            {citations.map(c => {
              const vKey = `${c.documentId}-${c.chunkId}`;
              return (
                <div key={vKey} className={`citation ${c.tampered ? 'tampered' : ''}`}>
                  <div className="citation-top">
                    <span className="citation-id">{c.documentName}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Chunk #{c.chunkId}</span>
                    {c.tampered && <span className="tampered-tag" style={{ marginLeft: 'auto' }}>Tampered</span>}
                  </div>
                  <div className="citation-text">{c.preview}</div>

                  <div className="citation-actions">
                    <button className="btn btn-green btn-sm" onClick={() => verify(c.documentId, c.chunkId, c.text)} disabled={busy[`v${vKey}`]}>
                      {busy[`v${vKey}`] ? <><span className="spin" /> Proving...</> : '🔐 Verify Source (ZK)'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setTamperOpen(o => ({ ...o, [vKey]: !o[vKey] })); setTamperText(t => ({ ...t, [vKey]: t[vKey] || c.text })); }}>
                      {tamperOpen[vKey] ? '✕ Close' : '🔧 Edit Source Demo'}
                    </button>
                    {c.tampered && (
                      <button className="btn btn-ghost btn-sm" onClick={() => reset(c.documentId, c.chunkId)} disabled={busy[`r${vKey}`]}>↺ Restore</button>
                    )}
                  </div>

                  {/* Verification result */}
                  {verifs[vKey] && (
                    <div style={{ marginTop: 10 }}>
                      {verifs[vKey].error ? (
                        <div className="badge fail">❌ Error: {verifs[vKey].error}</div>
                      ) : (
                        <>
                          <div className={`badge ${verifs[vKey].valid ? 'pass' : 'fail'}`}>
                            {verifs[vKey].valid ? '✅ Source Authentic' : '❌ Source Forged'}
                          </div>
                          <div className="timing" style={{ marginTop: 6 }}>
                            {proofData[vKey] && <span>Proof gen: {proofData[vKey].proofGenerationMs}ms</span>}
                            <span>Verify: {verifs[vKey].timingMs}ms</span>
                          </div>
                          <div className="verify-details">
                            <div><b>SNARK valid:</b> {verifs[vKey].snarkValid ? '✅' : '❌'}</div>
                            <div><b>Hash match:</b> {verifs[vKey].hashMatches ? '✅' : '❌'}</div>
                            <div><b>Root match:</b> {verifs[vKey].rootMatches ? '✅' : '❌'}</div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Tamper panel */}
                  {tamperOpen[vKey] && (
                    <div className="tamper-box">
                      <h4>🔧 Forge Source Demo</h4>
                      <p>Change the text, apply, then re-verify. The ZK proof will fail because the new hash doesn&apos;t match the original published document.</p>
                      <textarea value={tamperText[vKey] || c.text} onChange={e => setTamperText(t => ({ ...t, [vKey]: e.target.value }))} />
                      <div style={{ marginTop: 6 }}>
                        <button className="btn btn-red btn-sm" onClick={() => tamper(c.documentId, c.chunkId)}
                          disabled={busy[`t${vKey}`] || !tamperText[vKey] || tamperText[vKey] === c.text}>
                          {busy[`t${vKey}`] ? <span className="spin" /> : '⚡ Apply Edit'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
