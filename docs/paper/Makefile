PAPER = main

# tectonic fetches packages and runs bibtex itself
all: $(PAPER).pdf

$(PAPER).pdf: $(PAPER).tex refs.bib
	tectonic $(PAPER).tex

pages: $(PAPER).pdf
	pdfinfo $(PAPER).pdf | grep Pages

clean:
	rm -f $(PAPER).pdf $(PAPER).aux $(PAPER).log $(PAPER).bbl $(PAPER).blg $(PAPER).out

.PHONY: all pages clean
