'use client';

import { useState, useRef, useEffect } from 'react';

// Custom sleek animated progress bar
const ProgressBar = ({ label, value, max, color, isZk = false, unit = '' }) => {
  const percent = Math.min((value / max) * 100, 100);
  return (
    <div className="custom-bar-container">
      <div className="custom-bar-header">
        <span className="custom-bar-label">{label} {isZk && <span className="zk-badge">ZK</span>}</span>
        <span className="custom-bar-value">{value}{unit}</span>
      </div>
      <div className="custom-bar-track">
        <div 
          className={`custom-bar-fill ${isZk ? 'glow' : ''}`} 
          style={{ 
            width: `${percent}%`, 
            background: color 
          }}
        />
      </div>
    </div>
  );
};

// Custom sleek circular gauge
const CircularGauge = ({ value, label, color, isZk = false }) => {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="gauge-container">
      <div className="gauge-svg-wrap">
        <svg width="120" height="120" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} className="gauge-bg" />
          <circle 
            cx="50" cy="50" r={radius} 
            className={`gauge-fill ${isZk ? 'glow-stroke' : ''}`}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: strokeDashoffset,
              stroke: color
            }}
          />
        </svg>
        <div className="gauge-center">
          <span className="gauge-value">{value}%</span>
        </div>
      </div>
      <div className="gauge-label">{label} {isZk && <span className="zk-badge">ZK</span>}</div>
    </div>
  );
};


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
  const [bench, setBench] = useState(null);
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
      const pr = await fetch('/api/prove', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ chunkId: cid, documentId: docId }) 
      });
      const pd = await pr.json();
      if (!pd.success) { setVerifs(v => ({ ...v, [vKey]: { error: pd.error } })); setB(`v${vKey}`, false); return; }
      setProofData(p => ({ ...p, [vKey]: pd }));

      const doc = kbStatus.documents.find(d => d.id === docId);

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

  // ── Benchmark ──
  const benchmark = async () => {
    setB('bench', true);
    try {
      const r = await fetch('/api/benchmark');
      const d = await r.json();
      if (d.success) setBench(d.metrics);
      else alert(d.error);
    } catch (e) { alert(e.message); }
    setB('bench', false);
  };

  // ────────── RENDER ──────────

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <div className="hero-badge">Next-Gen Cryptography</div>
        <h1>ZK-RAG Engine</h1>
        <p>Zero-Knowledge Retrieval-Augmented Generation</p>
        <div className="tech">Powered by Groth16 zk-SNARKs • Poseidon Merkle Trees • Vector Search</div>
      </div>

      {/* KB Status */}
      <div className="section premium-box">
        <div className="section-label">Verified Knowledge Base</div>
        {!kbStatus ? (
          <div className="loading-state">
            <span className="spin" style={{ marginRight: 8 }}/> Initializing Cryptographic Accumulators...
          </div>
        ) : (
          <div>
            <div className="status-success">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
              Indexed {kbStatus.documentCount} verified documents
            </div>
            <div className="merkle-grid">
              {kbStatus.documents.map(d => (
                <div key={d.id} className="merkle-root">
                  <span className="label">Source: {d.name}.txt <span className="chunk-badge">{d.chunkCount} chunks</span></span>
                  <div className="hash-string">{d.root}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Query */}
      <div className="section premium-box">
        <div className="section-label">Ask a Question</div>
        <div className="search-bar-wrap">
          <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input className="input search-input" placeholder="e.g. Is creatine good for daily consumption?" value={query}
            onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && ask()} disabled={!kbStatus || busy.init} />
          <button className="btn btn-primary" onClick={ask} disabled={busy.query || !query.trim() || !kbStatus}>
            {busy.query ? <span className="spin" /> : 'Generate'}
          </button>
        </div>

        {answer && (
          <div className="answer-wrapper">
            <div className="answer">{answer}</div>
            {timing && (
              <div className="timing-pills">
                <span className="pill pill-blue">Search: {timing.retrievalMs}ms</span>
                <span className="pill pill-purple">Generation: {timing.llmMs.toFixed(0)}ms</span>
              </div>
            )}
          </div>
        )}

        {/* Citations */}
        {citations.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <div className="section-label flex-between">
              <span>Cryptographic Citations</span>
              <span className="found-badge">{citations.length} Found</span>
            </div>
            
            <div className="citations-grid">
              {citations.map(c => {
                const vKey = `${c.documentId}-${c.chunkId}`;
                return (
                  <div key={vKey} className={`citation-card ${c.tampered ? 'is-tampered' : ''}`}>
                    <div className="citation-top">
                      <div className="citation-id">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        {c.documentName}
                      </div>
                      <span className="chunk-id">Chunk #{c.chunkId}</span>
                      {c.tampered && <span className="tampered-tag ml-auto">Data Altered</span>}
                    </div>
                    <div className="citation-text">{c.preview}</div>

                    <div className="citation-actions">
                      <button className="btn btn-zk" onClick={() => verify(c.documentId, c.chunkId, c.text)} disabled={busy[`v${vKey}`]}>
                        {busy[`v${vKey}`] ? <><span className="spin" /> Proving...</> : <>🔐 Verify with ZK-SNARK</>}
                      </button>
                      <button className="btn btn-ghost" onClick={() => { setTamperOpen(o => ({ ...o, [vKey]: !o[vKey] })); setTamperText(t => ({ ...t, [vKey]: t[vKey] || c.text })); }}>
                        {tamperOpen[vKey] ? '✕ Close' : '🔧 Test Forgery'}
                      </button>
                      {c.tampered && (
                        <button className="btn btn-ghost" onClick={() => reset(c.documentId, c.chunkId)} disabled={busy[`r${vKey}`]}>↺ Restore Data</button>
                      )}
                    </div>

                    {/* Verification result */}
                    {verifs[vKey] && (
                      <div className="verification-result">
                        {verifs[vKey].error ? (
                          <div className="alert alert-error">❌ Verification Failed: {verifs[vKey].error}</div>
                        ) : (
                          <>
                            <div className={`alert ${verifs[vKey].valid ? 'alert-success' : 'alert-error'}`}>
                              {verifs[vKey].valid ? (
                                <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg> Mathematical Proof Valid — Source Authentic</>
                              ) : (
                                <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg> Proof Rejected — Source Forged or Altered</>
                              )}
                            </div>
                            
                            <div className="proof-timings">
                              {proofData[vKey] && <div>Proof Generation: <span>{proofData[vKey].proofGenerationMs}ms</span></div>}
                              <div>Verification: <span>{verifs[vKey].timingMs}ms</span></div>
                            </div>
                            
                            <div className="proof-details">
                              <div className="proof-row"><span>ZK-SNARK Equation:</span> {verifs[vKey].snarkValid ? <span className="pass">Satisfied</span> : <span className="fail">Violated</span>}</div>
                              <div className="proof-row"><span>Leaf Hash Integrity:</span> {verifs[vKey].hashMatches ? <span className="pass">Matched</span> : <span className="fail">Mismatch</span>}</div>
                              <div className="proof-row"><span>Merkle Root Integrity:</span> {verifs[vKey].rootMatches ? <span className="pass">Matched</span> : <span className="fail">Mismatch</span>}</div>
                              
                              {proofData[vKey]?.leafHash && (
                                <div className="hash-display">
                                  <div className="hash-item"><span>Leaf Hash</span> {proofData[vKey].leafHash.substring(0, 12)}...{proofData[vKey].leafHash.substring(proofData[vKey].leafHash.length - 12)}</div>
                                  <div className="hash-item"><span>Root Hash</span> {proofData[vKey].merkleRoot.substring(0, 12)}...{proofData[vKey].merkleRoot.substring(proofData[vKey].merkleRoot.length - 12)}</div>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Tamper panel */}
                    {tamperOpen[vKey] && (
                      <div className="tamper-panel">
                        <div className="tamper-header">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                          Simulate Data Forgery
                        </div>
                        <p>Alter the text below. The ZK verification will catch the mismatch between the altered data and the original Merkle Root.</p>
                        <textarea value={tamperText[vKey] || c.text} onChange={e => setTamperText(t => ({ ...t, [vKey]: e.target.value }))} />
                        <button className="btn btn-danger mt-2" onClick={() => tamper(c.documentId, c.chunkId)}
                          disabled={busy[`t${vKey}`] || !tamperText[vKey] || tamperText[vKey] === c.text}>
                          {busy[`t${vKey}`] ? <span className="spin" /> : 'Inject Forgery'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Benchmark Metrics Dashboard */}
      {kbStatus && (
        <div className="section premium-box" style={{ paddingBottom: 40, marginBottom: 80 }}>
          <div className="section-label">Architecture Evaluation Dashboard</div>
          <p className="section-desc">Comparing standard Retrieval-Augmented Generation against Zero-Knowledge RAG.</p>
          
          {!bench ? (
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={benchmark} disabled={busy.bench}>
              {busy.bench ? <><span className="spin" /> Generating Metrics...</> : '📊 Run Architecture Comparison'}
            </button>
          ) : (
            <div className="metrics-grid">
              
              {/* Performance Metrics (Horizontal Bars) */}
              <div className="metric-card">
                <div className="metric-header">
                  <h3>{bench.latency.title}</h3>
                  <p>{bench.latency.desc}</p>
                </div>
                <div className="metric-body bars">
                  <ProgressBar label="Standard RAG" value={bench.latency.standard} max={200} color="#52525b" unit="ms" />
                  <ProgressBar label="ZK-RAG" value={bench.latency.zkrag} max={200} color="linear-gradient(90deg, #8b5cf6, #3b82f6)" isZk unit="ms" />
                </div>
              </div>
              
              <div className="metric-card">
                <div className="metric-header">
                  <h3>{bench.overhead.title}</h3>
                  <p>{bench.overhead.desc}</p>
                </div>
                <div className="metric-body bars">
                  <ProgressBar label="Standard RAG" value={bench.overhead.standard} max={3.0} color="#52525b" unit="x" />
                  <ProgressBar label="ZK-RAG" value={bench.overhead.zkrag} max={3.0} color="linear-gradient(90deg, #8b5cf6, #3b82f6)" isZk unit="x" />
                </div>
              </div>

              {/* Security Metrics (Circular Gauges) */}
              <div className="metric-card">
                <div className="metric-header">
                  <h3>{bench.trust.title}</h3>
                  <p>{bench.trust.desc}</p>
                </div>
                <div className="metric-body gauges">
                  <CircularGauge label="Standard RAG" value={bench.trust.standard} color="#52525b" />
                  <CircularGauge label="ZK-RAG" value={bench.trust.zkrag} color="#10b981" isZk />
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-header">
                  <h3>{bench.tamper.title}</h3>
                  <p>{bench.tamper.desc}</p>
                </div>
                <div className="metric-body gauges">
                  <CircularGauge label="Standard RAG" value={bench.tamper.standard} color="#52525b" />
                  <CircularGauge label="ZK-RAG" value={bench.tamper.zkrag} color="#06b6d4" isZk />
                </div>
              </div>

            </div>
          )}
        </div>
      )}

    </div>
  );
}
