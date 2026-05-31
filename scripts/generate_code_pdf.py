#!/usr/bin/env python3
"""
Minimal code → PDF: one file per page, filename header, line numbers.
No watermark, no TOC, no cover – plain and reliable.
"""
import os, sys
from fpdf import FPDF
from fpdf.enums import XPos, YPos

DEFAULT_EXTS = "py,js,java,c,cpp,h,hpp,html,css,go,rs,rb,ts,tsx,json,yaml,sh"
EXCLUDED_DIRS = {".git","node_modules","__pycache__","venv",".venv","build","dist",".next"}

def collect_files(root_dir, extensions):
    for dirpath, dirnames, filenames in os.walk(root_dir):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDED_DIRS and not d.startswith('.')]
        for fname in sorted(filenames):
            if any(fname.endswith(f".{ext}") for ext in extensions):
                full = os.path.join(dirpath, fname)
                rel = os.path.relpath(full, root_dir)
                if rel == "scripts/generate_code_pdf.py":
                    continue
                yield rel, full

def main():
    src_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    output_pdf = sys.argv[2] if len(sys.argv) > 2 else "code.pdf"
    ext_csv = sys.argv[3] if len(sys.argv) > 3 else DEFAULT_EXTS
    extensions = [e.strip().lstrip('.') for e in ext_csv.split(',')]

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)

    first_file = True
    for rel_path, full_path in collect_files(src_dir, extensions):
        try:
            with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
            if not content.strip():
                continue

            if not first_file:
                pdf.add_page()
            else:
                pdf.add_page()
                first_file = False

            # File header (bold, relative path)
            pdf.set_font("Courier", "B", 10)
            pdf.multi_cell(0, 6, rel_path)
            pdf.ln(2)

            # Code with line numbers
            pdf.set_font("Courier", "", 7)
            for i, line in enumerate(content.split("\n"), 1):
                pdf.multi_cell(0, 3.5, f"{i:4d} {line}")
            pdf.ln(5)

        except Exception as e:
            print(f"Warning: could not add {rel_path}: {e}")

    pdf.output(output_pdf)
    print(f"✅ PDF created: {output_pdf}")
    print(f"   Total pages: {pdf.page_no()}")

if __name__ == "__main__":
    main()
