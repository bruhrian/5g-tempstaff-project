# Uploading Documents through QingRAG

This guide explains how to ingest PDF documents into the RAG system using `QingRAG.py`.

---

## Prerequisites

Ensure the following are configured before running any ingestion script:

- `.env` file is present with all required credentials:
  - `HF_TOKEN`, `PG_HOST`, `PG_PORT`, `PG_USER`, `PG_PASSWORD`, `PG_LIGHTRAG`
  - `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASS`, `NEO4J_DB`
- Ollama is running locally with the following models pulled:
  - `gemma4:e4b` (completion/vision)
  - `mxbai-embed-large` (embeddings)
- PostgreSQL and Neo4j instances are accessible
- A CUDA-capable GPU is available (required for the reranker)

---

## How It Works

When you call `process_folder()`, each PDF in the target folder is:

1. Opened page by page with `pdfplumber`
2. Each page is rendered as a base64 PNG image
3. The image is sent to Ollama (vision model) for a detailed summary
4. All page summaries are concatenated into a single document string
5. The document is inserted into LightRAG via `rag.ainsert()`

---

## Ingesting Documents from a Separate Script

Place your PDFs in any folder, then create a new script (e.g., `ingest.py`) and import directly from `QingRAG.py`.

```python
# ingest.py
import asyncio
import sys

# Add the tools directory to path so QingRAG can be imported
sys.path.append(r"D:\brian\5g lab\backend\agents\tools")

from QingRAG import rag, process_folder
from lightrag.kg.shared_storage import initialize_pipeline_status

FOLDER_PATH = r"D:\path\to\your\pdfs"  # Change this to your PDF folder

async def main():
    # Initialize storages (required before any insert or query)
    await rag.initialize_storages()
    await initialize_pipeline_status()

    # Process and insert all PDFs in the folder
    await process_folder(FOLDER_PATH)
    print("Ingestion complete.")

if __name__ == "__main__":
    asyncio.run(main())
```

---

## Inserting a Single PDF

If you only want to insert one specific file rather than a whole folder:

```python
import asyncio
import sys

sys.path.append(r"D:\brian\5g lab\backend\agents\tools")

from QingRAG import rag, process_pdf
from lightrag.kg.shared_storage import initialize_pipeline_status

FILE_PATH = r"D:\path\to\your\document.pdf"

async def main():
    await rag.initialize_storages()
    await initialize_pipeline_status()

    print(f"Processing {FILE_PATH}...")
    doc_text = process_pdf(FILE_PATH)

    print("Inserting into LightRAG...")
    await rag.ainsert(doc_text)
    print("Done.")

if __name__ == "__main__":
    asyncio.run(main())
```

---

## Notes

- `rag.initialize_storages()` and `initialize_pipeline_status()` **must** be called once before any insert — do not skip these even if the database already has data.
- Documents already inserted will not be duplicated; LightRAG tracks document status in `PGDocStatusStorage`.
- Processing large PDFs is slow by design — each page is summarised by a vision LLM. This is intentional for maximum content extraction quality.
- The `WORKING_DIR` (`D:\brian\5g lab\lightrag`) is used for local caching; ensure it exists and has write permissions.
