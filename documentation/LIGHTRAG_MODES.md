# LightRAG Query Modes

LightRAG supports **6 distinct query modes**, each implementing a different retrieval strategy.

---

## The Modes

- **naive** — Basic RAG. Just does a plain vector/embedding similarity search on raw text chunks. No graph involved. Fast but shallow.

- **local** — Zooms into specific entities and their immediate neighbors in the knowledge graph. Best for precise, fact-based questions (e.g. "Who wrote X?").

- **global** — Looks at broader relationships and high-level themes across the graph, aggregating info from multiple entities. Best for big-picture or abstract questions.

- **hybrid** — Combines local and global — retrieves broader relationships while also doing detailed entity exploration. Good general-purpose mode.

- **mix** — Runs two parallel paths: graph-based retrieval (knowledge graph traversal) AND pure vector similarity search on raw chunks, then merges both. Most comprehensive. Recommended when using a Reranker model.

- **bypass** — Skips retrieval entirely. Just sends your query straight to the LLM with no context fetched. Useful for testing the LLM alone or for simple questions that don't need the knowledge base.

---

## Quick Pick Guide

| Use Case | Recommended Mode |
|---|---|
| Specific fact | `local` |
| Big picture / themes | `global` |
| General use | `hybrid` |
| Best quality (with reranker) | `mix` |
| Quick / simple question | `bypass` |
| Baseline comparison | `naive` |
