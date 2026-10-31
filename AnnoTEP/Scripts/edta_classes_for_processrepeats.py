#!/usr/bin/env python3
"""Rewrites the TE classes of an EDTA RepeatMasker .cat(.gz) file with the names that
ProcessRepeats-lite/complete.pl (AnnoTEP) recognise, so the EDTA annotation can use the
AnnoTEP charts.

EDTA names (DNA/DTA, DNAnona/MULE, DNA/Helitron...) are first resolved to their Sequence
Ontology term through EDTA's own bin/TE_Sequence_Ontology.txt, then translated:
DNA/DTA -> TIR/hAT, DNA/DTM -> TIR/MuDR_Mutator, DNA/Helitron -> RC/Helitron...
MITEs keep their name (ProcessRepeats counts every ^MITE class as MITE). Classes without
a translation are left unchanged.

  edta_classes_for_processrepeats.py --input in.cat.gz --output out.cat.gz \
      --ontology EDTA/bin/TE_Sequence_Ontology.txt [--log classes.log]
"""
import argparse
import gzip
import re
from collections import Counter

# Sequence Ontology term (EDTA) -> ProcessRepeats class (AnnoTEP).
SO_TO_PR = {
    "Copia_LTR_retrotransposon": "LTR/Copia",
    "Gypsy_LTR_retrotransposon": "LTR/Gypsy",
    "LTR_retrotransposon": "LTR/Unknown",
    "TRIM": "TRIM",
    "LARD": "LARD",
    "pararetrovirus": "pararetrovirus",
    "Penelope_retrotransposon": "Penelope",
    "DIRS_YR_retrotransposon": "DIRS",
    "hAT_TIR_transposon": "TIR/hAT",
    "CACTA_TIR_transposon": "TIR/EnSpm_CACTA",
    "Mutator_TIR_transposon": "TIR/MuDR_Mutator",
    "PIF_Harbinger_TIR_transposon": "TIR/PIF_Harbinger",
    "Tc1_Mariner_TIR_transposon": "TIR/Tc1_Mariner",
    "P_TIR_transposon": "TIR/P",
    "piggyBac_TIR_transposon": "TIR/PiggyBac",
    "Transib_TIR_transposon": "TIR/Transib",
    "Merlin_TIR_transposon": "TIR/Merlin",
    "Ginger_TIR_transposon": "TIR/Ginger",
    "Kolobok_TIR_transposon": "TIR/Kolobok",
    "terminal_inverted_repeat_element": "TIR/Unknown",
    "PILE_TIR_transposon": "TIR/Unknown",
    "POLE_TIR_transposon": "TIR/Unknown",
    "helitron": "RC/Helitron",
    "DNA_transposon": "DNA/Unknown",
    "repeat_fragment": "Unknown",
}

# name#class, as in the hit lines and in the alignment lines of the .cat file.
CLASS_RE = re.compile(r"(?<=\S#)(\S+)")


def load_ontology(path):
    alias_to_so = {}
    with open(path) as fh:
        for line in fh:
            if line.startswith("#") or not line.strip():
                continue
            fields = line.split()
            if len(fields) < 3:
                continue
            for alias in fields[2].split(","):
                alias_to_so.setdefault(alias, fields[0])
    return alias_to_so


def translate(cls, alias_to_so):
    if cls.startswith("MITE"):
        return cls
    so = alias_to_so.get(cls)
    if so is None:
        return cls
    if so in SO_TO_PR:
        return SO_TO_PR[so]
    if so == "Sola_TIR_transposon":
        m = re.search(r"Sola[-_]?([123])", cls)
        return f"TIR/Sola{m.group(1)}" if m else "TIR/Unknown"
    # LINE and SINE: ProcessRepeats only needs the order (^LINE, ^SINE).
    for order in ("LINE", "SINE"):
        if so.endswith(f"_{order}_retrotransposon"):
            return cls if cls.startswith(order) else f"{order}/Unknown"
    return cls


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--input", required=True, help=".cat or .cat.gz from the EDTA .anno folder")
    parser.add_argument("--output", required=True, help="translated .cat.gz")
    parser.add_argument("--ontology", required=True, help="EDTA bin/TE_Sequence_Ontology.txt")
    parser.add_argument("--log", help="table of translated classes (count, EDTA, ProcessRepeats)")
    args = parser.parse_args()

    alias_to_so = load_ontology(args.ontology)
    cache = {}
    changes = Counter()

    def repl(m):
        cls = m.group(1)
        if cls not in cache:
            cache[cls] = translate(cls, alias_to_so)
        changes[(cls, cache[cls])] += 1
        return cache[cls]

    opener = gzip.open if args.input.endswith(".gz") else open
    with opener(args.input, "rt") as fin, gzip.open(args.output, "wt") as fout:
        for line in fin:
            fout.write(line if line.startswith("#") else CLASS_RE.sub(repl, line))

    if args.log:
        with open(args.log, "w") as log:
            for (old, new), n in sorted(changes.items(), key=lambda x: -x[1]):
                log.write(f"{n}\t{old}\t{new}\n")


if __name__ == "__main__":
    main()
