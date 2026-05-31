#!/usr/bin/env python3
"""
Ultimate Code → PDF converter with line numbers, watermark, and table of contents.
Usage:
    python generate_code_pdf.py [source_dir] [output.pdf] [extensions csv] [watermark_text]
Default:
    source_dir = "."
    output.pdf = "code.pdf"
    extensions = py,js,java,c,cpp,h,hpp,html,css,go,rs,rb,ts,tsx,json,yaml,sh
    watermark_text = "CONFIDENTIAL"
"""

import os
import sys
from fpdf import FPDF

# --------------------------- Configuration --------------------------- #
DEFAULT_EXTENSIONS = "py,js,java,c,cpp,h,hpp,html,css,go,rs,rb,ts,tsx,json,yaml,sh"
DEFAULT_WATERMARK = "CONFIDENTIAL"
EXCLUDED_DIRS = {".git", "node_modules", "__pycache__", "venv", ".venv", "build", "dist", ".next"}
# -------------------------------------------------------------------- #

class CodePDF(FPDF):
    def __init__(self, watermark_text=DEFAULT_WATERMARK):
        super().__init__()
        self.watermark_text = watermark_text
        self.file_start_pages = []   # store (rel_path, page_number)

    def header(self):
        # Draw watermark on every page (behind content)
        if self.page_no() == 1:
            return   # skip watermark on cover page (we add cover manually later)
        self.set_font("Courier", "B", 60)
        self.set_text_color(220, 220, 220)   # light grey
        # Rotate and print watermark diagonally
        with self.rotation(45, x=self.w/2, y=self.h/2):
            self.cell(0, 0, self.watermark_text, align="C")

    def add_title_page(self, repo_name="Source Code"):
        """First page with title and generation info."""
        self.add_page()
        self.set_font("Courier", "B", 24)
        self.ln(60)
        self.cell(0, 15, repo_name + " - Code Printout", align="C")
        self.ln(20)
        self.set_font("Courier", "", 12)
        self.cell(0, 10, f"Generated: {self._now()}", align="C")
        self.ln(10)
        self.cell(0, 10, "Includes source files with line numbers", align="C")
        self.ln(10)
        self.cell(0, 10, "Watermark: " + self.watermark_text, align="C")

    def _now(self):
        from datetime import datetime
        return datetime.now().strftime("%Y-%m-%d %H:%M")

    def add_file_section(self, rel_path, content):
        """Add a file header and code with line numbers."""
        # Record start page (before we possibly cause a page break)
        start_page = self.page_no()
        self.file_start_pages.append((rel_path, start_page))
        # PDF bookmark (outline)
        self.add_page() if self.page_no() > 1 else None  # ensure we start a new page for each file except the first after cover
        # Title
        self.set_font("Courier", "B", 10)
        self.multi_cell(0, 6, rel_path)
        self.ln(2)
        # Code with line numbers
        self.set_font("Courier", "", 7)
        for i, line in enumerate(content.split("\n"), 1):
            line_num = f"{i:4d} "  # right-aligned 4-digit number + space
            # For very long lines we just truncate or wrap; multi_cell wraps.
            if line.strip() == "":
                # Blank line: just print line number and a newline
                self.cell(0, 3.5, line_num, ln=True)
            else:
                # Print line number, then the content (may wrap)
                # Simulate line number in the margin by putting it inside the cell
                self.multi_cell(0, 3.5, line_num + line)
        self.ln(5)

    def add_toc_page(self):
        """Printed table of contents at the end of the PDF."""
        self.add_page()
        self.set_font("Courier", "B", 14)
        self.cell(0, 10, "Table of Contents", ln=True)
        self.ln(5)
        self.set_font("Courier", "", 9)
        for rel_path, page in self.file_start_pages:
            self.cell(0, 5, f"p.{page:3d}   {rel_path}", ln=True)
        self.ln(5)
        self.cell(0, 5, "(Also available via PDF bookmarks / sidebar)", ln=True)


def collect_files(root_dir, extensions):
    """Yield (rel_path, full_path) for files matching extensions, skipping excluded dirs."""
    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Exclude unwanted directories
        dirnames[:] = [d for d in dirnames if d not in EXCLUDED_DIRS and not d.startswith('.')]
        for fname in sorted(filenames):
            if any(fname.endswith(f".{ext}") for ext in extensions):
                full = os.path.join(dirpath, fname)
                rel = os.path.relpath(full, root_dir)
                yield rel, full


def main():
    src_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    output_pdf = sys.argv[2] if len(sys.argv) > 2 else "code.pdf"
    ext_csv = sys.argv[3] if len(sys.argv) > 3 else DEFAULT_EXTENSIONS
    watermark = sys.argv[4] if len(sys.argv) > 4 else DEFAULT_WATERMARK
    extensions = [e.strip().lstrip('.') for e in ext_csv.split(',')]

    # Extract repo name from directory (fallback)
    repo_name = os.path.basename(os.path.abspath(src_dir))

    pdf = CodePDF(watermark)
    pdf.set_auto_page_break(auto=True, margin=15)

    # Title page
    pdf.add_title_page(repo_name)

    # Add each file
    for rel_path, full_path in collect_files(src_dir, extensions):
        with open(full_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        pdf.add_file_section(rel_path, content)

    # Printed TOC at the end
    pdf.add_toc_page()

    pdf.output(output_pdf)
    print(f"✅ PDF created: {output_pdf}")
    print(f"   Files included: {len(pdf.file_start_pages)}")
    print(f"   Total pages: {pdf.page_no()}")

if __name__ == "__main__":
    main()
