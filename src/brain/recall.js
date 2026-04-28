// TODO: Brain recall — hybrid pgvector + BM25 search.
//
// Responsibilities (per SPEC.md §3 + §8):
//   - Embed the query via Gemini.
//   - Run vector search (HNSW on embedding) and BM25 search (GIN on tsv)
//     in parallel.
//   - Reciprocal-rank-fusion the two result sets.
//   - Filter by agent namespace if requested.
//   - Return top-k with text, score, agent, significance, created_at.
//
// Implementation comes in the v1 build task.

throw new Error('src/brain/recall.js: not implemented yet — see SPEC.md');
