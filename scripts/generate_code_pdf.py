#!/usr/bin/env python3
"""
Ultimate Code → PDF: line numbers, watermark, TOC.
No rotation context – works on all fpdf2 versions.
"""
import os, sys
from fpdf import FPDF

DEFAULT_EXTS = "py,js,java,c,cpp,h,hpp,html,css,go,rs,rb,ts,tsx,json,yaml,sh"
DEFAULT_WATERMARK = "CONFIDENTIAL"
EXCLUDED_DIRS = {".git","node_modules","__pycache__","venv",".venv","build","dist",".next"}

class CodePDF(FPDF):
    def __init__(self, watermark_text=DEFAULT_WATERMARK):
        super().__init__()
        self.watermark_text = watermark_text
        self.file_start_pages = []

    def header(self):
        # Add a diagonal watermark on every page except the first (title page)
        if self.page_no() == 1:
            return
        # Draw text rotated 45 degrees in the centre, light grey
        self.set_font("Courier", "B", 60)
        self.set_text_color(220, 220, 220)
        # Save current position and rotation state
        x, y = self.get_x(), self.get_y()
        # Move to centre of page
        self.set_xy(0, 0)
        # We approximate rotation by printing each character and adjusting coordinates.
        # Since fpdf2’s rotation context may not exist, we’ll just print horizontal text
        # in a large font covering the page – still noticeable.
        self.cell(0, self.h, self.watermark_text, align="C")
        self.set_xy(x, y)

    def add_title_page(self, repo_name="Source Code"):
        self.add_page()
        self.set_font("Courier", "B", 24)
        self.ln(60)
        self.cell(0, 15, repo_name + " - Code Printout", align="C")
        self.ln(20)
        self.set_font("Courier", "", 12)
        self.cell(0, 10, f"Generated: {self._now()}", align="C")
        self.ln(10)
        self.cell(0, 10, "Watermark: " + self.watermark_text, align="C")

    def _now(self):
        from datetime import datetime
        return datetime.now().strftime("%Y-%m-%d %H:%M")

    def add_file_section(self, rel_path, content):
        start_page = self.page_no()
        self.file_start_pages.append((rel_path, start_page))
        self.add_page()
        self.set_font("Courier", "B", 10)
        self.multi_cell(0, 6, rel_path)
        self.ln(2)
        self.set_font("Courier", "", 7)
        for i, line in enumerate(content.split("\n"), 1):
            # Right‑align line number (4 digits) + space + line
            ln_text = f"{i:4d} {line}"
            self.multi_cell(0, 3.5, ln_text)
        self.ln(5)

    def add_toc_page(self):
        self.add_page()
        self.set_font("Courier", "B", 14)
        self.cell(0, 10, "Table of Contents", ln=True)
        self.ln(5)
        self.set_font("Courier", "", 9)
        for rel_path, page in self.file_start_pages:
            self.cell(0, 5, f"p.{page:3d}   {rel_path}", ln=True)


def collect_files(root_dir, extensions):
    for dirpath, dirnames, filenames in os.walk(root_dir):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDED_DIRS and not d.startswith('.')]
        for fname in sorted(filenames):
            if any(fname.endswith(f".{ext}") for ext in extensions):
                full = os.path.join(dirpath, fname)
                rel = os.path.relpath(full, root_dir)
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
            if content:   # skip empty files (they cause blank pages)
                pdf.add_file_section(rel_path, content)
        except Exception as e:
            print(f"Warning: could not read {rel_path}: {e}")

    pdf.add_toc_page()
    pdf.output(output_pdf)
    print(f"PDF created: {output_pdf}")
    print(f"Files included: {len(pdf.file_start_pages)}")
    print(f"Total pages: {pdf.page_no()}")

if __name__ == "__main__":
    main()
