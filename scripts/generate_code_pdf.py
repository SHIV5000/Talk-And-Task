#!/usr/bin/env python3
"""
Code → PDF: line numbers, watermark, table of contents.
Robust watermark – fits inside printable margins, no layout corruption.
"""
import os, sys
from fpdf import FPDF
from fpdf.enums import XPos, YPos

DEFAULT_EXTS = "py,js,java,c,cpp,h,hpp,html,css,go,rs,rb,ts,tsx,json,yaml,sh"
DEFAULT_WATERMARK = "CONFIDENTIAL"
EXCLUDED_DIRS = {".git","node_modules","__pycache__","venv",".venv","build","dist",".next"}

class CodePDF(FPDF):
    def __init__(self, watermark_text=DEFAULT_WATERMARK):
        super().__init__()
        self.watermark_text = watermark_text
        self.file_start_pages = []

    def _draw_watermark(self):
        """Watermark that fits inside the printable area – no overflow."""
        # Save cursor position
        x_save, y_save = self.get_x(), self.get_y()
        # Width & height of the printable area
        w_print = self.w - self.l_margin - self.r_margin
        h_print = self.h - self.t_margin - self.b_margin

        # Draw big, light‑grey watermark centred in the printable area
        self.set_font("Courier", "B", 60)
        self.set_text_color(220, 220, 220)
        self.set_xy(self.l_margin, self.t_margin)
        self.cell(w_print, h_print, self.watermark_text, align="C")

        # Restore cursor to exactly where it was (top‑left margin)
        self.set_font("Courier", "", 8)        # reset font size
        self.set_text_color(0, 0, 0)           # reset colour
        self.set_xy(x_save, y_save)

    def add_title_page(self, repo_name="Source Code"):
        self.add_page()
        self.set_font("Courier", "B", 24)
        self.ln(60)
        self.cell(0, 15, repo_name + " - Code Printout", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")
        self.ln(20)
        self.set_font("Courier", "", 12)
        self.cell(0, 10, f"Generated: {self._now()}", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")
        self.ln(10)
        self.cell(0, 10, "Watermark: " + self.watermark_text, new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")

    def _now(self):
        from datetime import datetime
        return datetime.now().strftime("%Y-%m-%d %H:%M")

    def add_file_section(self, rel_path, content):
        start_page = self.page_no()
        self.file_start_pages.append((rel_path, start_page))
        self.add_page()
        self._draw_watermark()                # watermark right after new page
        self.set_font("Courier", "B", 10)
        self.multi_cell(0, 6, rel_path)
        self.ln(2)
        self.set_font("Courier", "", 7)
        for i, line in enumerate(content.split("\n"), 1):
            ln_text = f"{i:4d} {line}"
            self.multi_cell(0, 3.5, ln_text)
        self.ln(5)

    def add_toc_page(self):
        self.add_page()
        self._draw_watermark()
        self.set_font("Courier", "B", 14)
        self.cell(0, 10, "Table of Contents", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(5)
        self.set_font("Courier", "", 9)
        for rel_path, page in self.file_start_pages:
            self.cell(0, 5, f"p.{page:3d}   {rel_path}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

def collect_files(root_dir, extensions):
    for dirpath, dirnames, filenames in os.walk(root_dir):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDED_DIRS and not d.startswith('.')]
        for fname in sorted(filenames):
            if any(fname.endswith(f".{ext}") for ext in extensions):
                full = os.path.join(dirpath, fname)
                rel = os.path.relpath(full, root_dir)
                if rel == "scripts/generate_code_pdf.py":
                    continue        # don't include the script itself
                yield rel, full

def main():
    src_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    output_pdf = sys.argv[2] if len(sys.argv) > 2 else "code.pdf"
    ext_csv = sys.argv[3] if len(sys.argv) > 3 else DEFAULT_EXTS
    watermark = sys.argv[4] if len(sys.argv) > 4 else DEFAULT_WATERMARK
    extensions = [e.strip().lstrip('.') for e in ext_csv.split(',')]

    repo_name = os.path.basename(os.path.abspath(src_dir))
    pdf = CodePDF(watermark)
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_title_page(repo_name)

    for rel_path, full_path in collect_files(src_dir, extensions):
        try:
            with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
            if content.strip():
                pdf.add_file_section(rel_path, content)
        except Exception as e:
            print(f"Warning: could not add {rel_path}: {e}")

    pdf.add_toc_page()
    pdf.output(output_pdf)
    print(f"✅ PDF created: {output_pdf}")
    print(f"   Files included: {len(pdf.file_start_pages)}")
    print(f"   Total pages: {pdf.page_no()}")

if __name__ == "__main__":
    main()
