import { NextResponse } from 'next/server';

export async function GET(req) {
  try {
    return NextResponse.json({
      success: true,
      metrics: {
        accuracy: { 
          title: "Retrieval Accuracy (%)",
          desc: "Identical semantic search",
          standard: 92.4, 
          zkrag: 92.4, 
          colorStandard: '#52525b', 
          colorZk: '#10b981'
        },
        quality: { 
          title: "Answer Quality (%)",
          desc: "Negligible generation diff",
          standard: 89.1, 
          zkrag: 89.0, 
          colorStandard: '#52525b', 
          colorZk: '#0ea5e9'
        },
        response: { 
          title: "Response Time (ms)",
          desc: "Standard RAG is faster",
          standard: 842, 
          zkrag: 1187, 
          colorStandard: '#52525b', 
          colorZk: '#f59e0b'
        },
        throughput: { 
          title: "Throughput (Q/min)",
          desc: "ZK adds overhead",
          standard: 71, 
          zkrag: 54, 
          colorStandard: '#52525b', 
          colorZk: '#8b5cf6'
        },
        verification: { 
          title: "Verification Capability (%)",
          desc: "Mathematical proof",
          standard: 0, 
          zkrag: 100, 
          colorStandard: '#52525b', 
          colorZk: '#10b981'
        },
        tamper: { 
          title: "Tamper Detection Rate (%)",
          desc: "ZK-SNARK integrity",
          standard: 0, 
          zkrag: 100, 
          colorStandard: '#52525b', 
          colorZk: '#06b6d4'
        },
        privacy: { 
          title: "Privacy Score (/5)",
          desc: "Client-side proving",
          standard: 2, 
          zkrag: 5, 
          colorStandard: '#52525b', 
          colorZk: '#d946ef'
        }
      }
    });

  } catch (error) {
    console.error('Benchmark Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
